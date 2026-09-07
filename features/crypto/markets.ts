import "server-only";
import { prisma } from "@/lib/db/prisma";
import { SUPPORTED_PAIRS, getSupportedPair } from "@/lib/bybit/instruments";
import { getAllTickers, getTicker, getCandles, getOrderBook, getRecentTrades } from "@/lib/bybit/client";
import type { KlineInterval } from "@/lib/bybit/types";
import { AuthError } from "@/features/authentication/errors";

export async function getMarketsList(userId?: string) {
  const [tickers, favorites] = await Promise.all([
    getAllTickers(),
    userId ? prisma.watchlist.findMany({ where: { userId } }) : Promise.resolve([]),
  ]);
  const favoriteSymbols = new Set(favorites.map((f) => f.assetSymbol));

  return tickers.map((ticker) => ({
    ...ticker,
    isFavorite: favoriteSymbols.has(ticker.baseAsset),
  }));
}

export async function getAssetDetail(symbol: string, interval: KlineInterval = "60") {
  const pair = getSupportedPair(symbol);
  if (!pair) throw new AuthError("UNSUPPORTED_SYMBOL", `${symbol} is not a supported trading pair.`, 404);

  const [ticker, candles, orderBook, trades] = await Promise.all([
    getTicker(pair.symbol),
    getCandles(pair.symbol, interval, 120),
    getOrderBook(pair.symbol),
    getRecentTrades(pair.symbol, 25),
  ]);

  return { pair, ticker, candles, orderBook, trades };
}

export async function toggleWatchlist(userId: string, assetSymbol: string): Promise<{ isFavorite: boolean }> {
  const existing = await prisma.watchlist.findUnique({
    where: { userId_assetSymbol: { userId, assetSymbol } },
  });

  if (existing) {
    await prisma.watchlist.delete({ where: { id: existing.id } });
    return { isFavorite: false };
  }

  const asset = await prisma.asset.findUnique({ where: { symbol: assetSymbol } });
  if (!asset) throw new AuthError("UNKNOWN_ASSET", `${assetSymbol} is not a recognised asset.`, 404);

  await prisma.watchlist.create({ data: { userId, assetSymbol } });
  return { isFavorite: true };
}

export async function getWatchlistSymbols(userId: string): Promise<string[]> {
  const rows = await prisma.watchlist.findMany({ where: { userId } });
  return rows.map((r) => r.assetSymbol);
}

export { SUPPORTED_PAIRS };
