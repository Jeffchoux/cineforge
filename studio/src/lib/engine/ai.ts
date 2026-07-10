import type { Scene, Storyboard } from "./types";
import { BRIEF_LIMITS, SCENE_FIELD_LIMITS } from "./types";

function str(v: string | undefined, max: number): string | undefined {
  return v === undefined ? undefined : v.slice(0, max);
}

/**
 * Fusion des scènes proposées par l'IA dans un storyboard de base :
 * normalisation des ids, recalage des timings sur la durée cible,
 * clamps de toutes les valeurs numériques. Pur et testable —
 * la route /api/generate ne fait que l'appeler.
 */

export interface AiScene {
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

export interface AiStoryboardDraft {
  title: string;
  scenes: AiScene[];
}

/** Normalise les scènes IA : ids, timings recalés sur la durée cible, champs par défaut. */
export function mergeAiScenes(base: Storyboard, ai: AiStoryboardDraft): Storyboard {
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
        return { ...common, type: "hook", title: str(s.title, BRIEF_LIMITS.topicMax) ?? base.title, accentWord: str(s.accentWord, SCENE_FIELD_LIMITS.hook.accentWord), kicker: str(s.kicker, SCENE_FIELD_LIMITS.hook.kicker) };
      case "metaphor":
        return { ...common, type: "metaphor", visual: s.visual ?? "growth", label: str(s.label, SCENE_FIELD_LIMITS.metaphor.label) ?? "", caption: str(s.caption, BRIEF_LIMITS.pointMax) ?? s.narration };
      case "stat":
        return {
          ...common, type: "stat",
          value: clampNumber(s.value, SCENE_FIELD_LIMITS.stat.valueMin, SCENE_FIELD_LIMITS.stat.valueMax),
          prefix: s.prefix?.slice(0, SCENE_FIELD_LIMITS.stat.prefix), suffix: s.suffix?.slice(0, SCENE_FIELD_LIMITS.stat.suffix),
          label: str(s.statLabel, BRIEF_LIMITS.pointMax) ?? s.narration,
        };
      case "steps":
        return {
          ...common, type: "steps",
          title: str(s.title, SCENE_FIELD_LIMITS.steps.title) ?? "",
          items: (s.items ?? []).filter((it): it is string => typeof it === "string").map((it) => it.slice(0, BRIEF_LIMITS.pointMax)).slice(0, SCENE_FIELD_LIMITS.steps.itemsMax),
        };
      case "comparison":
        return {
          ...common, type: "comparison", title: str(s.title, BRIEF_LIMITS.topicMax) ?? "",
          leftLabel: str(s.leftLabel, SCENE_FIELD_LIMITS.comparison.label) ?? "A", rightLabel: str(s.rightLabel, SCENE_FIELD_LIMITS.comparison.label) ?? "B",
          leftValue: clampNumber(s.leftValue ?? SCENE_FIELD_LIMITS.comparison.leftDefault, SCENE_FIELD_LIMITS.comparison.valueMin, SCENE_FIELD_LIMITS.comparison.valueMax),
          rightValue: clampNumber(s.rightValue ?? SCENE_FIELD_LIMITS.comparison.rightDefault, SCENE_FIELD_LIMITS.comparison.valueMin, SCENE_FIELD_LIMITS.comparison.valueMax),
        };
      case "quote":
        return { ...common, type: "quote", text: str(s.text, BRIEF_LIMITS.topicMax) ?? s.narration, author: str(s.author, SCENE_FIELD_LIMITS.quote.author) };
      case "cta":
        return { ...common, type: "cta", title: str(s.title, SCENE_FIELD_LIMITS.cta.title) ?? "", subtitle: str(s.subtitle, SCENE_FIELD_LIMITS.cta.subtitle) };
      default:
        return { ...common, type: "quote", text: s.narration };
    }
  });

  return { ...base, title: ai.title?.slice(0, BRIEF_LIMITS.topicMax) || base.title, scenes };
}

export function clampDur(n: number | undefined): number {
  return Math.min(10, Math.max(1.5, Number(n) || 4));
}

export function clampNumber(n: number | undefined, min: number, max: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
