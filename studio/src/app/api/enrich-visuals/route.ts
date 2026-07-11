import { NextRequest, NextResponse } from "next/server";
import type { Storyboard } from "@/lib/engine";
import { sanitizeStoryboard } from "@/lib/engine";
import { createRng, hashString } from "@/lib/engine/rng";
import { createPexelsProvider, resolveSceneVideoBackground, withSearchCache } from "@/lib/engine/stock-footage";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Enrichit un storyboard déjà généré (heuristique ou IA) avec un fond vidéo
 * réel par scène compatible — voir PRD-VISUALS.md. Étape séparée de
 * /api/generate : le studio reste offline-first par défaut (génération
 * texte instantanée côté client), cet enrichissement est un appel réseau
 * additionnel et optionnel, jamais bloquant pour le reste du produit.
 *
 * Sans PEXELS_API_KEY, renvoie 501 — le client garde le storyboard tel
 * quel (fond thème existant), exactement comme le mode IA sans clé Anthropic.
 */

const MAX_BODY_BYTES = 50_000;

export async function POST(request: NextRequest) {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "VISUALS_MODE_UNAVAILABLE", message: "Aucune clé Pexels configurée — les fonds vidéo restent désactivés." },
      { status: 501 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (await isRateLimited(ip)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let storyboard: Storyboard;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    const body = JSON.parse(raw);
    // Frontière de confiance : même validation stricte que /api/generate.
    storyboard = sanitizeStoryboard(body?.storyboard);
  } catch {
    return NextResponse.json({ error: "INVALID_STORYBOARD" }, { status: 400 });
  }

  try {
    const provider = withSearchCache(createPexelsProvider(apiKey));
    const rng = createRng(hashString(`${storyboard.id}|visuals`));

    const scenes = await Promise.all(
      storyboard.scenes.map(async (scene) => {
        const videoBackground = await resolveSceneVideoBackground(
          scene,
          storyboard.brief.topic,
          storyboard.brief.language,
          storyboard.aspect,
          provider,
          rng,
        );
        return videoBackground ? { ...scene, videoBackground } : scene;
      }),
    );

    return NextResponse.json({ storyboard: { ...storyboard, scenes } });
  } catch (error) {
    console.error("Enrichissement visuel échoué:", error instanceof Error ? error.message : error);
    // Jamais bloquant : le storyboard d'origine reste utilisable tel quel.
    return NextResponse.json({ storyboard });
  }
}
