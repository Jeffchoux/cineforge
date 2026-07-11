import { describe, expect, it } from "vitest";
import { compileStoryboard, planStoryboard, sanitizeStoryboard, type Brief } from "../../src/lib/engine";

const brief: Brief = {
  topic: "La sécurité des frontières logicielles",
  durationSec: 15,
  vibe: "minimal",
  aspect: "1:1",
  language: "fr",
  seed: 3,
};

describe("sanitizeStoryboard (frontière JSON non fiable)", () => {
  it("accepte un round-trip JSON d'un storyboard légitime", () => {
    const original = planStoryboard(brief);
    const roundTrip = sanitizeStoryboard(JSON.parse(JSON.stringify(original)));
    expect(roundTrip.scenes.map((s) => s.type)).toEqual(original.scenes.map((s) => s.type));
    expect(roundTrip.width).toBe(original.width);
    expect(roundTrip.durationSec).toBeCloseTo(original.durationSec, 1);
  });

  it("neutralise une injection JS via un start/duration string dans le JSON", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard(brief)));
    hostile.scenes[0].start = "0); alert(1); tl.to(x, (";
    hostile.scenes[0].duration = "3); fetch('https://evil.tld'); (";
    const clean = sanitizeStoryboard(hostile);
    const html = compileStoryboard(clean);
    expect(html).not.toContain("alert(1)");
    expect(html).not.toContain("evil.tld");
    expect(typeof clean.scenes[0].start).toBe("number");
    expect(typeof clean.scenes[0].duration).toBe("number");
  });

  it("rejette un type de scène inconnu", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard(brief)));
    hostile.scenes[0].type = "evil-scene";
    expect(() => sanitizeStoryboard(hostile)).toThrow(/inconnu/);
  });

  it("rejette un objet sans scènes", () => {
    expect(() => sanitizeStoryboard({ brief })).toThrow(/scènes/i);
    expect(() => sanitizeStoryboard(null)).toThrow();
    expect(() => sanitizeStoryboard("string")).toThrow();
  });

  it("accepte un videoBackground pexels https légitime", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard(brief)));
    hostile.scenes[0].videoBackground = {
      id: "123", provider: "pexels", credit: "Jane Doe",
      url: "https://videos.pexels.com/video-files/123/123-hd.mp4",
    };
    const clean = sanitizeStoryboard(hostile);
    expect(clean.scenes[0].videoBackground).toEqual({
      id: "123", provider: "pexels", credit: "Jane Doe",
      url: "https://videos.pexels.com/video-files/123/123-hd.mp4",
    });
  });

  it("rejette un videoBackground avec un hôte non whitelisté (anti-injection)", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard(brief)));
    hostile.scenes[0].videoBackground = {
      id: "1", provider: "pexels", url: "https://evil.tld/payload.mp4",
    };
    const clean = sanitizeStoryboard(hostile);
    expect(clean.scenes[0].videoBackground).toBeUndefined();
  });

  it("rejette un videoBackground non-https (javascript:, data:)", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard(brief)));
    hostile.scenes[0].videoBackground = {
      id: "1", provider: "pexels", url: "javascript:alert(1)",
    };
    expect(sanitizeStoryboard(hostile).scenes[0].videoBackground).toBeUndefined();
  });

  it("rejette un provider inconnu", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard(brief)));
    hostile.scenes[0].videoBackground = {
      id: "1", provider: "evil-cdn", url: "https://videos.pexels.com/video-files/1/1.mp4",
    };
    expect(sanitizeStoryboard(hostile).scenes[0].videoBackground).toBeUndefined();
  });

  it("régénère les ids et whiteliste le visual des métaphores", () => {
    const hostile = JSON.parse(JSON.stringify(planStoryboard({ ...brief, durationSec: 30 })));
    for (const s of hostile.scenes) s.id = '"><img onerror=alert(1)>';
    const withMetaphor = hostile.scenes.find((s: { type: string }) => s.type === "metaphor");
    if (withMetaphor) withMetaphor.visual = "javascript:evil";
    const clean = sanitizeStoryboard(hostile);
    for (const s of clean.scenes) expect(s.id).toMatch(/^scene-\d+$/);
    const metaphor = clean.scenes.find((s) => s.type === "metaphor");
    if (metaphor && metaphor.type === "metaphor") {
      expect(["battery", "orbit", "growth", "pulse", "network"]).toContain(metaphor.visual);
    }
  });
});
