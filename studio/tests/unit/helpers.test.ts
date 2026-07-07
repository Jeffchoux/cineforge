import { describe, expect, it } from "vitest";
import { retimeScenes, slugify } from "../../src/components/studio/helpers";
import { planStoryboard, type Brief } from "../../src/lib/engine";

const brief: Brief = {
  topic: "Tester les helpers du studio",
  durationSec: 20,
  vibe: "warm",
  aspect: "16:9",
  language: "fr",
  seed: 11,
};

describe("retimeScenes", () => {
  it("recale les starts en cascade après édition d'une durée", () => {
    const sb = planStoryboard(brief);
    const edited = {
      ...sb,
      scenes: sb.scenes.map((s, i) => (i === 0 ? { ...s, duration: s.duration + 4 } : s)),
    };
    const retimed = retimeScenes(edited);
    expect(retimed.scenes[0].start).toBe(0);
    for (let i = 1; i < retimed.scenes.length; i++) {
      expect(retimed.scenes[i].start).toBeCloseTo(
        retimed.scenes[i - 1].start + retimed.scenes[i - 1].duration,
        2,
      );
    }
    expect(retimed.durationSec).toBeCloseTo(sb.durationSec + 4, 1);
  });

  it("est idempotent sur un storyboard déjà cohérent", () => {
    const sb = planStoryboard(brief);
    const once = retimeScenes(sb);
    const twice = retimeScenes(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe("slugify", () => {
  it("retire accents et caractères spéciaux", () => {
    expect(slugify("Les bienfaits du thé gyokuro !")).toBe("les-bienfaits-du-the-gyokuro");
  });
  it("a un repli sûr sur entrée vide", () => {
    expect(slugify("!!!")).toBe("cineforge-video");
  });
});
