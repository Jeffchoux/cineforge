import { describe, expect, it } from "vitest";
import {
  BRIEF_LIMITS,
  THEMES,
  compileStoryboard,
  planStoryboard,
  sanitizeBrief,
  type Brief,
  type Scene,
} from "../../src/lib/engine";

const baseBrief: Brief = {
  topic: "Les bienfaits du thé gyokuro",
  durationSec: 20,
  vibe: "cinematic",
  aspect: "16:9",
  language: "fr",
};

describe("déterminisme", () => {
  it("même brief + même seed → storyboard et HTML identiques", () => {
    const brief: Brief = { ...baseBrief, seed: 42 };
    const a = planStoryboard(brief);
    const b = planStoryboard(brief);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(compileStoryboard(a)).toBe(compileStoryboard(b));
  });

  it("seeds différentes → sorties différentes", () => {
    const a = planStoryboard({ ...baseBrief, seed: 1 });
    const b = planStoryboard({ ...baseBrief, seed: 2 });
    expect(JSON.stringify(a.scenes)).not.toBe(JSON.stringify(b.scenes));
  });

  it("sans seed explicite, la seed est dérivée du brief (reproductible)", () => {
    const a = planStoryboard(baseBrief);
    const b = planStoryboard(baseBrief);
    expect(a.brief.seed).toBeDefined();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("sanitizeBrief", () => {
  it("borne la durée trop courte à la limite basse", () => {
    expect(sanitizeBrief({ ...baseBrief, durationSec: 5 }).durationSec).toBe(BRIEF_LIMITS.durationMin);
  });

  it("borne la durée trop longue à la limite haute", () => {
    expect(sanitizeBrief({ ...baseBrief, durationSec: 500 }).durationSec).toBe(BRIEF_LIMITS.durationMax);
  });

  it("tronque un topic de plus de 300 caractères", () => {
    const long = "x".repeat(400);
    expect(sanitizeBrief({ ...baseBrief, topic: long }).topic).toHaveLength(BRIEF_LIMITS.topicMax);
  });

  it("rejette un topic vide", () => {
    expect(() => sanitizeBrief({ ...baseBrief, topic: "   " })).toThrow();
  });

  it("limite le nombre de points et leur longueur", () => {
    const points = Array.from({ length: 10 }, (_, i) => `point ${i} ${"y".repeat(300)}`);
    const clean = sanitizeBrief({ ...baseBrief, points });
    expect(clean.points).toHaveLength(BRIEF_LIMITS.pointsMax);
    for (const p of clean.points ?? []) {
      expect(p.length).toBeLessThanOrEqual(BRIEF_LIMITS.pointMax);
    }
  });
});

describe("sécurité XSS", () => {
  it("échappe les injections HTML dans le topic", () => {
    const evil = '<script>alert(1)</script><img src=x onerror=alert(1)>';
    const sb = planStoryboard({ ...baseBrief, topic: evil });
    const html = compileStoryboard(sb);
    // Aucune balise réelle ne doit être créée à partir du texte utilisateur :
    // les chevrons sont échappés, donc "<script>alert" ou "<img" bruts sont interdits.
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("échappe les injections dans les points", () => {
    const sb = planStoryboard({
      ...baseBrief,
      points: ['"><svg onload=alert(2)>', "3x plus de <b>résultats</b>"],
    });
    const html = compileStoryboard(sb);
    expect(html).not.toContain("<svg onload=");
    expect(html).not.toContain("<b>résultats</b>");
    // Le texte du point avec balise doit apparaître sous forme échappée (label de stat).
    expect(html).toContain("&lt;b&gt;résultats&lt;/b&gt;");
  });
});

function checkContinuity(scenes: Scene[], durationSec: number): void {
  expect(scenes.length).toBeGreaterThanOrEqual(3);
  expect(scenes[0].start).toBe(0);
  for (let i = 1; i < scenes.length; i++) {
    const prevEnd = scenes[i - 1].start + scenes[i - 1].duration;
    expect(Math.abs(scenes[i].start - prevEnd)).toBeLessThanOrEqual(0.011);
  }
  const totalEnd = Math.max(...scenes.map((s) => s.start + s.duration));
  expect(Math.abs(totalEnd - durationSec)).toBeLessThanOrEqual(0.05);
}

describe("couverture temporelle", () => {
  const variants: Brief[] = [
    { ...baseBrief, durationSec: 6 },
    { ...baseBrief, durationSec: 20, points: ["3x plus de théanine", "ombre vs soleil", "cueillir, sécher, infuser"] },
    { ...baseBrief, durationSec: 60 },
    { ...baseBrief, durationSec: 120 },
    { ...baseBrief, aspect: "9:16" },
    { ...baseBrief, aspect: "1:1" },
    { ...baseBrief, language: "en", topic: "The benefits of deep work" },
    { ...baseBrief, vibe: "minimal" },
    { ...baseBrief, vibe: "energetic" },
    { ...baseBrief, vibe: "techy" },
    { ...baseBrief, vibe: "warm" },
  ];

  for (const brief of variants) {
    it(`scènes continues pour ${brief.durationSec}s / ${brief.aspect} / ${brief.vibe} / ${brief.language}`, () => {
      const sb = planStoryboard(brief);
      checkContinuity(sb.scenes, sb.durationSec);
    });
  }

  it("respecte les dimensions du format", () => {
    expect(planStoryboard({ ...baseBrief, aspect: "9:16" })).toMatchObject({ width: 1080, height: 1920 });
    expect(planStoryboard({ ...baseBrief, aspect: "1:1" })).toMatchObject({ width: 1080, height: 1080 });
    expect(planStoryboard({ ...baseBrief, aspect: "16:9" })).toMatchObject({ width: 1920, height: 1080 });
  });
});

describe("classification des points", () => {
  it("un point avec un chiffre devient une scène stat", () => {
    const sb = planStoryboard({ ...baseBrief, points: ["3x plus de L-théanine"] });
    expect(sb.scenes.map((s) => s.type)).toContain("stat");
  });

  it("un point avec vs devient une comparaison", () => {
    const sb = planStoryboard({ ...baseBrief, points: ["culture à l'ombre vs plein soleil"] });
    expect(sb.scenes.map((s) => s.type)).toContain("comparison");
  });

  it("une liste de 3 éléments devient des étapes", () => {
    const sb = planStoryboard({ ...baseBrief, points: ["choisir son thé, chauffer l'eau, infuser deux minutes"] });
    expect(sb.scenes.map((s) => s.type)).toContain("steps");
  });
});

describe("thèmes", () => {
  it("chaque thème a toutes ses couleurs et polices", () => {
    for (const theme of Object.values(THEMES)) {
      expect(theme.bg).toBeTruthy();
      expect(theme.ink).toBeTruthy();
      expect(theme.muted).toBeTruthy();
      expect(theme.accent).toBeTruthy();
      expect(theme.accent2).toBeTruthy();
      expect(theme.cardBg).toBeTruthy();
      expect(theme.cardBorder).toBeTruthy();
      expect(theme.fontHead).toBeTruthy();
      expect(theme.fontBody).toBeTruthy();
      expect(theme.radius).toBeGreaterThan(0);
    }
  });
});

describe("compilation", () => {
  it("produit une composition conforme au contrat HyperFrames", () => {
    const sb = planStoryboard(baseBrief);
    const html = compileStoryboard(sb);
    expect(html).toContain('data-composition-id="main"');
    expect(html).toContain("window.__timelines");
    const clipCount = (html.match(/class="clip"/g) ?? []).length;
    expect(clipCount).toBe(sb.scenes.length);
    for (const scene of sb.scenes) {
      expect(html).toContain(`id="${scene.id}"`);
    }
  });

  it("inclut le runtime player par défaut et peut l'omettre", () => {
    const sb = planStoryboard(baseBrief);
    expect(compileStoryboard(sb)).toContain("__cfSeek");
    expect(compileStoryboard(sb, { playerRuntime: false })).not.toContain("__cfSeek");
  });

  it("supporte le GSAP inliné", () => {
    const sb = planStoryboard(baseBrief);
    const html = compileStoryboard(sb, { gsap: { mode: "inline", source: "/* fake gsap */" } });
    expect(html).toContain("/* fake gsap */");
    expect(html).not.toContain("cdn.jsdelivr.net");
  });
});
