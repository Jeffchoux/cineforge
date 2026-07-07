/**
 * CineForge — renderer MP4 local.
 *
 * Deux modes :
 *   npm run render -- --storyboard path/to/storyboard.json [--out renders/video.mp4]
 *   npm run render -- --topic "Sujet" --duration 20 --vibe cinematic --aspect 16:9 --lang fr [--points "a;b;c"] [--seed 42] [--out ...]
 *
 * Pipeline : storyboard → HTML (engine) → Chromium headless (Playwright),
 * seek frame par frame via window.__cfSeek → screenshots PNG → ffmpeg
 * (image2pipe) → MP4 H.264. Déterministe et offline (GSAP servi en local).
 */

import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright";
import {
  compileStoryboard,
  planStoryboard,
  type AspectRatio,
  type Brief,
  type Language,
  type Storyboard,
  type Vibe,
} from "../src/lib/engine";

const GLOBAL_TIMEOUT_MS = 10 * 60 * 1000;

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function assertFfmpeg(): void {
  const probe = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (probe.error || probe.status !== 0) {
    fail(
      "ffmpeg introuvable. Installez-le d'abord :\n" +
        "  macOS : brew install ffmpeg\n" +
        "  Linux : sudo apt install ffmpeg",
    );
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function loadStoryboard(path: string): Storyboard {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    fail(`Impossible de lire le storyboard : ${path}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    fail(`JSON invalide dans ${path}`);
  }
  if (!isRecord(data)) fail(`Storyboard invalide (${path}) : objet JSON attendu.`);
  const sb = data as Partial<Storyboard>;
  const problems: string[] = [];
  if (!Array.isArray(sb.scenes) || sb.scenes.length === 0) problems.push("scenes manquantes ou vides");
  if (typeof sb.durationSec !== "number" || sb.durationSec <= 0) problems.push("durationSec invalide");
  if (typeof sb.width !== "number" || typeof sb.height !== "number") problems.push("width/height invalides");
  if (typeof sb.fps !== "number" || sb.fps <= 0) problems.push("fps invalide");
  if (typeof sb.theme !== "string") problems.push("theme manquant");
  if (problems.length > 0) fail(`Storyboard invalide (${path}) : ${problems.join(", ")}.`);
  return sb as Storyboard;
}

function briefFromArgs(args: Map<string, string>): Brief {
  const topic = args.get("topic");
  if (!topic) fail("Fournissez --storyboard <fichier.json> ou --topic \"...\"");
  const points = args.get("points")?.split(";").map((p) => p.trim()).filter(Boolean);
  const seedRaw = args.get("seed");
  return {
    topic,
    points,
    durationSec: Number(args.get("duration") ?? 20),
    vibe: (args.get("vibe") ?? "cinematic") as Vibe,
    aspect: (args.get("aspect") ?? "16:9") as AspectRatio,
    language: (args.get("lang") ?? "fr") as Language,
    seed: seedRaw !== undefined ? Number(seedRaw) : undefined,
  };
}

async function renderStoryboard(storyboard: Storyboard, outPath: string, captions = false): Promise<void> {
  const { width, height, fps, durationSec } = storyboard;
  const totalFrames = Math.round(durationSec * fps);
  const html = compileStoryboard(storyboard, { captions });

  mkdirSync(dirname(outPath), { recursive: true });

  console.log(
    `▶ Rendu « ${storyboard.title} » — ${durationSec}s @ ${fps}fps (${totalFrames} frames, ${width}×${height})`,
  );

  const browser = await chromium.launch();
  const ffmpeg = spawn("ffmpeg", [
    "-y",
    "-f",
    "image2pipe",
    "-framerate",
    String(fps),
    "-i",
    "-",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-crf",
    "18",
    "-movflags",
    "+faststart",
    outPath,
  ]);
  let ffmpegStderr = "";
  ffmpeg.stderr.on("data", (chunk: Buffer) => {
    ffmpegStderr += chunk.toString();
    if (ffmpegStderr.length > 20_000) ffmpegStderr = ffmpegStderr.slice(-10_000);
  });
  // Sans listener 'error', un EPIPE (ffmpeg mort pendant un write) ferait
  // planter tout le process au lieu d'échouer proprement.
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

    const gsapLocal = resolve(__dirname, "../node_modules/gsap/dist/gsap.min.js");
    // GSAP servi depuis node_modules : rendu déterministe, zéro réseau requis.
    await page.route("**://cdn.jsdelivr.net/npm/gsap*/**", async (route) => {
      await route.fulfill({
        body: readFileSync(gsapLocal, "utf8"),
        contentType: "application/javascript",
      });
    });
    await page.route("**://cdn.jsdelivr.net/npm/gsap*", async (route) => {
      await route.fulfill({
        body: readFileSync(gsapLocal, "utf8"),
        contentType: "application/javascript",
      });
    });
    // Les Google Fonts passent si le réseau est là, sinon fallback système.
    await page.route("**://fonts.googleapis.com/**", async (route) => {
      try {
        await route.continue();
      } catch {
        await route.abort().catch(() => {});
      }
    });
    await page.route("**://fonts.gstatic.com/**", async (route) => {
      try {
        await route.continue();
      } catch {
        await route.abort().catch(() => {});
      }
    });

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
    // Laisse les webfonts se poser si elles arrivent (sinon tant pis).
    await page
      .evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready)
      .catch(() => {});

    const started = Date.now();
    for (let frame = 0; frame < totalFrames; frame++) {
      if (Date.now() - started > GLOBAL_TIMEOUT_MS) {
        throw new Error(`Timeout global (${GLOBAL_TIMEOUT_MS / 1000}s) dépassé à la frame ${frame}/${totalFrames}`);
      }
      const t = frame / fps;
      await page.evaluate((time) => {
        (window as unknown as { __cfSeek: (t: number) => void }).__cfSeek(time);
      }, t);
      if (ffmpegDead) {
        throw new Error(`ffmpeg s'est arrêté prématurément à la frame ${frame}/${totalFrames}.\n${ffmpegStderr.slice(-2_000)}`);
      }
      const png = await page.screenshot({ type: "png" });
      const canContinue = ffmpeg.stdin.write(png);
      if (!canContinue) {
        // Attente du drain bornée : si ffmpeg meurt entre-temps, le drain
        // n'arrivera jamais — on sort au lieu de bloquer indéfiniment.
        await new Promise<void>((resolveDrain, rejectDrain) => {
          const timer = setTimeout(
            () => rejectDrain(new Error(`ffmpeg ne consomme plus les frames (frame ${frame}).\n${ffmpegStderr.slice(-2_000)}`)),
            30_000,
          );
          ffmpeg.stdin.once("drain", () => {
            clearTimeout(timer);
            resolveDrain();
          });
          ffmpeg.once("close", () => {
            clearTimeout(timer);
            rejectDrain(new Error(`ffmpeg s'est arrêté pendant l'encodage (frame ${frame}).\n${ffmpegStderr.slice(-2_000)}`));
          });
        });
      }
      if ((frame + 1) % 30 === 0 || frame + 1 === totalFrames) {
        const pct = Math.round(((frame + 1) / totalFrames) * 100);
        console.log(`  frame ${frame + 1}/${totalFrames} (${pct}%)`);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  ffmpeg.stdin.end();
  const code = await ffmpegExit;
  if (code !== 0) {
    fail(`ffmpeg a échoué (code ${code}).\n${ffmpegStderr.slice(-2_000)}`);
  }

  const size = statSync(outPath).size;
  console.log(
    `\n✓ Vidéo rendue : ${outPath}\n  ${(size / 1024).toFixed(1)} KB · ${durationSec}s @ ${fps}fps · ${width}×${height}`,
  );
}

async function main(): Promise<void> {
  assertFfmpeg();
  const args = parseArgs(process.argv.slice(2));

  let storyboard: Storyboard;
  const storyboardPath = args.get("storyboard");
  if (storyboardPath) {
    storyboard = loadStoryboard(resolve(storyboardPath));
  } else {
    storyboard = planStoryboard(briefFromArgs(args));
  }

  const defaultName = `${storyboard.id}.mp4`;
  const outPath = resolve(args.get("out") ?? `renders/${defaultName}`);
  const captions = args.get("captions") === "true" || args.get("captions") === "";
  await renderStoryboard(storyboard, outPath, captions);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
