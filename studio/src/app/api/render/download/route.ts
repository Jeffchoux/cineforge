import { NextRequest, NextResponse } from "next/server";
import { workerConfig, isJobId } from "@/lib/render/worker";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/render/download?id=<uuid>  ->  le MP4 (proxy streaming depuis le VPS).
 * 409 tant que le rendu n'est pas terminé.
 */
export async function GET(request: NextRequest) {
  const cfg = workerConfig();
  if (!cfg) return NextResponse.json({ error: "RENDER_UNAVAILABLE" }, { status: 501 });

  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!isJobId(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });

  let res: Response;
  try {
    res = await fetch(`${cfg.url}/jobs/${id}/mp4`, {
      headers: { "x-render-secret": cfg.secret },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return NextResponse.json({ error: "RENDER_WORKER_UNREACHABLE" }, { status: 502 });
  }

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({ error: "NOT_READY" }));
    return NextResponse.json(data, { status: res.status || 502 });
  }

  // Passe le flux vidéo tel quel au navigateur.
  return new NextResponse(res.body, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Disposition": res.headers.get("content-disposition") ?? `attachment; filename="cineforge-${id.slice(0, 8)}.mp4"`,
      "Cache-Control": "no-store",
    },
  });
}
