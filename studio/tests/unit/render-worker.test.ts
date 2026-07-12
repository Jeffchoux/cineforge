import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * Tests du proxy /api/render vers le worker de rendu cloud + du helper worker :
 * 501 sans config, 400 sans storyboard, 202 quand le worker répond, et la
 * validation d'id de job.
 */
const { workerConfig, isJobId } = await import("../../src/lib/render/worker");
const { POST } = await import("../../src/app/api/render/route");

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/render", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.1" },
    body: JSON.stringify(body),
  });
}

const SB = { storyboard: { id: "cf-x", title: "T", scenes: [], width: 1920, height: 1080, fps: 30, durationSec: 6 } };

describe("worker helper", () => {
  afterEach(() => {
    delete process.env.RENDER_WORKER_URL;
    delete process.env.RENDER_SECRET;
  });

  it("isJobId n'accepte que des UUID v4", () => {
    expect(isJobId("b1e1b4d8-356e-4906-89c6-4ddca2c89ba5")).toBe(true);
    expect(isJobId("../etc/passwd")).toBe(false);
    expect(isJobId("pas-un-uuid")).toBe(false);
    expect(isJobId("")).toBe(false);
  });

  it("workerConfig = null sans env, sinon config nettoyée", () => {
    expect(workerConfig()).toBeNull();
    process.env.RENDER_WORKER_URL = "https://cf-render.example.com/";
    process.env.RENDER_SECRET = "s3cret";
    expect(workerConfig()).toEqual({ url: "https://cf-render.example.com", secret: "s3cret" });
  });
});

describe("POST /api/render", () => {
  beforeEach(() => {
    delete process.env.RENDER_WORKER_URL;
    delete process.env.RENDER_SECRET;
    vi.restoreAllMocks();
  });

  it("501 quand le rendu cloud n'est pas configuré", async () => {
    const res = await POST(makeRequest(SB));
    expect(res.status).toBe(501);
    expect((await res.json()).error).toBe("RENDER_UNAVAILABLE");
  });

  it("400 quand le storyboard est absent", async () => {
    process.env.RENDER_WORKER_URL = "https://w";
    process.env.RENDER_SECRET = "s";
    const res = await POST(makeRequest({ pas: "de storyboard" }));
    expect(res.status).toBe(400);
  });

  it("202 + id relayés quand le worker accepte le job", async () => {
    process.env.RENDER_WORKER_URL = "https://w";
    process.env.RENDER_SECRET = "s";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "b1e1b4d8-356e-4906-89c6-4ddca2c89ba5", status: "queued" }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const res = await POST(makeRequest(SB));
    expect(res.status).toBe(202);
    expect((await res.json()).id).toBe("b1e1b4d8-356e-4906-89c6-4ddca2c89ba5");
  });
});
