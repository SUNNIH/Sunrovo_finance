"use client";

import * as React from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { useLiveTicker } from "@/lib/bybit/use-live-ticker";
import { useLiveCandles } from "@/lib/bybit/use-live-candles";
import type { MarketTicker, Candle, KlineInterval, OrderBookSnapshot, RecentTrade } from "@/lib/bybit/types";
import type { SupportedPair } from "@/lib/bybit/instruments";
import { CandlestickChart } from "@/components/charts/candlestick-chart";
import { OrderBookDisplay } from "@/components/financial/order-book-display";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface AssetDetailClientProps {
  pair: SupportedPair;
  initialTicker: MarketTicker;
  candles: Candle[];
  orderBook: OrderBookSnapshot;
  trades: RecentTrade[];
  holding: string | null;
  initialIsFavorite: boolean;
}

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">
              {pair.baseAsset}/{pair.quoteAsset}
            </h1>
            <button
              type="button"
              onClick={toggleFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? "Remove from favourites" : "Add to favourites"}
              className="touch-target inline-flex items-center justify-center text-text-tertiary hover:text-warning"
            >
              <Star className={isFavorite ? "h-5 w-5 fill-warning text-warning" : "h-5 w-5"} />
            </button>
            {isLive && (
              <Badge variant="success" className="items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" /> Live
              </Badge>
            )}
            {pair.isFictional && <Badge variant="neutral">Demo token</Badge>}
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <CurrencyValue amount={ticker.lastPrice} assetSymbol={pair.quoteAsset} className="text-2xl font-semibold text-text-primary" />
            <PercentChange value={changeValue} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/trade?symbol=${pair.symbol}&side=BUY`}>
            <Button variant="primary">Buy</Button>
          </Link>
          <Link href={`/trade?symbol=${pair.symbol}&side=SELL`}>
            <Button variant="outline">Sell</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["24h High", ticker.high24h],
          ["24h Low", ticker.low24h],
          ["24h Volume", ticker.volume24h],
          ["Your holding", holding ?? "—"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-body-sm text-text-secondary">{label}</p>
              <p className="financial-value mt-0.5 text-sm font-semibold text-text-primary">
                {value === "—" ? value : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 })}`}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap gap-1" aria-label="Chart timeframe">
            {(["1", "5", "15", "60", "240", "D"] as KlineInterval[]).map((value) => (
              <Button key={value} size="sm" variant={interval === value ? "primary" : "ghost"} onClick={() => setInterval(value)}>
                {{ "1": "1m", "5": "5m", "15": "15m", "60": "1h", "240": "4h", D: "1D" }[value]}
              </Button>
            ))}
          </div>
          <CandlestickChart candles={liveCandles} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-card-title text-text-primary">Order book</h2>
            <OrderBookDisplay orderBook={orderBook} pricePrecision={pair.pricePrecision} quantityPrecision={pair.quantityPrecision} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-card-title text-text-primary">Recent trades</h2>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-label uppercase text-text-tertiary">
                <span>Price</span>
                <span>Qty</span>
                <span>Time</span>
              </div>
              {trades.slice(0, 12).map((trade) => (
                <div key={trade.id} className="flex justify-between text-sm">
                  <span className={`financial-value ${trade.side === "BUY" ? "text-success" : "text-danger"}`}>
                    {Number(trade.price).toFixed(pair.pricePrecision)}
                  </span>
                  <span className="financial-value text-text-secondary">
                    {Number(trade.quantity).toFixed(pair.quantityPrecision)}
                  </span>
                  <span className="text-text-tertiary">
                    {new Date(trade.executedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
