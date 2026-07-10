import { describe, expect, it } from "vitest";
import {
  activeSceneIndex,
  clampTime,
  computeStageScale,
  renderCommandFor,
  sceneNavTarget,
  slugify,
} from "../../src/components/studio/helpers";

/**
 * Couverture ciblée de la logique de PreviewPlayer.tsx et ExportPanel.tsx.
 * Cette logique (mise à l'échelle, scène active, navigation, clamp de lecture,
 * commande de rendu) est extraite dans helpers.ts pour être testée sans monter
 * les composants React — jusqu'ici elle n'était couverte qu'indirectement en e2e.
 */

const scenes = [
  { start: 0, duration: 3 },
  { start: 3, duration: 4 },
  { start: 7, duration: 2 },
];

describe("computeStageScale (PreviewPlayer)", () => {
  it("retourne 0 tant que le conteneur n'est pas mesuré", () => {
    expect(computeStageScale(0, 1920, 1080, 540)).toBe(0);
    expect(computeStageScale(-10, 1920, 1080, 540)).toBe(0);
  });

  it("borne par la largeur du conteneur quand c'est le facteur limitant", () => {
    // 960/1920 = 0.5 largeur ; 540/1080 = 0.5 hauteur → min = 0.5.
    expect(computeStageScale(960, 1920, 1080, 540)).toBeCloseTo(0.5, 5);
  });

  it("borne par la hauteur max sur un format portrait", () => {
    // 1080/1080 = 1 largeur ; 540/1920 = 0.28125 hauteur → min hauteur.
    expect(computeStageScale(1080, 1080, 1920, 540)).toBeCloseTo(540 / 1920, 5);
  });
});

describe("clampTime (PreviewPlayer)", () => {
  it("borne dans [0, duration]", () => {
    expect(clampTime(-5, 10)).toBe(0);
    expect(clampTime(99, 10)).toBe(10);
    expect(clampTime(4.2, 10)).toBe(4.2);
  });
});

describe("activeSceneIndex (PreviewPlayer)", () => {
  it("trouve la scène contenant l'instant", () => {
    expect(activeSceneIndex(scenes, 0)).toBe(0);
    expect(activeSceneIndex(scenes, 3)).toBe(1);
    expect(activeSceneIndex(scenes, 6.99)).toBe(1);
    expect(activeSceneIndex(scenes, 7)).toBe(2);
  });

  it("retourne -1 au-delà de la dernière scène", () => {
    expect(activeSceneIndex(scenes, 9)).toBe(-1);
  });
});

describe("sceneNavTarget (PreviewPlayer)", () => {
  it("va à la scène suivante/précédente avec un epsilon d'entrée", () => {
    expect(sceneNavTarget(scenes, 0, 1)).toBeCloseTo(3.01, 5);
    expect(sceneNavTarget(scenes, 1, -1)).toBeCloseTo(0.01, 5);
  });

  it("ne déborde pas des bornes", () => {
    expect(sceneNavTarget(scenes, 0, -1)).toBeCloseTo(0.01, 5); // reste sur la 1re
    expect(sceneNavTarget(scenes, 2, 1)).toBeCloseTo(7.01, 5); // reste sur la dernière
  });

  it("quand aucune scène n'est active (-1), part de la dernière", () => {
    expect(sceneNavTarget(scenes, -1, 1)).toBeCloseTo(7.01, 5);
  });

  it("retourne null sans scènes", () => {
    expect(sceneNavTarget([], 0, 1)).toBeNull();
  });
});

describe("renderCommandFor + slugify (ExportPanel)", () => {
  it("compose la commande de rendu à partir du slug", () => {
    expect(renderCommandFor("ma-video")).toBe("npm run render -- --storyboard ma-video.json");
  });

  it("le slug du titre est sûr pour un nom de fichier", () => {
    const slug = slugify("Mon Été 2026 !! <script>");
    expect(slug).toBe("mon-ete-2026-script");
    expect(renderCommandFor(slug)).toContain(`${slug}.json`);
  });
});
