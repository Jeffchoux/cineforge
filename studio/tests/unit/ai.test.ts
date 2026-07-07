import { describe, expect, it } from "vitest";
import { mergeAiScenes, planStoryboard, type AiStoryboardDraft, type Brief } from "../../src/lib/engine";

const brief: Brief = {
  topic: "Le télétravail efficace",
  durationSec: 20,
  vibe: "techy",
  aspect: "16:9",
  language: "fr",
  seed: 7,
};

const base = planStoryboard(brief);

describe("mergeAiScenes", () => {
  it("recale les timings IA sur la durée cible, sans trou ni chevauchement", () => {
    const draft: AiStoryboardDraft = {
      title: "Titre IA",
      scenes: [
        { type: "hook", durationSec: 3, narration: "Accroche", title: "Un hook" },
        { type: "stat", durationSec: 5, narration: "Un chiffre", value: 42, suffix: "%" },
        { type: "cta", durationSec: 2, narration: "Conclusion", title: "Allez-y" },
      ],
    };
    const merged = mergeAiScenes(base, draft);
    expect(merged.title).toBe("Titre IA");
    expect(merged.scenes).toHaveLength(3);
    const total = merged.scenes.reduce((a, s) => a + s.duration, 0);
    expect(total).toBeCloseTo(base.durationSec, 0);
    for (let i = 1; i < merged.scenes.length; i++) {
      expect(merged.scenes[i].start).toBeCloseTo(
        merged.scenes[i - 1].start + merged.scenes[i - 1].duration,
        1,
      );
    }
  });

  it("garde le storyboard de base si l'IA renvoie moins de 2 scènes exploitables", () => {
    expect(mergeAiScenes(base, { title: "x", scenes: [] })).toBe(base);
    expect(
      mergeAiScenes(base, {
        title: "x",
        scenes: [{ type: "cta", durationSec: 2, narration: "seule scène" }],
      }),
    ).toBe(base);
  });

  it("clampe les valeurs numériques hostiles (Infinity, négatifs, géants)", () => {
    const draft: AiStoryboardDraft = {
      title: "t",
      scenes: [
        { type: "stat", durationSec: 4, narration: "n", value: Number.POSITIVE_INFINITY },
        { type: "comparison", durationSec: 4, narration: "n", leftValue: -50, rightValue: 10_000 },
      ],
    };
    const merged = mergeAiScenes(base, draft);
    const stat = merged.scenes[0];
    const comp = merged.scenes[1];
    if (stat.type !== "stat" || comp.type !== "comparison") throw new Error("types inattendus");
    expect(Number.isFinite(stat.value)).toBe(true);
    expect(comp.leftValue).toBeGreaterThanOrEqual(0);
    expect(comp.rightValue).toBeLessThanOrEqual(100);
  });

  it("borne le nombre de scènes à 8 et tronque les narrations", () => {
    const draft: AiStoryboardDraft = {
      title: "t",
      scenes: Array.from({ length: 20 }, () => ({
        type: "quote" as const,
        durationSec: 3,
        narration: "x".repeat(2000),
      })),
    };
    const merged = mergeAiScenes(base, draft);
    expect(merged.scenes.length).toBeLessThanOrEqual(8);
    for (const scene of merged.scenes) {
      expect(scene.narration.length).toBeLessThanOrEqual(160);
    }
  });
});
