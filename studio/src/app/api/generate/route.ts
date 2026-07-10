import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Brief, Storyboard } from "@/lib/engine";
import { planStoryboard, sanitizeBrief, sanitizeStoryboard } from "@/lib/engine";
import { mergeAiScenes, type AiStoryboardDraft } from "@/lib/engine/ai";
import { isRateLimited } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Mode IA : Claude écrit le script et choisit les métaphores visuelles.
 * Sans ANTHROPIC_API_KEY, renvoie 501 — le client bascule sur le
 * planificateur heuristique local. L'IA est un amplificateur, pas une
 * dépendance.
 */

const SCENE_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string", description: "Titre court de la vidéo" },
    scenes: {
      type: "array",
      description:
        "Les scènes dans l'ordre : commence par un hook, termine par un cta. 3 à 7 scènes.",
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["hook", "metaphor", "stat", "steps", "comparison", "quote", "cta"],
          },
          durationSec: { type: "number", description: "Durée de la scène en secondes (1.5 à 10)" },
          narration: { type: "string", description: "Phrase de narration (voix off)" },
          title: { type: "string", description: "hook/steps/comparison/cta : titre affiché" },
          accentWord: { type: "string", description: "hook : mot du titre à accentuer" },
          kicker: { type: "string", description: "hook : sur-titre court en majuscules" },
          visual: {
            type: "string",
            enum: ["battery", "orbit", "growth", "pulse", "network"],
            description: "metaphor : visuel animé",
          },
          label: { type: "string", description: "metaphor : libellé fort" },
          caption: { type: "string", description: "metaphor : légende explicative" },
          value: { type: "number", description: "stat : le nombre affiché" },
          prefix: { type: "string", description: "stat : préfixe (€, ~…)" },
          suffix: { type: "string", description: "stat : suffixe (%, ×, h…)" },
          statLabel: { type: "string", description: "stat : phrase sous le nombre" },
          items: {
            type: "array",
            items: { type: "string" },
            description: "steps : 2 ou 3 étapes",
          },
          leftLabel: { type: "string", description: "comparison : libellé barre 1" },
          rightLabel: { type: "string", description: "comparison : libellé barre 2" },
          leftValue: { type: "number", description: "comparison : valeur 0-100 barre 1" },
          rightValue: { type: "number", description: "comparison : valeur 0-100 barre 2" },
          text: { type: "string", description: "quote : la citation" },
          author: { type: "string", description: "quote : auteur (optionnel)" },
          subtitle: { type: "string", description: "cta : sous-titre" },
        },
        required: ["type", "durationSec", "narration"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "scenes"],
  additionalProperties: false,
};

const MAX_BODY_BYTES = 50_000;

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return NextResponse.json(
      { error: "AI_MODE_UNAVAILABLE", message: "Aucune clé API configurée — utilisez le mode heuristique local." },
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

  // Validation + storyboard heuristique de base (timings, thème, dimensions).
  let brief: Brief;
  let base: Storyboard;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    const body = JSON.parse(raw);
    brief = sanitizeBrief(body?.brief as Brief);
    base = planStoryboard(brief);
  } catch {
    return NextResponse.json({ error: "INVALID_BRIEF" }, { status: 400 });
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCENE_SCHEMA },
      },
      system:
        "Tu es le directeur créatif de CineForge, un moteur qui rend des vidéos depuis du HTML animé. " +
        "Tu écris des storyboards percutants : hook choc en ouverture, une idée par scène, métaphores visuelles fortes, CTA net en clôture. " +
        "Contraintes : narration dans la langue demandée, phrases courtes orales, jamais de placeholder, chiffres plausibles uniquement (sinon préfère metaphor/steps/quote).",
      messages: [
        {
          role: "user",
          content:
            `Écris le storyboard d'une vidéo de ${brief.durationSec} secondes (langue: ${brief.language}, ambiance: ${brief.vibe}).\n` +
            `Sujet : ${brief.topic}\n` +
            (brief.points?.length ? `Points clés à couvrir (un par scène) :\n${brief.points.map((p) => `- ${p}`).join("\n")}\n` : "") +
            `La somme des durationSec doit faire ~${brief.durationSec}s. Première scène : hook. Dernière : cta.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json({ error: "AI_REFUSED" }, { status: 502 });
    }
    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "AI_EMPTY" }, { status: 502 });
    }

    const parsed = JSON.parse(textBlock.text) as AiStoryboardDraft;
    // Frontière de confiance unifiée : la sortie IA repasse par la même
    // validation stricte que les imports JSON manuels (défense en profondeur).
    const storyboard = sanitizeStoryboard(mergeAiScenes(base, parsed));
    return NextResponse.json({ storyboard });
  } catch (error) {
    console.error("Génération IA échouée:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI_FAILED" }, { status: 502 });
  }
}
