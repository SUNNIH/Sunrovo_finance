import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getWalletForUser } from "@/features/crypto/wallets";
import {
  getMarketTicker,
  getCandlesticks,
  getTradingInstruments,
} from "@/lib/market/service";
import type { CandlestickInterval } from "@/lib/market/types";
import { redirect } from "next/navigation";
import { TradeClient } from "./trade-client-with-tabs";

export const metadata: Metadata = {
  title: "Trade",
};

export const dynamic = "force-dynamic";

export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; interval?: string; tab?: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { symbol: requestedSymbol, interval: requestedIntervalParam, tab: requestedTab } =
    await searchParams;

  // Default to BTCUSDT if no symbol specified
  const symbol = (requestedSymbol || "BTCUSDT").toUpperCase();
  const activeTab = requestedTab || "spot"; // "spot" or "convert"

  const allowedIntervals: CandlestickInterval[] = [
    "1m",
    "5m",
    "15m",
    "1h",
    "4h",
    "1d",
  ];

  const requestedInterval = requestedIntervalParam || "1h";
  const interval: CandlestickInterval = allowedIntervals.includes(
    requestedInterval as CandlestickInterval
  )
    ? (requestedInterval as CandlestickInterval)
    : "1h";

  // Fetch all instruments for the dropdown
  const instruments = await getTradingInstruments();
  const instrument = instruments.find((i) => i.symbol === symbol);

  if (!instrument) {
    // Fallback to BTCUSDT if invalid symbol
    redirect("/trade?symbol=BTCUSDT");
    return null;
  }

  // Fetch market data with 500 candles for better historical view
  const [ticker, candles, openOrders, orderHistory, walletData] = await Promise.all([
    getMarketTicker(symbol).catch(() => null),
    getCandlesticks(symbol, interval, { limit: 500 }).catch(() => []),
    // Scope the query to this user AND pair before applying history limits.
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
    getWalletForUser(user.id),
  ]);

  // Orders are scoped by authenticated user and selected pair.
  // Include filled parents for active protection even beyond the 500-row cap.
  const missingParents = [...new Set(openOrders.map((o) => o.parentOrderId).filter((id): id is string => !!id))]
    .filter((id) => !orderHistory.some((order) => order.id === id));
  const protectedEntries = missingParents.length > 0
    ? await prisma.cryptoOrder.findMany({
        where: { userId: user.id, symbol, id: { in: missingParents }, status: "FILLED" },
      })
    : [];
  const completeHistory = [...orderHistory, ...protectedEntries].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  // Serialize market data
  const chartCandles = candles.map((candle) => ({
    openTime: candle.openTime.toISOString(),
    open: candle.open.toString(),
    high: candle.high.toString(),
    low: candle.low.toString(),
    close: candle.close.toString(),
    volume: candle.volume.toString(),
  }));

  // Serialize orders
  const serializedOpenOrders = openOrders.map((order) => ({
    ...order,
    quantity: order.quantity.toString(),
    limitPrice: order.limitPrice?.toString() || null,
    stopPrice: order.stopPrice?.toString() || null,
    takeProfitPrice: order.takeProfitPrice?.toString() || null,
    filledPrice: order.filledPrice?.toString() || null,
    feeAmount: order.feeAmount?.toString() || null,
    createdAt: order.createdAt.toISOString(),
    filledAt: order.filledAt?.toISOString() || null,
    cancelledAt: order.cancelledAt?.toISOString() || null,
  }));

  const serializedOrderHistory = completeHistory.map((order) => ({
    ...order,
    quantity: order.quantity.toString(),
    limitPrice: order.limitPrice?.toString() || null,
    stopPrice: order.stopPrice?.toString() || null,
    takeProfitPrice: order.takeProfitPrice?.toString() || null,
    filledPrice: order.filledPrice?.toString() || null,
    feeAmount: order.feeAmount?.toString() || null,
    createdAt: order.createdAt.toISOString(),
    filledAt: order.filledAt?.toISOString() || null,
    cancelledAt: order.cancelledAt?.toISOString() || null,
  }));

  // Serialize instruments
  const serializedInstruments = instruments.map((inst) => ({
    symbol: inst.symbol,
    baseAsset: inst.baseAsset,
    quoteAsset: inst.quoteAsset,
    status: inst.status,
    pricePrecision: inst.pricePrecision,
    quantityPrecision: inst.quantityPrecision,
  }));

  // Serialize current instrument
  const serializedInstrument = {
    symbol: instrument.symbol,
    baseAsset: instrument.baseAsset,
    quoteAsset: instrument.quoteAsset,
    status: instrument.status,
    pricePrecision: instrument.pricePrecision,
    quantityPrecision: instrument.quantityPrecision,
  };

  // Serialize ticker
  const serializedTicker = ticker
    ? {
        lastPrice: ticker.lastPrice.toString(),
        priceChangePercent24h: ticker.priceChangePercent24h.toString(),
        status: ticker.status,
      }
    : null;

  return (
    <div className="animate-fade-in-up">
      <TradeClient
        key={symbol}
        initialSymbol={symbol}
        initialInterval={interval}
        initialCandles={chartCandles}
        initialTicker={serializedTicker}
        initialOpenOrders={serializedOpenOrders}
        initialOrderHistory={serializedOrderHistory}
        instrument={serializedInstrument}
        allInstruments={serializedInstruments}
        initialTab={activeTab}
        userId={user.id}
        walletData={walletData}
      />
    </div>
  );
}
