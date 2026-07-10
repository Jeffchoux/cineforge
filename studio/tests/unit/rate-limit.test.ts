import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Rate limiter partagé. Deux modes : mémoire best-effort (repli) et KV durable
 * (Vercel KV / Upstash REST) quand l'environnement est configuré. On teste ici
 * le repli mémoire et le fail-open si KV tombe, sans dépendance réseau réelle.
 */

const { isRateLimited, RATE_LIMIT } = await import("../../src/lib/rate-limit");

describe("isRateLimited — repli mémoire (best-effort mono-instance)", () => {
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    vi.restoreAllMocks();
  });

  it("laisse passer jusqu'à max puis bloque", async () => {
    const ip = "203.0.113.7";
    let blocked = false;
    for (let i = 0; i < RATE_LIMIT.max; i++) {
      expect(await isRateLimited(ip)).toBe(false);
    }
    blocked = await isRateLimited(ip); // (max + 1)e requête
    expect(blocked).toBe(true);
  });

  it("compte les IP indépendamment", async () => {
    for (let i = 0; i < RATE_LIMIT.max + 1; i++) await isRateLimited("203.0.113.8");
    expect(await isRateLimited("203.0.113.9")).toBe(false);
  });
});

describe("isRateLimited — mode KV durable", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = "https://kv.example.com";
    process.env.KV_REST_API_TOKEN = "tok";
  });
  afterEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    vi.restoreAllMocks();
  });

  it("bloque quand le compteur KV dépasse max", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ result: RATE_LIMIT.max + 1 }), { status: 200 })),
    );
    expect(await isRateLimited("198.51.100.1")).toBe(true);
  });

  it("pose l'expiration à la première requête (result === 1) et laisse passer", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ result: 1 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await isRateLimited("198.51.100.2")).toBe(false);
    // INCR + EXPIRE = 2 appels.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondUrl = (fetchMock.mock.calls[1] as unknown[])[0] as string;
    expect(secondUrl).toContain("/expire/");
  });

  it("fail-open vers la mémoire si KV est injoignable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("réseau KV en panne");
      }),
    );
    // Ne throw pas et retombe sur le repli mémoire (donc false pour une IP neuve).
    expect(await isRateLimited("198.51.100.99")).toBe(false);
  });
});
