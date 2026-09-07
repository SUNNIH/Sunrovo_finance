import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssetDetail } from "@/features/crypto/markets";
import { getWalletForUser } from "@/features/crypto/wallets";
import { evaluateAndFillOpenOrders, listOrders } from "@/features/crypto/trading";
import { getSupportedPair, SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import { TradeClient } from "./trade-client";

export const metadata: Metadata = { title: "Trade" };

interface TradePageProps {
  searchParams: Promise<{ symbol?: string; side?: string }>;
}

export default async function TradePage({ searchParams }: TradePageProps) {
  const { symbol: symbolParam, side } = await searchParams;
  const pair = getSupportedPair(symbolParam ?? "") ?? SUPPORTED_PAIRS[0]!;

  const user = await getCurrentUser();
  const detail = await getAssetDetail(pair.symbol);

  let wallet = null;
  let openOrders: Awaited<ReturnType<typeof listOrders>> = [];
  let orderHistory: Awaited<ReturnType<typeof listOrders>> = [];

  if (user) {
    await evaluateAndFillOpenOrders(user.id).catch(() => undefined);
    [wallet, openOrders, orderHistory] = await Promise.all([
      getWalletForUser(user.id),
      listOrders(user.id, "OPEN"),
      listOrders(user.id, "FILLED"),
    ]);
  }

  return (
    <TradeClient
      pair={pair}
      initialTicker={detail.ticker}
      candles={detail.candles}
      orderBook={detail.orderBook}
      trades={detail.trades}
      wallet={wallet}
      initialSide={side === "SELL" ? "SELL" : "BUY"}
      openOrders={openOrders.map((o) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        quantity: o.quantity.toString(),
        limitPrice: o.limitPrice?.toString() ?? null,
        createdAt: o.createdAt.toISOString(),
      }))}
      orderHistory={orderHistory.slice(0, 20).map((o) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        quantity: o.quantity.toString(),
        filledPrice: o.filledPrice?.toString() ?? null,
        feeAmount: o.feeAmount.toString(),
        filledAt: o.filledAt?.toISOString() ?? null,
      }))}
    />
  );
}
