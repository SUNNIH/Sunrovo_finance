import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const symbol = new URL(request.url).searchParams.get("symbol")?.trim().toUpperCase();
    if (!symbol || !/^[A-Z0-9]{4,32}$/.test(symbol)) {
      return NextResponse.json({ error: "Valid symbol required" }, { status: 400 });
    }

    // IMPORTANT: Filter by user and symbol IN THE DATABASE, before limiting history.
    // The previous implementation fetched 100 orders across every pair, then
    // filtered in memory, which hid older fills for less recently traded pairs.
    const [open, history] = await Promise.all([
      prisma.cryptoOrder.findMany({
        where: { userId: user.id, symbol, status: "OPEN" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.cryptoOrder.findMany({
        where: {
          userId: user.id,
          symbol,
          status: { in: ["FILLED", "PARTIALLY_FILLED", "CANCELLED", "REJECTED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
    ]);

    // Keep the filled parent of each active protective bracket available for
    // its blue entry line even when it is older than the normal history limit.
    const missingParents = [...new Set(open.map((o) => o.parentOrderId).filter((id): id is string => !!id))]
      .filter((id) => !history.some((row) => row.id === id));
    const parents = missingParents.length > 0
      ? await prisma.cryptoOrder.findMany({
          where: { userId: user.id, symbol, id: { in: missingParents }, status: "FILLED" },
        })
      : [];
    const completeHistory = [...history, ...parents].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    const serializeOrder = (order: (typeof open)[number]) => ({
      ...order,
      quantity: order.quantity.toString(),
      limitPrice: order.limitPrice?.toString() ?? null,
      stopPrice: order.stopPrice?.toString() ?? null,
      takeProfitPrice: order.takeProfitPrice?.toString() ?? null,
      filledPrice: order.filledPrice?.toString() ?? null,
      feeAmount: order.feeAmount?.toString() ?? null,
      createdAt: order.createdAt.toISOString(),
      filledAt: order.filledAt?.toISOString() ?? null,
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
    });

    return NextResponse.json(
      { openOrders: open.map(serializeOrder), orderHistory: completeHistory.map(serializeOrder) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Failed to fetch trade orders:", error);
    return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });
  }
}
