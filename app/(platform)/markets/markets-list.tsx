"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utilities/cn";
import { toggleWatchlist } from "./actions";

interface MarketData {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  lastPrice: string;
  priceChange24h: string;
  priceChangePercent24h: string;
  volume24h: string;
  status: string;
  isWatchlisted: boolean;
}

// A missing market value is not zero. Stale values remain visible with a Stale label.
function hasMarketValue(market: MarketData, value: string): boolean {
  return (
    (market.status === "live" || market.status === "stale") &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  );
}

export function MarketsList({
  markets,
  isAuthenticated,
}: {
  markets: MarketData[];
  isAuthenticated: boolean;
}) {
  const [localWatchlist, setLocalWatchlist] = useState<Set<string>>(
    new Set(markets.filter((m) => m.isWatchlisted).map((m) => m.baseAsset))
  );
  const [togglingSymbol, setTogglingSymbol] = useState<string | null>(null);
  const [watchlistError, setWatchlistError] = useState<string | null>(null);

  const handleToggleWatchlist = async (baseAsset: string, currentlyWatchlisted: boolean) => {
    if (!isAuthenticated || togglingSymbol !== null) return;

    setWatchlistError(null);
    setTogglingSymbol(baseAsset);

    // Optimistic update. Functional state updates preserve unrelated favorites.
    const setSymbolWatchlisted = (watchlisted: boolean) => {
      setLocalWatchlist((previous) => {
        const next = new Set(previous);
        if (watchlisted) next.add(baseAsset);
        else next.delete(baseAsset);
        return next;
      });
    };

    setSymbolWatchlisted(!currentlyWatchlisted);

    try {
      const result = await toggleWatchlist(baseAsset, !currentlyWatchlisted);
      if (!result.success) {
        setSymbolWatchlisted(currentlyWatchlisted);
        setWatchlistError(result.error ?? "Could not update your watchlist.");
      }
    } catch {
      setSymbolWatchlisted(currentlyWatchlisted);
      setWatchlistError("Could not update your watchlist. Please try again.");
    } finally {
      setTogglingSymbol(null);
    }
  };

  if (markets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-secondary">
          No markets found. Try a different search term.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      {watchlistError && (
        <p role="alert" className="border-b border-border bg-danger-soft px-4 py-3 text-sm text-danger">
          {watchlistError}
        </p>
      )}
      {/* Desktop Table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-surface-elevated">
              <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {isAuthenticated && <span className="w-6 inline-block"></span>}
                Market
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Last Price
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                24h Change
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wider">
                24h Volume
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {markets.map((market) => {
              const priceChange = parseFloat(market.priceChangePercent24h);
              const isWatchlisted = localWatchlist.has(market.baseAsset);

              return (
                <tr
                  key={market.symbol}
                  className="hover:bg-surface-hover transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isAuthenticated && (
                        <button
                          onClick={() => handleToggleWatchlist(market.baseAsset, isWatchlisted)}
                          disabled={togglingSymbol !== null}
                          className={cn(
                            "transition-colors",
                            isWatchlisted ? "text-warning" : "text-text-tertiary hover:text-text-secondary"
                          )}
                          aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                        >
                          <Star
                            className="h-4 w-4"
                            fill={isWatchlisted ? "currentColor" : "none"}
                          />
                        </button>
                      )}
                      <Link
                        href={`/markets/${market.symbol}`}
                        className="hover:text-primary transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-text-primary">
                            {market.baseAsset}/{market.quoteAsset}
                          </p>
                          <p className="text-xs text-text-tertiary">{market.symbol}</p>
                        </div>
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono text-sm text-text-primary tabular-nums">
                      {hasMarketValue(market, market.lastPrice)
                        ? parseFloat(market.lastPrice).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 8,
                          })
                        : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {hasMarketValue(market, market.priceChangePercent24h) ? (
                      <div className="flex items-center justify-end gap-1">
                        {priceChange > 0 ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : priceChange < 0 ? (
                          <TrendingDown className="h-3 w-3 text-danger" />
                        ) : (
                          <Minus className="h-3 w-3 text-text-tertiary" />
                        )}
                        <span
                          className={cn(
                            "font-mono text-sm tabular-nums",
                            priceChange > 0 ? "text-success" : priceChange < 0 ? "text-danger" : "text-text-tertiary"
                          )}
                        >
                          {priceChange > 0 ? "+" : ""}
                          {(priceChange * 100).toFixed(2)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-text-tertiary">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-mono text-sm text-text-tertiary tabular-nums">
                      {hasMarketValue(market, market.volume24h)
                        ? parseFloat(market.volume24h).toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })
                        : "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        market.status === "live" && "bg-success-soft text-success",
                        market.status === "stale" && "bg-warning-soft text-warning",
                        market.status === "unavailable" && "bg-danger-soft text-danger"
                      )}
                    >
                      {market.status === "live" ? "Live" : market.status === "stale" ? "Stale" : "Unavailable"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden divide-y divide-border">
        {markets.map((market) => {
          const priceChange = parseFloat(market.priceChangePercent24h);
          const isWatchlisted = localWatchlist.has(market.baseAsset);

          return (
            <div key={market.symbol} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <Link href={`/markets/${market.symbol}`}>
                  <div>
                    <p className="font-semibold text-text-primary">
                      {market.baseAsset}/{market.quoteAsset}
                    </p>
                    <p className="text-xs text-text-tertiary">{market.symbol}</p>
                  </div>
                </Link>
                <div className="flex items-center gap-2">
                  {hasMarketValue(market, market.priceChangePercent24h) && (
                    <div className="flex items-center gap-1">
                      {priceChange > 0 ? (
                        <TrendingUp className="h-3 w-3 text-success" />
                      ) : priceChange < 0 ? (
                        <TrendingDown className="h-3 w-3 text-danger" />
                      ) : null}
                      <span
                        className={cn(
                          "font-mono text-sm tabular-nums",
                          priceChange > 0 ? "text-success" : priceChange < 0 ? "text-danger" : "text-text-tertiary"
                        )}
                      >
                        {priceChange > 0 ? "+" : ""}
                        {(priceChange * 100).toFixed(2)}%
                      </span>
                    </div>
                  )}
                  {market.status !== "live" && (
                    <span
                      className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                        market.status === "stale" && "bg-warning-soft text-warning",
                        market.status !== "stale" && "bg-danger-soft text-danger"
                      )}
                    >
                      {market.status === "stale" ? "Stale" : "Unavailable"}
                    </span>
                  )}
                  {isAuthenticated && (
                    <button
                      onClick={() => handleToggleWatchlist(market.baseAsset, isWatchlisted)}
                      disabled={togglingSymbol !== null}
                      aria-label={isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}
                      className={cn(
                        "transition-colors",
                        isWatchlisted ? "text-warning" : "text-text-tertiary"
                      )}
                    >
                      <Star
                        className="h-4 w-4"
                        fill={isWatchlisted ? "currentColor" : "none"}
                      />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Price:</span>
                  <span className="font-mono text-text-primary tabular-nums">
                    {hasMarketValue(market, market.lastPrice)
                      ? parseFloat(market.lastPrice).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 8,
                        })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-tertiary">Volume:</span>
                  <span className="font-mono text-text-tertiary tabular-nums">
                    {hasMarketValue(market, market.volume24h)
                      ? parseFloat(market.volume24h).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
