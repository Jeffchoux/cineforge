import type { Scene, Storyboard } from "./types";
import { BRIEF_LIMITS } from "./types";

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
        return { ...common, type: "hook", title: s.title ?? base.title, accentWord: s.accentWord, kicker: s.kicker };
      case "metaphor":
        return { ...common, type: "metaphor", visual: s.visual ?? "growth", label: s.label ?? "", caption: s.caption ?? s.narration };
      case "stat":
        return {
          ...common, type: "stat",
          value: clampNumber(s.value, 0, 1_000_000_000),
          prefix: s.prefix?.slice(0, 4), suffix: s.suffix?.slice(0, 6),
          label: s.statLabel ?? s.narration,
        };
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
