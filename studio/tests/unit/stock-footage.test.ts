import { describe, expect, it, vi } from "vitest";
import type { Scene, VideoBackground } from "../../src/lib/engine";
import { createRng, hashString } from "../../src/lib/engine";
import {
  createPexelsProvider,
  extractKeywords,
  isVideoBackgroundEligible,
  resolveSceneVideoBackground,
  type StockFootageProvider,
} from "../../src/lib/engine/stock-footage";

const hookScene: Scene = {
  id: "scene-1", start: 0, duration: 3, narration: "n",
  type: "hook", title: "Le sommeil est votre super-pouvoir", accentWord: "super-pouvoir",
};
const statScene: Scene = {
  id: "scene-2", start: 3, duration: 3, narration: "n",
  type: "stat", value: 3, suffix: "×", label: "plus de récupération",
};
const metaphorScene: Scene = {
  id: "scene-3", start: 6, duration: 4, narration: "n",
  type: "metaphor", visual: "growth", label: "Récupération", caption: "Le corps se régénère pendant le sommeil",
};

describe("isVideoBackgroundEligible", () => {
  it("autorise hook/metaphor/steps/quote/cta", () => {
    for (const t of ["hook", "metaphor", "steps", "quote", "cta"] as const) {
      expect(isVideoBackgroundEligible(t)).toBe(true);
    }
  });
  it("exclut stat et comparison (fond neutre nécessaire à la lisibilité)", () => {
    expect(isVideoBackgroundEligible("stat")).toBe(false);
    expect(isVideoBackgroundEligible("comparison")).toBe(false);
  });
});

describe("extractKeywords", () => {
  it("extrait des mots significatifs du texte de scène en retirant les mots vides", () => {
    const kw = extractKeywords(metaphorScene, "le sommeil", "fr");
    expect(kw).not.toMatch(/\ble\b|\bpendant\b/);
    expect(kw.length).toBeGreaterThan(0);
  });

  it("ignore le titre du hook (marketing/métaphorique, non filmable) et retombe sur le seul sujet", () => {
    // Constaté en usage réel : un titre accrocheur ("super-pouvoir") dilue la
    // recherche vidéo vers du contenu hors-sujet — voir sceneText() dans
    // stock-footage.ts. Le hook n'utilise donc que Brief.topic.
    expect(extractKeywords(hookScene, "le sommeil profond", "fr")).toBe("sommeil profond");
  });

  it("retombe sur le sujet si le texte de scène est vide", () => {
    const empty: Scene = { ...metaphorScene, label: "", caption: "" };
    expect(extractKeywords(empty, "le sommeil profond", "fr")).toContain("sommeil");
  });

  it("priorise le sujet du brief sur le texte de scène dans l'ordre des mots-clés", () => {
    // Pexels trie par pertinence de requête : le premier mot-clé pèse le plus.
    const kw = extractKeywords(metaphorScene, "le café", "fr");
    expect(kw.startsWith("café")).toBe(true);
  });

  it("est déterministe : même entrée = même sortie", () => {
    const a = extractKeywords(metaphorScene, "le sommeil", "fr");
    const b = extractKeywords(metaphorScene, "le sommeil", "fr");
    expect(a).toBe(b);
  });
});

describe("resolveSceneVideoBackground", () => {
  const provider = (results: VideoBackground[]): StockFootageProvider => ({
    search: vi.fn(async () => results),
  });
  const candidate: VideoBackground = { id: "1", url: "https://videos.pexels.com/video-files/1/1.mp4", provider: "pexels" };
  const rng = createRng(hashString("test-seed"));

  it("retourne undefined pour un type de scène non éligible (stat)", async () => {
    const result = await resolveSceneVideoBackground(statScene, "sommeil", "fr", "16:9", provider([candidate]), rng);
    expect(result).toBeUndefined();
  });

  it("retourne un candidat pour un type éligible avec résultats", async () => {
    const result = await resolveSceneVideoBackground(hookScene, "sommeil", "fr", "16:9", provider([candidate]), rng);
    expect(result).toEqual(candidate);
  });

  it("retombe sur undefined si aucun résultat (jamais bloquant)", async () => {
    const result = await resolveSceneVideoBackground(hookScene, "sommeil", "fr", "16:9", provider([]), rng);
    expect(result).toBeUndefined();
  });

  it("retombe sur undefined si le provider throw (panne réseau/quota)", async () => {
    const failing: StockFootageProvider = { search: vi.fn(async () => { throw new Error("Pexels API 429"); }) };
    const result = await resolveSceneVideoBackground(hookScene, "sommeil", "fr", "16:9", failing, rng);
    expect(result).toBeUndefined();
  });

  it("est déterministe : même seed = même clip choisi parmi plusieurs candidats", async () => {
    const many: VideoBackground[] = [
      { id: "1", url: "https://videos.pexels.com/video-files/1/1.mp4", provider: "pexels" },
      { id: "2", url: "https://videos.pexels.com/video-files/2/2.mp4", provider: "pexels" },
      { id: "3", url: "https://videos.pexels.com/video-files/3/3.mp4", provider: "pexels" },
    ];
    const rngA = createRng(hashString("cf-abc"));
    const rngB = createRng(hashString("cf-abc"));
    const a = await resolveSceneVideoBackground(hookScene, "sommeil", "fr", "16:9", provider(many), rngA);
    const b = await resolveSceneVideoBackground(hookScene, "sommeil", "fr", "16:9", provider(many), rngB);
    expect(a).toEqual(b);
  });
});

describe("createPexelsProvider", () => {
  it("interroge l'API avec la clé et l'orientation, mappe les fichiers hd", async () => {
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      expect(url).toContain("orientation=landscape");
      expect((options.headers as Record<string, string>).Authorization).toBe("test-key");
      return new Response(
        JSON.stringify({
          videos: [
            {
              id: 42,
              user: { name: "Jane Doe" },
              video_files: [
                { link: "https://videos.pexels.com/video-files/42/42-sd.mp4", width: 640, height: 360, quality: "sd" },
                { link: "https://videos.pexels.com/video-files/42/42-hd.mp4", width: 1920, height: 1080, quality: "hd" },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createPexelsProvider("test-key");
    const results = await provider.search("sleep", "landscape");

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ id: "42", url: "https://videos.pexels.com/video-files/42/42-hd.mp4", provider: "pexels", credit: "Jane Doe" });
    vi.unstubAllGlobals();
  });

  it("throw si l'API répond une erreur (le repli est géré par resolveSceneVideoBackground)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 429 })));
    const provider = createPexelsProvider("test-key");
    await expect(provider.search("sleep", "landscape")).rejects.toThrow(/429/);
    vi.unstubAllGlobals();
  });

  it("ignore une vidéo sans fichier exploitable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ videos: [{ id: 1, video_files: [] }] }), { status: 200 })),
    );
    const provider = createPexelsProvider("test-key");
    expect(await provider.search("sleep", "landscape")).toEqual([]);
    vi.unstubAllGlobals();
  });
});
