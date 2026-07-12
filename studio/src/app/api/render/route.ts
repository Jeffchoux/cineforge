import { NextRequest, NextResponse } from "next/server";
import { workerConfig } from "@/lib/render/worker";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BODY_BYTES = 200_000;

/**
 * POST /api/render  { storyboard }  ->  { id }
 *
 * Proxy serveur→serveur : crée un job sur le worker de rendu du VPS. Le
 * navigateur ne joint que cette route (même origine, CSP OK). Sans worker
 * configuré : 501 → le client bascule sur l'export local.
 */
export async function POST(request: NextRequest) {
  const cfg = workerConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "RENDER_UNAVAILABLE", message: "Rendu cloud non configuré — utilisez l'export local." },
      { status: 501 },
    );
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
  }
  let storyboard: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    }
    storyboard = (JSON.parse(raw) as { storyboard?: unknown }).storyboard;
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  if (!storyboard || typeof storyboard !== "object") {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  try {
    const res = await fetch(`${cfg.url}/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-render-secret": cfg.secret,
        // Transmet l'IP réelle pour le rate-limit du worker.
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
      },
      body: JSON.stringify({ storyboard }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json().catch(() => ({ error: "BAD_WORKER_RESPONSE" }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "RENDER_WORKER_UNREACHABLE" }, { status: 502 });
  }
}
