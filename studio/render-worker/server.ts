/**
 * CineForge — worker de rendu MP4 (tourne sur le VPS, pas sur Vercel).
 *
 * Reçoit un storyboard, le rend en MP4 (Playwright + ffmpeg) via une file de
 * jobs, et expose le statut + le fichier. Appelé UNIQUEMENT par le proxy Vercel
 * (`/api/render`), jamais par le navigateur directement — donc auth par secret
 * partagé (`RENDER_SECRET`), pas de CORS.
 *
 * Endpoints (tous sous /):
 *   POST /jobs            { storyboard }        -> { id }
 *   GET  /jobs/:id                              -> { status, progress, error? }
 *   GET  /jobs/:id/mp4                          -> le MP4 (200) ou 409 si pas prêt
 *   GET  /healthz                               -> { ok: true, active, queued }
 *
 * Bind 127.0.0.1 : l'exposition publique passe par le Caddy système (comme
 * boostmybiz.pro). Lancement : `RENDER_SECRET=... tsx render-worker/server.ts`.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdtempSync, createReadStream, existsSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sanitizeStoryboard, type Storyboard } from "../src/lib/engine";
import { renderStoryboardToFile } from "../src/lib/render/render-mp4";

const SECRET = process.env.RENDER_SECRET ?? "";
const PORT = Number(process.env.RENDER_PORT ?? 8790);
const HOST = process.env.RENDER_HOST ?? "127.0.0.1";
const MAX_CONCURRENT = Number(process.env.RENDER_CONCURRENCY ?? 1);
const JOB_TTL_MS = Number(process.env.RENDER_JOB_TTL_MS ?? 30 * 60 * 1000);
const MAX_BODY = 200_000; // un storyboard tient largement
// Anti-abus : le rendu est coûteux (CPU/mémoire). Bornes par IP.
const RATE_MAX = Number(process.env.RENDER_RATE_MAX ?? 8);
const RATE_WINDOW_MS = Number(process.env.RENDER_RATE_WINDOW_MS ?? 60 * 60 * 1000);

if (!SECRET) {
  console.error("✗ RENDER_SECRET manquant — le worker refuse de démarrer sans secret.");
  process.exit(1);
}

type Status = "queued" | "rendering" | "done" | "error";
interface Job {
  id: string;
  status: Status;
  progress: number;
  storyboard: Storyboard;
  file?: string;
  error?: string;
  createdAt: number;
}

const jobs = new Map<string, Job>();
const queue: string[] = [];
let active = 0;
const OUT_DIR = mkdtempSync(join(tmpdir(), "cf-render-"));

// ── anti-abus (fenêtre glissante par IP) ────────────────────────────────────
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    hits.set(ip, arr);
    return true;
  }
  arr.push(now);
  hits.set(ip, arr);
  return false;
}

// ── file de rendu ───────────────────────────────────────────────────────────
function pump(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const id = queue.shift()!;
    void runJob(id);
  }
}

async function runJob(id: string): Promise<void> {
  const job = jobs.get(id);
  if (!job) return;
  active++;
  job.status = "rendering";
  const out = join(OUT_DIR, `${id}.mp4`);
  try {
    await renderStoryboardToFile(job.storyboard, out, {
      onProgress: (done, total) => {
        job.progress = Math.round((done / total) * 100);
      },
    });
    job.status = "done";
    job.file = out;
    job.progress = 100;
    console.log(`[render] job ${id} OK (${(statSync(out).size / 1024).toFixed(0)} Ko)`);
  } catch (error) {
    job.status = "error";
    job.error = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    console.error(`[render] job ${id} ÉCHEC : ${job.error}`);
  } finally {
    active--;
    pump();
  }
}

// ── purge périodique (jobs + fichiers expirés) ──────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      if (job.file && existsSync(job.file)) rmSync(job.file, { force: true });
      jobs.delete(id);
    }
  }
}, 60_000).unref();

// ── helpers HTTP ─────────────────────────────────────────────────────────────
function authOk(req: IncomingMessage): boolean {
  const given = String(req.headers["x-render-secret"] ?? "");
  const a = Buffer.from(given);
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}
function clientIp(req: IncomingMessage): string {
  const xff = String(req.headers["x-forwarded-for"] ?? "");
  return xff.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}
function json(res: ServerResponse, code: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("body_too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// ── routeur ──────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;

  if (req.method === "GET" && path === "/healthz") {
    return json(res, 200, { ok: true, active, queued: queue.length, jobs: jobs.size });
  }

  if (!authOk(req)) return json(res, 401, { error: "unauthorized" });

  // POST /jobs
  if (req.method === "POST" && path === "/jobs") {
    if (rateLimited(clientIp(req))) return json(res, 429, { error: "rate_limited" });
    let raw: string;
    try {
      raw = await readBody(req);
    } catch {
      return json(res, 413, { error: "payload_too_large" });
    }
    let storyboard: Storyboard;
    try {
      const parsed = JSON.parse(raw) as { storyboard?: unknown };
      // Frontière de confiance : sanitizeStoryboard clampe durées/dimensions,
      // whitelist les enums, régénère les ids — rien d'hostile ne passe.
      storyboard = sanitizeStoryboard(parsed.storyboard);
    } catch (error) {
      return json(res, 400, { error: "invalid_storyboard", detail: (error instanceof Error ? error.message : "").slice(0, 200) });
    }
    const id = randomUUID();
    jobs.set(id, { id, status: "queued", progress: 0, storyboard, createdAt: Date.now() });
    queue.push(id);
    pump();
    return json(res, 202, { id, status: "queued" });
  }

  // GET /jobs/:id  et  GET /jobs/:id/mp4
  const m = path.match(/^\/jobs\/([0-9a-f-]{36})(\/mp4)?$/);
  if (req.method === "GET" && m) {
    const job = jobs.get(m[1]);
    if (!job) return json(res, 404, { error: "not_found" });
    if (!m[2]) {
      return json(res, 200, { status: job.status, progress: job.progress, error: job.error });
    }
    // /mp4
    if (job.status !== "done" || !job.file || !existsSync(job.file)) {
      return json(res, 409, { error: "not_ready", status: job.status });
    }
    const size = statSync(job.file).size;
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Length": size,
      "Content-Disposition": `attachment; filename="cineforge-${job.id.slice(0, 8)}.mp4"`,
      "Cache-Control": "no-store",
    });
    createReadStream(job.file).pipe(res);
    return;
  }

  return json(res, 404, { error: "not_found" });
});

server.listen(PORT, HOST, () => {
  console.log(`CineForge render-worker en écoute sur ${HOST}:${PORT} (concurrence ${MAX_CONCURRENT}, sorties ${OUT_DIR})`);
});
