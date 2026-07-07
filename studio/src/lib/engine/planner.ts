import type {
  AspectRatio,
  Brief,
  ComparisonScene,
  Language,
  MetaphorVisual,
  Scene,
  StatScene,
  StepsScene,
  Storyboard,
  ThemeId,
  Vibe,
} from "./types";
import { ASPECT_DIMENSIONS, BRIEF_LIMITS } from "./types";
import { createRng, hashString, type Rng } from "./rng";
import { COPY, fillTopic } from "./copy";
import { resolveTheme } from "./themes";

const METAPHOR_VISUALS: readonly MetaphorVisual[] = [
  "battery",
  "orbit",
  "growth",
  "pulse",
  "network",
];

const VALID_LANGUAGES = new Set<Language>(["fr", "en"]);
const VALID_VIBES = new Set<Vibe>(["cinematic", "minimal", "energetic", "techy", "warm"]);
const VALID_ASPECTS = new Set<AspectRatio>(["16:9", "9:16", "1:1"]);
const VALID_THEMES = new Set<ThemeId>(["midnight", "paper", "neon", "broadcast", "pastel"]);

/**
 * Nettoie et borne un brief venu de l'extérieur (formulaire ou API).
 * Whitelist stricte de chaque champ — aucune valeur brute ne traverse
 * vers le compilateur (défense XSS/injection, OWASP A03).
 */
export function sanitizeBrief(input: Brief): Brief {
  if (typeof input?.topic !== "string") throw new Error("Le sujet (topic) est requis.");
  const topic = input.topic.trim().slice(0, BRIEF_LIMITS.topicMax);
  if (!topic) throw new Error("Le sujet (topic) est requis.");
  const points = (Array.isArray(input.points) ? input.points : [])
    .filter((p): p is string => typeof p === "string")
    .map((p) => p.trim().slice(0, BRIEF_LIMITS.pointMax))
    .filter(Boolean)
    .slice(0, BRIEF_LIMITS.pointsMax);
  const durationSec = Math.min(
    BRIEF_LIMITS.durationMax,
    Math.max(BRIEF_LIMITS.durationMin, Math.round(Number(input.durationSec)) || 20),
  );
  return {
    topic,
    points,
    durationSec,
    language: VALID_LANGUAGES.has(input.language) ? input.language : "fr",
    vibe: VALID_VIBES.has(input.vibe) ? input.vibe : "cinematic",
    aspect: VALID_ASPECTS.has(input.aspect) ? input.aspect : "16:9",
    themeId: input.themeId && VALID_THEMES.has(input.themeId) ? input.themeId : undefined,
    seed: Number.isFinite(input.seed) ? Math.floor(input.seed as number) : undefined,
  };
}

interface Beat {
  text: string;
  kind: "stat" | "comparison" | "steps" | "metaphor" | "quote";
}

/** Détecte le type de scène le plus expressif pour un point donné. */
function classifyPoint(text: string): Beat["kind"] {
  const listSep = text.split(/[,;·]| puis | then /i).filter((s) => s.trim().length > 2);
  if (listSep.length >= 3) return "steps";
  if (/\b(vs|versus|contre|plutôt que|rather than|instead of)\b/i.test(text)) return "comparison";
  if (/\d/.test(text)) return "stat";
  return "metaphor";
}

function parseStat(text: string, topic: string): Pick<StatScene, "value" | "prefix" | "suffix" | "label"> {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(%|×|x|k|M|€|\$|h|min|j|ans?)?/);
  const raw = m ? m[1].replace(",", ".") : "3";
  const value = Number.parseFloat(raw);
  const suffix = m?.[2] === "x" ? "×" : (m?.[2] ?? "");
  const label = text.replace(m?.[0] ?? "", "").trim().replace(/^[,:–-]\s*/, "") || topic;
  return { value: Number.isFinite(value) ? value : 3, suffix, label };
}

function parseComparison(text: string, lang: "fr" | "en", rng: Rng): Omit<ComparisonScene, keyof Scene & string> & Pick<ComparisonScene, "title" | "leftLabel" | "rightLabel" | "leftValue" | "rightValue"> {
  const parts = text.split(/\b(?:vs|versus|contre|plutôt que|rather than|instead of)\b/i).map((s) => s.trim());
  const left = parts[0] || (lang === "fr" ? "Avant" : "Before");
  const right = parts[1] || (lang === "fr" ? "Après" : "After");
  const leftValue = 25 + rng.int(20);
  return { title: text, leftLabel: left, rightLabel: right, leftValue, rightValue: 100 - leftValue + 20 };
}

function parseSteps(text: string, lang: "fr" | "en", rng: Rng): Pick<StepsScene, "title" | "items"> {
  const items = text
    .split(/[,;·]| puis | then /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2)
    .slice(0, 3);
  const deck = COPY[lang];
  return {
    title: rng.pick(deck.stepsTitle),
    items: items.length >= 2 ? items : rng.pick(deck.genericSteps),
  };
}

/**
 * Planifie un storyboard complet à partir d'un brief.
 * Déterministe : même brief + même seed → même storyboard.
 */
export function planStoryboard(rawBrief: Brief): Storyboard {
  const brief = sanitizeBrief(rawBrief);
  const seed = brief.seed ?? hashString(`${brief.topic}|${brief.durationSec}|${brief.vibe}`);
  const rng = createRng(seed);
  const lang = brief.language;
  const deck = COPY[lang];
  const topic = brief.topic;

  const D = brief.durationSec;
  const hookDur = Math.min(3, Math.max(1.8, D * 0.22));
  const ctaDur = Math.min(2.5, Math.max(1.5, D * 0.18));
  const middleDur = D - hookDur - ctaDur;

  // Construit les beats du milieu
  let beats: Beat[];
  if (brief.points && brief.points.length > 0) {
    beats = brief.points.map((text) => ({ text, kind: classifyPoint(text) }));
  } else {
    const count = Math.max(1, Math.min(4, Math.floor(middleDur / 4)));
    // Pas de "stat" générique : on n'invente jamais de chiffre — les scènes
    // statistiques n'apparaissent que si un point clé en contient un.
    const kinds: Beat["kind"][] = ["metaphor", "steps", "quote", "metaphor"];
    beats = Array.from({ length: count }, (_, i) => ({ text: topic, kind: kinds[i % kinds.length] }));
  }
  // Durée par beat, bornée pour rester lisible
  const beatDur = middleDur / beats.length;

  const scenes: Scene[] = [];
  let cursor = 0;
  let sceneIndex = 0;
  const nextId = () => `scene-${++sceneIndex}`;

  const hookTitle = fillTopic(rng.pick(deck.hooks), topic);
  scenes.push({
    id: nextId(),
    type: "hook",
    start: cursor,
    duration: round2(hookDur),
    title: hookTitle,
    accentWord: pickAccentWord(topic),
    kicker: rng.pick(deck.kickers),
    narration: fillTopic(rng.pick(deck.narrationHook), topic),
  });
  cursor += hookDur;

  const usedVisuals = new Set<MetaphorVisual>();
  for (const beat of beats) {
    const base = { id: nextId(), start: round2(cursor), duration: round2(beatDur), narration: beat.text };
    switch (beat.kind) {
      case "stat": {
        scenes.push({ ...base, type: "stat", ...parseStat(beat.text, topic) });
        break;
      }
      case "comparison": {
        scenes.push({ ...base, type: "comparison", ...parseComparison(beat.text, lang, rng) });
        break;
      }
      case "steps": {
        scenes.push({ ...base, type: "steps", ...parseSteps(beat.text, lang, rng) });
        break;
      }
      case "quote": {
        scenes.push({ ...base, type: "quote", text: rng.pick(deck.quotes) });
        break;
      }
      case "metaphor": {
        const available = METAPHOR_VISUALS.filter((v) => !usedVisuals.has(v));
        const visual = rng.pick(available.length > 0 ? available : METAPHOR_VISUALS);
        usedVisuals.add(visual);
        scenes.push({
          ...base,
          type: "metaphor",
          visual,
          label: deck.metaphorLabels[visual],
          caption: deck.metaphorCaptions[visual],
        });
        break;
      }
    }
    cursor += beatDur;
  }

  const cta = rng.pick(deck.ctas);
  scenes.push({
    id: nextId(),
    type: "cta",
    start: round2(cursor),
    duration: round2(ctaDur),
    title: cta.title,
    subtitle: cta.subtitle,
    narration: rng.pick(deck.narrationCta),
  });

  const { width, height } = ASPECT_DIMENSIONS[brief.aspect];
  const theme = resolveTheme(brief.themeId, brief.vibe);

  return {
    id: `cf-${seed.toString(36)}`,
    title: topic,
    brief: { ...brief, seed },
    theme: theme.id,
    aspect: brief.aspect,
    fps: 30,
    width,
    height,
    durationSec: D,
    scenes,
    version: 1,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Choisit le mot le plus « fort » (le plus long) du sujet comme mot accentué. */
function pickAccentWord(topic: string): string | undefined {
  const words = topic.split(/\s+/).filter((w) => w.length >= 4);
  if (words.length === 0) return undefined;
  return words.reduce((a, b) => (b.length > a.length ? b : a));
}
