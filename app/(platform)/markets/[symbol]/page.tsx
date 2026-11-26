import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getMarketTicker,
  getCandlesticks,
  getOrderBook,
  getRecentTrades,
  getTradingInstruments,
} from "@/lib/market/service";
import type { CandlestickInterval } from "@/lib/market/types";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utilities/cn";
import { MarketChart } from "./market-chart";
import { OrderBookView } from "./order-book-view";
import { RecentTradesView } from "./recent-trades-view";
import { WatchlistToggle } from "./watchlist-toggle";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;

  return {
    title: `${symbol.toUpperCase()} Market`,
  };
}

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ interval?: string }>;
}) {
  const user = await getCurrentUser();

  const { symbol: rawSymbol } = await params;
  const { interval: requestedIntervalParam } = await searchParams;

  const symbol = rawSymbol.toUpperCase();
  const allowedIntervals: CandlestickInterval[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
];

const requestedInterval = requestedIntervalParam || "1h";

const interval: CandlestickInterval =
  allowedIntervals.includes(
    requestedInterval as CandlestickInterval
  )
    ? (requestedInterval as CandlestickInterval)
    : "1h";

  // Verify symbol exists
  const instruments = await getTradingInstruments();
  const instrument = instruments.find((i) => i.symbol === symbol);

  if (!instrument) {
    notFound();
  }

  // Fetch all market data in parallel
  const [ticker, candles, orderBook, trades, watchlistItem] = await Promise.all([
    getMarketTicker(symbol).catch(() => null),
    getCandlesticks(symbol, interval, { limit: 100 }).catch(() => []),
    getOrderBook(symbol, 20).catch(() => null),
    getRecentTrades(symbol, 50).catch(() => []),
    user
      ? prisma.watchlist.findUnique({
          where: {
            userId_assetSymbol: {
              userId: user.id,
              assetSymbol: instrument.baseAsset,
            },
          },
        })
      : null,
  ]);

  const priceChange = ticker ? parseFloat(ticker.priceChangePercent24h.toString()) : 0;
// Serialize market data before passing it to Client Components.
// Decimal objects must cross the server/client boundary as strings.

const chartCandles = candles.map((candle) => ({
  openTime: candle.openTime.toISOString(),
  open: candle.open.toString(),
  high: candle.high.toString(),
  low: candle.low.toString(),
  close: candle.close.toString(),
  volume: candle.volume.toString(),
}));

const clientOrderBook = orderBook
  ? {
      asks: orderBook.asks.map((ask) => ({
        price: ask.price.toString(),
        quantity: ask.quantity.toString(),
      })),
      bids: orderBook.bids.map((bid) => ({
        price: bid.price.toString(),
        quantity: bid.quantity.toString(),
      })),
      status: orderBook.status,
    }
  : null;

const clientTrades = trades.map((trade) => ({
  id: trade.id,
  price: trade.price.toString(),
  quantity: trade.quantity.toString(),
  side: trade.side,
  timestamp: trade.timestamp.toISOString(),
}));
  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Back Navigation */}
      <Link
        href="/markets"
        className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary-hover transition-colors w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Markets
      </Link>

      {/* Market Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-page-title-mobile sm:text-page-title text-text-primary">
              {instrument.baseAsset}/{instrument.quoteAsset}
            </h1>
            {user && (
              <WatchlistToggle
                baseAsset={instrument.baseAsset}
                initialWatchlisted={!!watchlistItem}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-text-tertiary">{symbol}</p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2">
          {ticker ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-text-primary tabular-nums">
                  {ticker.lastPrice.toFixed(instrument.pricePrecision)}
                </span>
                <span className="text-sm text-text-tertiary">
                  {instrument.quoteAsset}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {priceChange > 0 ? (
                  <TrendingUp className="h-4 w-4 text-success" />
                ) : priceChange < 0 ? (
                  <TrendingDown className="h-4 w-4 text-danger" />
                ) : null}
                <span
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    priceChange > 0 ? "text-success" : priceChange < 0 ? "text-danger" : "text-text-tertiary"
                  )}
                >
                  {priceChange > 0 ? "+" : ""}
                  {(priceChange * 100).toFixed(2)}% (24h)
                </span>
              </div>
            </>
          ) : (
            <Badge variant="danger">Price Unavailable</Badge>
          )}
        </div>
      </div>

      {/* Market Stats */}
      {ticker && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-text-tertiary">24h High</p>
              <p className="mt-1 text-lg font-semibold text-text-primary tabular-nums">
                {ticker.high24h.toFixed(instrument.pricePrecision)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-text-tertiary">24h Low</p>
              <p className="mt-1 text-lg font-semibold text-text-primary tabular-nums">
                {ticker.low24h.toFixed(instrument.pricePrecision)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-text-tertiary">24h Volume</p>
              <p className="mt-1 text-lg font-semibold text-text-primary tabular-nums">
                {ticker.volume24h.toFixed(2)} {instrument.baseAsset}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-text-tertiary">24h Turnover</p>
              <p className="mt-1 text-lg font-semibold text-text-primary tabular-nums">
                {ticker.quoteVolume24h.toFixed(2)} {instrument.quoteAsset}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Price Chart</CardTitle>
        </CardHeader>
        <CardContent>
          <MarketChart
            symbol={symbol}
            candles={chartCandles}
            currentInterval={interval}
            pricePrecision={instrument.pricePrecision}
            liveTicker={
              ticker
                ? {
                    lastPrice: ticker.lastPrice.toString(),
                    status: ticker.status,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Order Book and Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Order Book */}
        <Card>
          <CardHeader>
            <CardTitle>Order Book</CardTitle>
          </CardHeader>
          <CardContent>
            {clientOrderBook ? (
              <OrderBookView
                orderBook={clientOrderBook}
                pricePrecision={instrument.pricePrecision}
                quantityPrecision={instrument.quantityPrecision}
              />
            ) : (
              <p className="text-sm text-text-tertiary text-center py-8">
                Order book unavailable
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Trades</CardTitle>
          </CardHeader>
          <CardContent>
            {trades.length > 0 ? (
              <RecentTradesView
                trades={clientTrades}
                pricePrecision={instrument.pricePrecision}
                quantityPrecision={instrument.quantityPrecision}
              />
            ) : (
              <p className="text-sm text-text-tertiary text-center py-8">
                No recent trades available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trading Panel */}
      {user && ticker && (
        <Card>
          <CardHeader>
            <CardTitle>Start Trading</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-sm text-text-tertiary">
                Trade {instrument.baseAsset}/{instrument.quoteAsset} with market and limit orders
              </p>
              <Link href={`/trade?symbol=${symbol}&interval=${interval}`}>
                <Button size="lg" className="w-full sm:w-auto">
                  Trade {symbol}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
