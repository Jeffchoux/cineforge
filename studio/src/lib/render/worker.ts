/**
 * Config du worker de rendu cloud, côté serveur Vercel uniquement.
 *
 * Le navigateur ne parle jamais au worker (CSP connect-src 'self') : ces routes
 * `/api/render*` sont un proxy serveur→serveur vers le VPS. Sans configuration,
 * `workerConfig()` renvoie null → les routes répondent 501 et le client bascule
 * sur l'export local (téléchargement HTML + commande CLI).
 */
export interface WorkerConfig {
  url: string;
  secret: string;
}

export function workerConfig(): WorkerConfig | null {
  const url = process.env.RENDER_WORKER_URL;
  const secret = process.env.RENDER_SECRET;
  if (!url || !secret) return null;
  return { url: url.replace(/\/+$/, ""), secret };
}

/** UUID v4 canonique (les ids de job du worker). Filtre les chemins hostiles. */
export function isJobId(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
