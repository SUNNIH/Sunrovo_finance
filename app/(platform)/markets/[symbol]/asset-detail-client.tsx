"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronRight,
  Star,
  Wallet,
} from "lucide-react";
import { useLiveTicker } from "@/lib/bybit/use-live-ticker";
import { useLiveCandles } from "@/lib/bybit/use-live-candles";
import type {
  MarketTicker,
  Candle,
  KlineInterval,
  OrderBookSnapshot,
  RecentTrade,
} from "@/lib/bybit/types";
import type { SupportedPair } from "@/lib/bybit/instruments";
import { CandlestickChart } from "@/components/charts/candlestick-chart";
import { OrderBookDisplay } from "@/components/financial/order-book-display";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";
import { CryptoAssetIcon, getCryptoAssetMeta } from "@/components/financial/crypto-asset-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { cn } from "@/lib/utilities/cn";

interface AssetDetailClientProps {
  pair: SupportedPair;
  initialTicker: MarketTicker;
  candles: Candle[];
  orderBook: OrderBookSnapshot;
  trades: RecentTrade[];
  holding: string | null;
  initialIsFavorite: boolean;
}

const INTERVALS: { id: KlineInterval; label: string }[] = [
  { id: "1", label: "1m" },
  { id: "5", label: "5m" },
  { id: "15", label: "15m" },
  { id: "60", label: "1h" },
  { id: "240", label: "4h" },
  { id: "D", label: "1D" },
];

export function AssetDetailClient({
  pair,
  initialTicker,
  candles,
  orderBook,
  trades,
  holding,
  initialIsFavorite,
}: AssetDetailClientProps) {
  const { ticker, isLive } = useLiveTicker(pair.symbol, initialTicker);
  const [interval, setInterval] = React.useState<KlineInterval>("60");
  const liveCandles = useLiveCandles(pair.symbol, interval, candles);
  const [isFavorite, setIsFavorite] = React.useState(initialIsFavorite);

  const meta = getCryptoAssetMeta(pair.baseAsset);

  async function toggleFavorite() {
    const next = !isFavorite;
    setIsFavorite(next);
    try {
      await postJson("/api/watchlist", { assetSymbol: pair.baseAsset });
    } catch (error) {
      if (error instanceof ApiRequestError) setIsFavorite(!next);
    }
  }

  const changeValue = Number(ticker.change24hPercent);
  const holdingNum = holding !== null ? Number(holding) : 0;
  const hasHolding = holdingNum > 0;
  const holdingEstUsd = hasHolding ? (holdingNum * Number(ticker.lastPrice)).toFixed(2) : "0.00";

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* ── Breadcrumb Navigation ───────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-tertiary">
        <Link href="/markets" className="transition-colors hover:text-text-primary">
          Markets
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-text-primary">
          {pair.baseAsset}/{pair.quoteAsset}
        </span>
      </nav>

      {/* ── Asset Header & Price Banner ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <CryptoAssetIcon symbol={pair.baseAsset} size="lg" showBadge />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">
                {pair.baseAsset}/{pair.quoteAsset}
              </h1>
              <button
                type="button"
                onClick={toggleFavorite}
                aria-pressed={isFavorite}
                aria-label={isFavorite ? `Remove ${pair.baseAsset} from favourites` : `Add ${pair.baseAsset} to favourites`}
                className="touch-target inline-flex items-center justify-center text-text-tertiary hover:text-warning"
              >
                <Star
                  className={cn(
                    "h-5 w-5 transition-transform active:scale-125",
                    isFavorite ? "fill-warning text-warning" : "text-text-tertiary"
                  )}
                />
              </button>

              {/* Verified Live WebSocket Status — strictly from useLiveTicker */}
              {isLive && (
                <Badge variant="success" className="items-center gap-1.5 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  Live Stream
                </Badge>
              )}

              {pair.isFictional && (
                <Badge variant="neutral" className="text-xs">
                  Demo token
                </Badge>
              )}
            </div>

            <p className="text-xs text-text-tertiary mt-0.5">
              {meta.name} · Spot Market
            </p>

            <div className="mt-2.5 flex flex-wrap items-baseline gap-3">
              <CurrencyValue
                amount={ticker.lastPrice}
                assetSymbol={pair.quoteAsset}
                className="text-3xl font-bold tracking-tight text-text-primary tabular-nums"
              />
              <PercentChange value={changeValue} className="text-base" />
            </div>
          </div>
        </div>

        {/* Primary Trading CTAs */}
        <div className="flex items-center gap-2.5 sm:mt-1">
          <Link href={`/trade?symbol=${pair.symbol}&side=BUY`}>
            <Button variant="primary" size="lg" className="min-w-[5.5rem] touch-target">
              Buy {pair.baseAsset}
            </Button>
          </Link>
          <Link href={`/trade?symbol=${pair.symbol}&side=SELL`}>
            <Button variant="outline" size="lg" className="min-w-[5.5rem] touch-target">
              Sell
            </Button>
          </Link>
        </div>
      </div>

      {/* ── 24h Stats Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["24h High", ticker.high24h],
          ["24h Low", ticker.low24h],
          ["24h Volume", ticker.volume24h],
          [
            "24h Range",
            (Number(ticker.high24h) - Number(ticker.low24h)).toFixed(pair.pricePrecision),
          ],
        ].map(([label, value]) => (
          <Card key={label} className="rounded-xl border-border bg-surface-elevated shadow-xs">
            <CardContent className="p-3.5">
              <p className="text-body-sm text-text-secondary">{label}</p>
              <p className="financial-value mt-1 text-sm font-semibold text-text-primary tabular-nums">
                {value === "—"
                  ? value
                  : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── User Position / Holding Card (if user holds this asset) ─────────── */}
      {hasHolding && (
        <Card className="rounded-xl border-primary/20 bg-primary-soft/30 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Your Spot Position
                </p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-lg font-bold text-text-primary financial-value">
                    {holding} {pair.baseAsset}
                  </span>
                  <span className="text-xs text-text-tertiary financial-value">
                    (≈ ${holdingEstUsd} USD)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Link href={`/trade?symbol=${pair.symbol}`}>
                <Button variant="primary" size="sm">
                  Trade Position
                </Button>
              </Link>
              <Link href="/convert">
                <Button variant="outline" size="sm">
                  Convert
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── Interactive Candlestick Chart ────────────────────────────────────── */}
      <Card className="rounded-xl border-border bg-surface-elevated shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-card-title text-text-primary">Price Action</h2>
              <span className="text-xs text-text-tertiary">· Candlestick (OHLC)</span>
            </div>

            {/* Timeframe Interval Buttons */}
            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1" aria-label="Chart timeframe">
              {INTERVALS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setInterval(item.id)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    interval === item.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/60"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <CandlestickChart candles={liveCandles} />
        </CardContent>
      </Card>

      {/* ── Order Book & Recent Trades Side-by-Side ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Order Book */}
        <Card className="rounded-xl border-border bg-surface-elevated shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-card-title text-text-primary">Order Book Depth</h2>
              <span className="text-xs text-text-tertiary">Simulated Snapshot</span>
            </div>
            <OrderBookDisplay
              orderBook={orderBook}
              pricePrecision={pair.pricePrecision}
              quantityPrecision={pair.quantityPrecision}
            />
          </CardContent>
        </Card>

        {/* Recent Market Trades */}
        <Card className="rounded-xl border-border bg-surface-elevated shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-card-title text-text-primary">Recent Trades</h2>
              <span className="text-xs text-text-tertiary">Latest Activity</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-label uppercase text-text-tertiary px-1 pb-1 border-b border-border">
                <span>Price ({pair.quoteAsset})</span>
                <span className="text-right">Size ({pair.baseAsset})</span>
                <span className="text-right">Execution Time</span>
              </div>
              {trades.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-secondary">
                  No recent trades recorded for this market.
                </p>
              ) : (
                trades.slice(0, 12).map((trade) => (
                  <div
                    key={trade.id}
                    className="flex justify-between text-xs py-1 px-1 rounded-sm hover:bg-surface-hover/60 transition-colors"
                  >
                    <span
                      className={cn(
                        "financial-value font-medium",
                        trade.side === "BUY" ? "text-success" : "text-danger"
                      )}
                    >
                      {Number(trade.price).toFixed(pair.pricePrecision)}
                    </span>
                    <span className="financial-value text-right text-text-secondary">
                      {Number(trade.quantity).toFixed(pair.quantityPrecision)}
                    </span>
                    <span className="text-right text-text-tertiary font-mono">
                      {new Date(trade.executedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
