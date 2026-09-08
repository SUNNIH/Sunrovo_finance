import * as React from "react";
import { ChevronDown } from "lucide-react";
import type { SupportedPair } from "@/lib/bybit/instruments";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import type { MarketTicker } from "@/lib/bybit/types";
import { CryptoAssetIcon, getCryptoAssetMeta } from "@/components/financial/crypto-asset-icon";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";
import { Badge } from "@/components/ui/badge";

interface TradeHeaderProps {
  pair: SupportedPair;
  ticker: MarketTicker;
  isLive: boolean;
  onPairChange: (symbol: string) => void;
}

export function TradeHeader({
  pair,
  ticker,
  isLive,
  onPairChange,
}: TradeHeaderProps) {
  const meta = getCryptoAssetMeta(pair.baseAsset);
  const changePercent = Number(ticker.change24hPercent);

  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-3.5 shadow-xs sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Pair selector & Current Price */}
        <div className="flex flex-wrap items-center gap-3">
          <CryptoAssetIcon symbol={pair.baseAsset} size="md" showBadge />

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <div className="relative inline-flex items-center">
                <select
                  value={pair.symbol}
                  onChange={(e) => onPairChange(e.target.value)}
                  aria-label="Select trading pair"
                  className="touch-target appearance-none rounded-lg border border-border bg-surface-elevated py-1.5 pl-3 pr-8 text-sm font-semibold text-text-primary shadow-xs transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  {SUPPORTED_PAIRS.map((p) => (
                    <option key={p.symbol} value={p.symbol}>
                      {p.baseAsset} / {p.quoteAsset}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-text-tertiary" aria-hidden="true" />
              </div>

              {/* Status Badges */}
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
              {ticker.isStale && !isLive && (
                <Badge variant="warning" className="text-xs">
                  Cached data
                </Badge>
              )}
            </div>

            <span className="text-xs text-text-tertiary mt-0.5">
              {meta.name} · Spot Simulator
            </span>
          </div>
        </div>

        {/* Current Price and 24h Change */}
        <div className="flex items-baseline gap-3">
          <CurrencyValue
            amount={ticker.lastPrice}
            assetSymbol={pair.quoteAsset}
            className="text-2xl font-bold tracking-tight text-text-primary tabular-nums sm:text-3xl"
          />
          <PercentChange value={changePercent} className="text-sm font-semibold sm:text-base" />
        </div>
      </div>

      {/* 24h Market Stats Strip */}
      <div className="grid grid-cols-2 gap-2 border-t border-border pt-3 sm:grid-cols-4 sm:gap-4">
        <div>
          <span className="text-xs text-text-tertiary block">24h High</span>
          <span className="financial-value text-xs font-medium text-text-primary tabular-nums sm:text-sm">
            {ticker.high24h === "—"
              ? "—"
              : `${Number(ticker.high24h).toFixed(pair.pricePrecision)} ${pair.quoteAsset}`}
          </span>
        </div>
        <div>
          <span className="text-xs text-text-tertiary block">24h Low</span>
          <span className="financial-value text-xs font-medium text-text-primary tabular-nums sm:text-sm">
            {ticker.low24h === "—"
              ? "—"
              : `${Number(ticker.low24h).toFixed(pair.pricePrecision)} ${pair.quoteAsset}`}
          </span>
        </div>
        <div>
          <span className="text-xs text-text-tertiary block">24h Volume</span>
          <span className="financial-value text-xs font-medium text-text-primary tabular-nums sm:text-sm">
            {ticker.volume24h === "—"
              ? "—"
              : `${Number(ticker.volume24h).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${pair.baseAsset}`}
          </span>
        </div>
        <div>
          <span className="text-xs text-text-tertiary block">Trading Fee</span>
          <span className="financial-value text-xs font-medium text-text-secondary tabular-nums sm:text-sm">
            0.1% Taker
          </span>
        </div>
      </div>
    </div>
  );
}
