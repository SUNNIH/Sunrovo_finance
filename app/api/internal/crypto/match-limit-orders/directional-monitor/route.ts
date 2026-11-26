import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { checkAndCloseDirectionalPositions } from "@/features/directional/position-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Protected hook for an external cron; requires a non-empty env secret. */
export async function POST(request: NextRequest) {
  const secret = process.env.DIRECTIONAL_MONITOR_SECRET;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret) return NextResponse.json({ error: "Monitor not configured" }, { status: 503 });
  const a = Buffer.from(token), b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await checkAndCloseDirectionalPositions(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Directional Monitor] Protected invocation failed", error);
    return NextResponse.json({ error: "Monitor failed" }, { status: 500 });
  }
}
