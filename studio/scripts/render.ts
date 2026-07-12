/**
 * CineForge — CLI de rendu MP4 local.
 *
 * Deux modes :
 *   npm run render -- --storyboard path/to/storyboard.json [--out renders/video.mp4]
 *   npm run render -- --topic "Sujet" --duration 20 --vibe cinematic --aspect 16:9 --lang fr [--points "a;b;c"] [--seed 42] [--out ...]
 *
 * Le cœur du rendu (Playwright + ffmpeg) vit dans `src/lib/render/render-mp4.ts`,
 * partagé avec le worker de rendu cloud. Ce script n'est que l'emballage CLI :
 * parse des arguments, garde-fous, journal, et sortie process.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  planStoryboard,
  sanitizeStoryboard,
  type AspectRatio,
  type Brief,
  type Language,
  type Storyboard,
  type Vibe,
} from "../src/lib/engine";
import { renderStoryboardToFile, RenderError } from "../src/lib/render/render-mp4";

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
  // Validation de frontière complète : nombres coercés, enums whitelistés,
  // ids régénérés — aucun contenu du JSON ne peut injecter du JS dans la
  // composition compilée.
  try {
    return sanitizeStoryboard(data);
  } catch (error) {
    fail(`Storyboard invalide (${path}) : ${error instanceof Error ? error.message : String(error)}`);
  }
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

  const outPath = resolve(args.get("out") ?? `renders/${storyboard.id}.mp4`);
  const captions = args.get("captions") === "true" || args.get("captions") === "";
  const { width, height, fps, durationSec } = storyboard;
  const totalFrames = Math.round(durationSec * fps);
  console.log(
    `▶ Rendu « ${storyboard.title} » — ${durationSec}s @ ${fps}fps (${totalFrames} frames, ${width}×${height})`,
  );

  try {
    const { bytes } = await renderStoryboardToFile(storyboard, outPath, {
      captions,
      gsapPath: resolve(__dirname, "../node_modules/gsap/dist/gsap.min.js"),
      onProgress: (done, total) => {
        if (done % 30 === 0 || done === total) {
          console.log(`  frame ${done}/${total} (${Math.round((done / total) * 100)}%)`);
        }
      },
    });
    console.log(
      `\n✓ Vidéo rendue : ${outPath}\n  ${(bytes / 1024).toFixed(1)} KB · ${durationSec}s @ ${fps}fps · ${width}×${height}`,
    );
  } catch (error) {
    fail(error instanceof RenderError || error instanceof Error ? error.message : String(error));
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
