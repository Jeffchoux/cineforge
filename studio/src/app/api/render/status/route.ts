import { NextRequest, NextResponse } from "next/server";
import { workerConfig, isJobId } from "@/lib/render/worker";

export const runtime = "nodejs";

/** GET /api/render/status?id=<uuid>  ->  { status, progress, error? } */
export async function GET(request: NextRequest) {
  const cfg = workerConfig();
  if (!cfg) return NextResponse.json({ error: "RENDER_UNAVAILABLE" }, { status: 501 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!isJobId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  try {
    const res = await fetch(`${cfg.url}/jobs/${id}`, {
      headers: { "x-render-secret": cfg.secret },
      signal: AbortSignal.timeout(10_000),
    });
    const data = await res.json().catch(() => ({ error: "BAD_WORKER_RESPONSE" }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "RENDER_WORKER_UNREACHABLE" }, { status: 502 });
  }
}
