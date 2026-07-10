/**
 * Rate limiting par IP pour /api/generate.
 *
 * Deux modes, choisis à l'exécution selon l'environnement :
 *
 *  1. **Durable (multi-instances)** — si `KV_REST_API_URL` + `KV_REST_API_TOKEN`
 *     sont présents (Vercel KV / Upstash Redis, l'API REST standard), le compteur
 *     est partagé entre toutes les instances serverless via `INCR` + `EXPIRE`
 *     atomiques. C'est la seule façon d'avoir une limite réelle sur une cible
 *     serverless qui scale horizontalement.
 *
 *  2. **Best-effort mono-instance (repli)** — sans KV configuré (dev local,
 *     déploiement mono-instance), un `Map` en mémoire fait office de garde-fou.
 *     ⚠️ Cette protection est *par instance* : sur un déploiement multi-instances
 *     sans KV, elle ne borne PAS le trafic global. C'est assumé et documenté —
 *     branchez KV pour une garantie réelle.
 *
 * En cas d'erreur réseau côté KV, on **fail-open** vers la mémoire plutôt que
 * de bloquer des utilisateurs légitimes (la limite reste best-effort, jamais un
 * point de panne dur pour la génération).
 */

export const RATE_LIMIT = { windowMs: 60_000, max: 10 } as const;

const buckets = new Map<string, { count: number; resetAt: number }>();

/** Compteur en mémoire, best-effort par instance. */
function memoryLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    if (buckets.size > 10_000) buckets.clear();
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT.max;
}

/** Compteur partagé via l'API REST Vercel KV / Upstash Redis (INCR + EXPIRE). */
async function kvLimited(ip: string, url: string, token: string): Promise<boolean> {
  const key = `cf:rl:${ip}`;
  const windowSec = Math.ceil(RATE_LIMIT.windowMs / 1000);
  const headers = { Authorization: `Bearer ${token}` };

  const incr = await fetch(`${url}/incr/${encodeURIComponent(key)}`, { method: "POST", headers });
  if (!incr.ok) throw new Error(`KV incr ${incr.status}`);
  const { result } = (await incr.json()) as { result: number };

  // Première requête de la fenêtre : on pose l'expiration (fenêtre glissante fixe).
  if (result === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSec}`, { method: "POST", headers });
  }
  return result > RATE_LIMIT.max;
}

/**
 * `true` si l'IP dépasse RATE_LIMIT.max requêtes dans la fenêtre. Utilise KV
 * quand il est configuré, sinon la mémoire locale. Ne throw jamais.
 */
export async function isRateLimited(ip: string): Promise<boolean> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      return await kvLimited(ip, url, token);
    } catch {
      // KV injoignable → repli best-effort mémoire (fail-open).
      return memoryLimited(ip);
    }
  }
  return memoryLimited(ip);
}
