import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests du handler /api/generate avec le SDK Anthropic mocké :
 * 501 (pas de clé), 400 (brief invalide), 413 (payload), 429 (rate limit),
 * 200 (succès structured output), 502 (refus).
 */

const createMock = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

// Import APRÈS le mock.
const { POST } = await import("../../src/app/api/generate/route");

const VALID_BRIEF = {
  topic: "Les tests du mode IA",
  durationSec: 15,
  vibe: "techy",
  aspect: "16:9",
  language: "fr",
  seed: 5,
};

let ipCounter = 0;
function makeRequest(body: unknown, ip?: string): NextRequest {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip ?? `10.0.0.${++ipCounter}`,
    },
    body: JSON.stringify(body),
  });
}

describe("/api/generate", () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-fake";
    createMock.mockReset();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("501 sans clé API (le client bascule en heuristique)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    const res = await POST(makeRequest({ brief: VALID_BRIEF }));
    expect(res.status).toBe(501);
    expect((await res.json()).error).toBe("AI_MODE_UNAVAILABLE");
  });

  it("400 sur brief invalide (topic manquant)", async () => {
    const res = await POST(makeRequest({ brief: { durationSec: 10 } }));
    expect(res.status).toBe(400);
  });

  it("413 sur payload trop grand", async () => {
    const res = await POST(
      makeRequest({ brief: { ...VALID_BRIEF, topic: "x".repeat(80_000) } }),
    );
    expect(res.status).toBe(413);
  });

  it("200 : le storyboard IA est fusionné et normalisé", async () => {
    createMock.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Titre écrit par l'IA",
            scenes: [
              { type: "hook", durationSec: 3, narration: "Accroche", title: "Hook IA" },
              { type: "stat", durationSec: 6, narration: "Chiffre", value: 87, suffix: "%" },
              { type: "cta", durationSec: 2, narration: "Fin", title: "Go" },
            ],
          }),
        },
      ],
    });
    const res = await POST(makeRequest({ brief: VALID_BRIEF }));
    expect(res.status).toBe(200);
    const { storyboard } = await res.json();
    expect(storyboard.title).toBe("Titre écrit par l'IA");
    expect(storyboard.scenes).toHaveLength(3);
    const total = storyboard.scenes.reduce(
      (a: number, s: { duration: number }) => a + s.duration,
      0,
    );
    expect(total).toBeCloseTo(15, 0);
  });

  it("appelle le SDK avec la forme structured-output attendue (contrat)", async () => {
    createMock.mockResolvedValue({
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "T",
            scenes: [
              { type: "hook", durationSec: 3, narration: "A" },
              { type: "cta", durationSec: 2, narration: "B" },
            ],
          }),
        },
      ],
    });
    const res = await POST(makeRequest({ brief: VALID_BRIEF }));
    expect(res.status).toBe(200);
    expect(createMock).toHaveBeenCalledTimes(1);
    const args = createMock.mock.calls[0][0];
    // La requête doit demander un JSON schema via output_config.format —
    // c'est ce qui garantit que response.content[0] est un bloc texte JSON.
    expect(args.model).toBe("claude-opus-4-8");
    expect(args.output_config?.format?.type).toBe("json_schema");
    expect(args.output_config?.format?.schema).toBeTypeOf("object");
    expect(args.output_config?.format?.schema?.required).toContain("scenes");
  });

  it("502 si le bloc texte attendu est absent de la réponse SDK", async () => {
    // Contrat de parsing : sans bloc texte JSON, on ne renvoie pas un
    // storyboard malformé — on signale une réponse vide.
    createMock.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "tool_use", id: "x", name: "y", input: {} }],
    });
    const res = await POST(makeRequest({ brief: VALID_BRIEF }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("AI_EMPTY");
  });

  it("502 sur refus du modèle", async () => {
    createMock.mockResolvedValue({ stop_reason: "refusal", content: [] });
    const res = await POST(makeRequest({ brief: VALID_BRIEF }));
    expect(res.status).toBe(502);
  });

  it("502 sur erreur SDK (le client bascule en heuristique)", async () => {
    createMock.mockRejectedValue(new Error("réseau en panne"));
    const res = await POST(makeRequest({ brief: VALID_BRIEF }));
    expect(res.status).toBe(502);
  });

  it("429 après 10 requêtes de la même IP dans la minute", async () => {
    createMock.mockResolvedValue({ stop_reason: "refusal", content: [] });
    const ip = "192.168.99.99";
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) {
      const res = await POST(makeRequest({ brief: VALID_BRIEF }, ip));
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
