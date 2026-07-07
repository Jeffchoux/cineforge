import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Brief, Scene, Storyboard } from "@/lib/engine";
import { BRIEF_LIMITS, planStoryboard, sanitizeBrief } from "@/lib/engine";

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

interface AiScene {
  type: Scene["type"];
  durationSec: number;
  narration: string;
  title?: string;
  accentWord?: string;
  kicker?: string;
  visual?: "battery" | "orbit" | "growth" | "pulse" | "network";
  label?: string;
  caption?: string;
  value?: number;
  prefix?: string;
  suffix?: string;
  statLabel?: string;
  items?: string[];
  leftLabel?: string;
  rightLabel?: string;
  leftValue?: number;
  rightValue?: number;
  text?: string;
  author?: string;
  subtitle?: string;
}

const MAX_BODY_BYTES = 50_000;
const RATE_LIMIT = { windowMs: 60_000, max: 10 };
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

/** Rate limiting best-effort par IP (mémoire locale de l'instance). */
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    if (rateBuckets.size > 10_000) rateBuckets.clear();
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT.max;
}

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
  if (isRateLimited(ip)) {
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

    const parsed = JSON.parse(textBlock.text) as { title: string; scenes: AiScene[] };
    const storyboard = mergeAiScenes(base, parsed);
    return NextResponse.json({ storyboard });
  } catch (error) {
    console.error("Génération IA échouée:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "AI_FAILED" }, { status: 502 });
  }
}

/** Normalise les scènes IA : ids, timings recalés sur la durée cible, champs par défaut. */
function mergeAiScenes(base: Storyboard, ai: { title: string; scenes: AiScene[] }): Storyboard {
  const raw = (ai.scenes ?? []).filter((s) => s && typeof s.narration === "string").slice(0, 8);
  if (raw.length < 2) return base;

  const totalAi = raw.reduce((a, s) => a + clampDur(s.durationSec), 0);
  const scale = base.durationSec / (totalAi || 1);
  let cursor = 0;

  const scenes: Scene[] = raw.map((s, i) => {
    const duration = round2(clampDur(s.durationSec) * scale);
    const common = {
      id: `scene-${i + 1}`,
      start: round2(cursor),
      duration,
      narration: s.narration.slice(0, BRIEF_LIMITS.pointMax),
    };
    cursor += duration;
    switch (s.type) {
      case "hook":
        return { ...common, type: "hook", title: s.title ?? base.title, accentWord: s.accentWord, kicker: s.kicker };
      case "metaphor":
        return { ...common, type: "metaphor", visual: s.visual ?? "growth", label: s.label ?? "", caption: s.caption ?? s.narration };
      case "stat":
        return { ...common, type: "stat", value: clampNumber(s.value, 0, 1_000_000_000), prefix: s.prefix?.slice(0, 4), suffix: s.suffix?.slice(0, 6), label: s.statLabel ?? s.narration };
      case "steps":
        return { ...common, type: "steps", title: s.title ?? "", items: (s.items ?? []).slice(0, 3) };
      case "comparison":
        return {
          ...common, type: "comparison", title: s.title ?? "",
          leftLabel: s.leftLabel ?? "A", rightLabel: s.rightLabel ?? "B",
          leftValue: clampNumber(s.leftValue ?? 30, 0, 100), rightValue: clampNumber(s.rightValue ?? 90, 0, 100),
        };
      case "quote":
        return { ...common, type: "quote", text: s.text ?? s.narration, author: s.author };
      case "cta":
        return { ...common, type: "cta", title: s.title ?? "", subtitle: s.subtitle };
      default:
        return { ...common, type: "quote", text: s.narration };
    }
  });

  return { ...base, title: ai.title?.slice(0, BRIEF_LIMITS.topicMax) || base.title, scenes };
}

function clampDur(n: number | undefined): number {
  return Math.min(10, Math.max(1.5, Number(n) || 4));
}

function clampNumber(n: number | undefined, min: number, max: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
