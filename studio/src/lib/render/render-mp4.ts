/**
 * Rendu MP4 d'un storyboard — cœur réutilisable (CLI local ET worker cloud).
 *
 * Pipeline : storyboard → HTML (engine) → Chromium headless (Playwright), seek
 * frame par frame via window.__cfSeek → screenshots PNG → ffmpeg (image2pipe) →
 * MP4 H.264. Déterministe et offline (GSAP servi depuis node_modules).
 *
 * Contrairement au CLI d'origine, ce module NE termine JAMAIS le process : il
 * `throw` une `RenderError` en cas d'échec et signale la progression via
 * `onProgress`, pour être piloté par un serveur de rendu (jobs) sans le tuer.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import { compileStoryboard, type Storyboard } from "../engine";

export class RenderError extends Error {}

export interface RenderOptions {
  /** Sous-titres brûlés dans la vidéo. */
  captions?: boolean;
  /** Chemin du bundle GSAP servi à Chromium (défaut : node_modules du cwd). */
  gsapPath?: string;
  /** Progression : appelée périodiquement avec (frames rendues, total). */
  onProgress?: (done: number, total: number) => void;
  /** Garde-fou de durée totale (défaut 10 min). */
  globalTimeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

function defaultGsapPath(): string {
  return resolve(process.cwd(), "node_modules/gsap/dist/gsap.min.js");
}

/**
 * Rend `storyboard` en MP4 à `outPath`. Résout avec la taille du fichier ;
 * rejette avec `RenderError` en cas d'échec (jamais de process.exit).
 */
export async function renderStoryboardToFile(
  storyboard: Storyboard,
  outPath: string,
  opts: RenderOptions = {},
): Promise<{ bytes: number }> {
  const { width, height, fps, durationSec } = storyboard;
  const totalFrames = Math.round(durationSec * fps);
  const timeoutMs = opts.globalTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const gsapLocal = opts.gsapPath ?? defaultGsapPath();
  const html = compileStoryboard(storyboard, { captions: opts.captions ?? false });

  mkdirSync(dirname(outPath), { recursive: true });

  const browser = await chromium.launch();
  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-f", "image2pipe",
    "-framerate", String(fps),
    "-i", "-",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-crf", "18",
    "-movflags", "+faststart",
    outPath,
  ]);
  let ffmpegStderr = "";
  ffmpeg.stderr.on("data", (chunk: Buffer) => {
    ffmpegStderr += chunk.toString();
    if (ffmpegStderr.length > 20_000) ffmpegStderr = ffmpegStderr.slice(-10_000);
  });
  let ffmpegDead = false;
  ffmpeg.stdin.on("error", () => {
    ffmpegDead = true;
  });
  const ffmpegExit = new Promise<number>((resolveExit, rejectExit) => {
    ffmpeg.on("error", rejectExit);
    ffmpeg.on("close", (code) => {
      ffmpegDead = true;
      resolveExit(code ?? -1);
    });
  });

  try {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    // GSAP servi depuis node_modules : rendu déterministe, zéro réseau requis.
    const serveGsap = async (route: import("playwright").Route) => {
      await route.fulfill({
        body: readFileSync(gsapLocal, "utf8"),
        contentType: "application/javascript",
      });
    };
    await page.route("**://cdn.jsdelivr.net/npm/gsap*/**", serveGsap);
    await page.route("**://cdn.jsdelivr.net/npm/gsap*", serveGsap);
    // Les Google Fonts passent si le réseau est là, sinon fallback système.
    for (const pattern of ["**://fonts.googleapis.com/**", "**://fonts.gstatic.com/**"]) {
      await page.route(pattern, async (route) => {
        try {
          await route.continue();
        } catch {
          await route.abort().catch(() => {});
        }
      });
    }

    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    await page.waitForFunction(
      () => {
        const w = window as unknown as {
          __timelines?: Record<string, unknown>;
          __cfSeek?: (t: number) => void;
        };
        return Boolean(w.__timelines?.["main"]) && typeof w.__cfSeek === "function";
      },
      { timeout: 30_000 },
    );
    await page
      .evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready)
      .catch(() => {});

    const started = Date.now();
    for (let frame = 0; frame < totalFrames; frame++) {
      if (Date.now() - started > timeoutMs) {
        throw new RenderError(
          `Timeout global (${timeoutMs / 1000}s) dépassé à la frame ${frame}/${totalFrames}`,
        );
      }
      const t = frame / fps;
      await page.evaluate((time) => {
        (window as unknown as { __cfSeek: (t: number) => void }).__cfSeek(time);
      }, t);
      if (ffmpegDead) {
        throw new RenderError(
          `ffmpeg s'est arrêté prématurément à la frame ${frame}/${totalFrames}.\n${ffmpegStderr.slice(-2_000)}`,
        );
      }
      const png = await page.screenshot({ type: "png" });
      const canContinue = ffmpeg.stdin.write(png);
      if (!canContinue) {
        await new Promise<void>((resolveDrain, rejectDrain) => {
          const timer = setTimeout(
            () => rejectDrain(new RenderError(`ffmpeg ne consomme plus les frames (frame ${frame}).\n${ffmpegStderr.slice(-2_000)}`)),
            30_000,
          );
          ffmpeg.stdin.once("drain", () => {
            clearTimeout(timer);
            resolveDrain();
          });
          ffmpeg.once("close", () => {
            clearTimeout(timer);
            rejectDrain(new RenderError(`ffmpeg s'est arrêté pendant l'encodage (frame ${frame}).\n${ffmpegStderr.slice(-2_000)}`));
          });
        });
      }
      if ((frame + 1) % 15 === 0 || frame + 1 === totalFrames) {
        opts.onProgress?.(frame + 1, totalFrames);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  ffmpeg.stdin.end();
  const code = await ffmpegExit;
  if (code !== 0) {
    throw new RenderError(`ffmpeg a échoué (code ${code}).\n${ffmpegStderr.slice(-2_000)}`);
  }

  return { bytes: statSync(outPath).size };
}
