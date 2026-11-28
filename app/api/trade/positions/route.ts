import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { isDirectionalTradingEnabled, serializeDirectionalPosition } from "@/features/directional/positions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const symbol = request.nextUrl.searchParams.get("symbol")?.toUpperCase();
  if (symbol && !/^[A-Z0-9]{3,30}$/.test(symbol)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  const positions = await prisma.directionalPosition.findMany({
    where: { userId: user.id, ...(symbol ? { symbol } : {}) },
    orderBy: { openedAt: "desc" }, take: 150,
  });
  return NextResponse.json({
    positions: positions.map(serializeDirectionalPosition),
    tradingEnabled: isDirectionalTradingEnabled(),
  }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
