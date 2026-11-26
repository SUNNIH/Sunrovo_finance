import "server-only";
import { prisma } from "@/lib/db/prisma";
import { getMarketTicker } from "@/lib/market/service";
import { calculatePositionValue, findTriggeredExit } from "./position-math";
import { closeDirectionalPosition } from "./positions";

/**
 * Scan open positions and close any that crossed TP, SL, or liquidation.
 * A single conditional close and the release of collateral are atomic.
 * Requires a RUNNING scheduler / protected cron; not called by page render.
 */
export async function checkAndCloseDirectionalPositions(): Promise<{
  checked: number; triggered: number; failed: number; skipped: number;
}> {
  const result = { checked: 0, triggered: 0, failed: 0, skipped: 0 };
  let cursor: string | undefined;
  const marks = new Map<string, Awaited<ReturnType<typeof getMarketTicker>> | null>();
  for (;;) {
    const page = await prisma.directionalPosition.findMany({
      where: { status: "OPEN" }, orderBy: { id: "asc" }, take: 100,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    cursor = page[page.length - 1]!.id;
    for (const p of page) {
      result.checked++;
      if (!marks.has(p.symbol)) {
        try { marks.set(p.symbol, await getMarketTicker(p.symbol)); }
        catch { marks.set(p.symbol, null); }
      }
      const ticker = marks.get(p.symbol);
      if (!ticker || ticker.status !== "live" || !ticker.lastPrice.isFinite() || ticker.lastPrice.lte(0) ||
          !Number.isFinite(ticker.timestamp.getTime()) ||
          Math.abs(Date.now() - ticker.timestamp.getTime()) > 30_000) {
        result.skipped++;
        continue;
      }
      try {
        const valuation = calculatePositionValue({
          direction: p.side, entryPrice: p.entryPrice, currentPrice: ticker.lastPrice,
          quantity: p.quantity, collateral: p.margin, exitFeeRate: "0.001", maintenanceMarginRate: "0.005",
        });
        const trigger = valuation.liquidatable ? "LIQUIDATION" : findTriggeredExit({
          direction: p.side, entryPrice: p.entryPrice, currentPrice: ticker.lastPrice,
          stopLossPrice: p.stopLossPrice, takeProfitPrice: p.takeProfitPrice,
        });
        if (!trigger) continue;
        const closed = await closeDirectionalPosition({
          positionId: p.id, reason: trigger, expectedSide: p.side, expectedTrigger: trigger,
          // Pass the SAME server-observed quote used to detect TP/SL/liquidation.
          // This is never supplied by a client request.
          observedTrigger: { symbol: p.symbol, price: ticker.lastPrice.toString(), timestamp: ticker.timestamp.toISOString() },
          idempotencyKey: `directional-close:${p.id}:${trigger}`,
        });
        if (closed.success) result.triggered++;
        else {
          result.failed++;
          console.warn(`[Directional] Position ${p.id} could not be closed: ${closed.error}`);
        }
      } catch (error) {
        result.failed++;
        console.error(`[Directional] Monitor failed for position ${p.id}`, error);
      }
    }
    if (page.length < 100) break;
  }
  return result;
}
