import type { Brief, MetaphorVisual, Scene, Storyboard } from "./types";
import { ASPECT_DIMENSIONS, BRIEF_LIMITS } from "./types";
import { sanitizeBrief } from "./planner";
import { resolveTheme } from "./themes";

/**
 * Valide et normalise un storyboard venu d'une source non fiable
 * (fichier JSON édité à la main, réponse d'API). Tous les nombres sont
 * coercés/finis, les chaînes bornées, les enums whitelistés, les ids
 * régénérés — le compilateur peut ensuite faire confiance au type.
 */

const METAPHOR_VISUALS = new Set<MetaphorVisual>(["battery", "orbit", "growth", "pulse", "network"]);

function str(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeStoryboard(input: unknown): Storyboard {
  if (!input || typeof input !== "object") throw new Error("Storyboard invalide : objet attendu.");
  const raw = input as Record<string, unknown>;

  const brief = sanitizeBrief((raw.brief ?? {}) as Brief);
  const { width, height } = ASPECT_DIMENSIONS[brief.aspect];
  const theme = resolveTheme(brief.themeId, brief.vibe);
  const durationSec = num(raw.durationSec, BRIEF_LIMITS.durationMin, BRIEF_LIMITS.durationMax, brief.durationSec);

  if (!Array.isArray(raw.scenes) || raw.scenes.length === 0) {
    throw new Error("Storyboard invalide : scènes manquantes.");
  }

  let cursor = 0;
  const scenes: Scene[] = raw.scenes.slice(0, 12).map((item, i) => {
    const s = (item ?? {}) as Record<string, unknown>;
    const duration = num(s.duration, 0.5, 60, 3);
    const common = {
      id: `scene-${i + 1}`,
      start: Math.round(cursor * 100) / 100,
      duration: Math.round(duration * 100) / 100,
      narration: str(s.narration, BRIEF_LIMITS.pointMax),
    };
    cursor += duration;
    switch (s.type) {
      case "hook":
        return {
          ...common, type: "hook",
          title: str(s.title, BRIEF_LIMITS.topicMax, brief.topic),
          accentWord: s.accentWord === undefined ? undefined : str(s.accentWord, 60),
          kicker: s.kicker === undefined ? undefined : str(s.kicker, 40),
        };
      case "metaphor": {
        const visual = METAPHOR_VISUALS.has(s.visual as MetaphorVisual) ? (s.visual as MetaphorVisual) : "growth";
        return {
          ...common, type: "metaphor", visual,
          label: str(s.label, 80),
          caption: str(s.caption, BRIEF_LIMITS.pointMax),
        };
      }
      case "stat":
        return {
          ...common, type: "stat",
          value: num(s.value, 0, 1_000_000_000, 0),
          prefix: s.prefix === undefined ? undefined : str(s.prefix, 4),
          suffix: s.suffix === undefined ? undefined : str(s.suffix, 6),
          label: str(s.label, BRIEF_LIMITS.pointMax),
        };
      case "steps":
        return {
          ...common, type: "steps",
          title: str(s.title, 80),
          items: (Array.isArray(s.items) ? s.items : [])
            .filter((it): it is string => typeof it === "string")
            .map((it) => it.slice(0, BRIEF_LIMITS.pointMax))
            .slice(0, 3),
        };
      case "comparison":
        return {
          ...common, type: "comparison",
          title: str(s.title, BRIEF_LIMITS.topicMax),
          leftLabel: str(s.leftLabel, 60, "A"),
          rightLabel: str(s.rightLabel, 60, "B"),
          leftValue: num(s.leftValue, 0, 100, 30),
          rightValue: num(s.rightValue, 0, 100, 90),
        };
      case "quote":
        return {
          ...common, type: "quote",
          text: str(s.text, BRIEF_LIMITS.topicMax),
          author: s.author === undefined ? undefined : str(s.author, 80),
        };
      case "cta":
        return {
          ...common, type: "cta",
          title: str(s.title, 80, "À vous de jouer."),
          subtitle: s.subtitle === undefined ? undefined : str(s.subtitle, 120),
        };
      default:
        throw new Error(`Storyboard invalide : type de scène inconnu « ${String(s.type)} » (scène ${i + 1}).`);
    }
  });

  return {
    id: str(raw.id, 40, "cf-import").replace(/[^a-zA-Z0-9_-]/g, "") || "cf-import",
    title: str(raw.title, BRIEF_LIMITS.topicMax, brief.topic),
    brief,
    theme: theme.id,
    aspect: brief.aspect,
    fps: 30,
    width,
    height,
    durationSec: Math.round(cursor * 100) / 100 || durationSec,
    scenes,
    version: 1,
  };
}
