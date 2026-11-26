import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getMarketTicker } from "@/lib/market/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (!symbol || !/^[A-Z0-9]{3,30}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid trading pair" }, { status: 400 });
  }
  try {
    const market = await getMarketTicker(symbol);
    const fresh = market.status === "live" && market.lastPrice.isFinite() && market.lastPrice.gt(0) &&
      Number.isFinite(market.timestamp.getTime()) &&
      Math.abs(Date.now() - market.timestamp.getTime()) <= 30_000;
    return NextResponse.json({
      lastPrice: market.lastPrice.toString(),
      status: fresh ? "live" : "stale",
      timestamp: market.timestamp.toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", lastPrice: null }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
