"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Star, X } from "lucide-react";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";
import { CryptoAssetIcon, getCryptoAssetMeta } from "@/components/financial/crypto-asset-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { cn } from "@/lib/utilities/cn";

export interface MarketRow {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  lastPrice: string;
  change24hPercent: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  isStale: boolean;
  isFavorite: boolean;
}

type Tab = "all" | "favorites" | "gainers" | "losers";

export function MarketsClient({ initialMarkets }: { initialMarkets: MarketRow[] }) {
  const [markets, setMarkets] = React.useState(initialMarkets);
  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");

  const anyStale = markets.some((m) => m.isStale);
  const favoriteCount = markets.filter((m) => m.isFavorite).length;

  // Derive presentation-only overview stats strictly from current markets data
  const topGainer = React.useMemo(() => {
    if (markets.length === 0) return null;
    return [...markets].sort((a, b) => Number(b.change24hPercent) - Number(a.change24hPercent))[0] ?? null;
  }, [markets]);

  const volumeLeader = React.useMemo(() => {
    if (markets.length === 0) return null;
    return [...markets].sort((a, b) => Number(b.volume24h) - Number(a.volume24h))[0] ?? null;
  }, [markets]);

  const filtered = markets
    .filter((m) => `${m.baseAsset}${m.symbol}${m.quoteAsset}`.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => {
      if (tab === "favorites") return m.isFavorite;
      if (tab === "gainers") return Number(m.change24hPercent) > 0;
      if (tab === "losers") return Number(m.change24hPercent) < 0;
      return true;
    })
    .sort((a, b) => {
      if (tab === "gainers") return Number(b.change24hPercent) - Number(a.change24hPercent);
      if (tab === "losers") return Number(a.change24hPercent) - Number(b.change24hPercent);
      return 0;
    });

  async function toggleFavorite(baseAsset: string, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setMarkets((prev) => prev.map((m) => (m.baseAsset === baseAsset ? { ...m, isFavorite: !m.isFavorite } : m)));
    try {
      await postJson("/api/watchlist", { assetSymbol: baseAsset });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMarkets((prev) => prev.map((m) => (m.baseAsset === baseAsset ? { ...m, isFavorite: !m.isFavorite } : m)));
      }
    }
  }

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: "all", label: "All Pairs", count: markets.length },
    { id: "favorites", label: "Favourites", count: favoriteCount },
    { id: "gainers", label: "Gainers", count: markets.filter((m) => Number(m.change24hPercent) > 0).length },
    { id: "losers", label: "Losers", count: markets.filter((m) => Number(m.change24hPercent) < 0).length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ── Market Overview Cards Strip ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Tracked pairs */}
        <Card className="rounded-xl border-border bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <p className="text-body-sm text-text-secondary">Tracked Spot Pairs</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-text-primary tabular-nums">
                {markets.length}
              </span>
              <span className="text-xs text-text-tertiary">Active instruments</span>
            </div>
          </CardContent>
        </Card>

        {/* Top gainer */}
        <Card className="rounded-xl border-border bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <p className="text-body-sm text-text-secondary">24h Top Gainer</p>
            <div className="mt-1 flex items-center justify-between">
              {topGainer ? (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text-primary">
                    {topGainer.baseAsset}/{topGainer.quoteAsset}
                  </span>
                  <PercentChange value={Number(topGainer.change24hPercent)} />
                </div>
              ) : (
                <span className="text-sm text-text-tertiary">—</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Volume leader */}
        <Card className="rounded-xl border-border bg-surface-elevated shadow-xs">
          <CardContent className="p-4">
            <p className="text-body-sm text-text-secondary">24h Volume Leader</p>
            <div className="mt-1 flex items-center justify-between">
              {volumeLeader ? (
                <div>
                  <span className="font-semibold text-text-primary">
                    {volumeLeader.baseAsset}/{volumeLeader.quoteAsset}
                  </span>
                  <span className="ml-2 font-mono text-xs text-text-tertiary tabular-nums">
                    {Number(volumeLeader.volume24h).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-text-tertiary">—</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Stale Data Notice (non-alarmist banking disclosure) ─────────────── */}
      {anyStale && (
        <div className="flex items-center gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-4 py-2.5 text-xs text-warning">
          <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
          <span>
            Market data temporarily running on cached quotes. Spot trading remains active.
          </span>
        </div>
      )}

      {/* ── Filter Tabs & Search Bar ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Filter Pills */}
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1 scrollbar-none">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover/70"
              )}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums",
                    tab === t.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-surface-hover text-text-tertiary"
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search Field with clear button */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            placeholder="Search coin or pair..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search markets"
            className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-8 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Desktop & Tablet Table View ─────────────────────────────────────── */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left text-label uppercase text-text-tertiary">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Market Pair</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Last Price</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">24h Change</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">24h High</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">24h Low</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">24h Volume</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-text-secondary">
                  {tab === "favorites" ? (
                    <div className="flex flex-col items-center gap-2">
                      <Star className="h-8 w-8 text-text-tertiary" />
                      <p className="font-medium text-text-primary">No favourites saved yet</p>
                      <p className="text-xs text-text-tertiary max-w-xs">
                        Click the star icon next to any market pair to quickly track it here.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Search className="h-8 w-8 text-text-tertiary" />
                      <p className="font-medium text-text-primary">No matching markets found</p>
                      <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-1">
                        Clear Search
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((m) => {
                const meta = getCryptoAssetMeta(m.baseAsset);
                return (
                  <tr
                    key={m.symbol}
                    className="group transition-colors duration-150 hover:bg-surface-hover/70"
                  >
                    {/* Pair Identity with Favorite control */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(m.baseAsset, e)}
                          aria-pressed={m.isFavorite}
                          aria-label={m.isFavorite ? `Remove ${m.baseAsset} from favourites` : `Add ${m.baseAsset} to favourites`}
                          className="touch-target inline-flex items-center justify-center text-text-tertiary transition-colors hover:text-warning"
                        >
                          <Star
                            className={cn(
                              "h-4 w-4 transition-transform active:scale-125",
                              m.isFavorite ? "fill-warning text-warning" : "text-text-tertiary hover:text-text-secondary"
                            )}
                          />
                        </button>
                        <Link href={`/markets/${m.symbol}`} className="flex items-center gap-3">
                          <CryptoAssetIcon symbol={m.baseAsset} size="md" showBadge />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-text-primary group-hover:text-primary transition-colors">
                                {m.baseAsset}/{m.quoteAsset}
                              </span>
                              {meta.isFictional && (
                                <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                                  Demo token
                                </Badge>
                              )}
                            </div>
                            <p className="text-body-sm text-text-tertiary">
                              {meta.name}
                            </p>
                          </div>
                        </Link>
                      </div>
                    </td>

                    {/* Last Price */}
                    <td className="px-4 py-3.5 text-right font-semibold text-text-primary tabular-nums">
                      <CurrencyValue amount={m.lastPrice} assetSymbol={m.quoteAsset} showSymbol={false} />
                    </td>

                    {/* 24h Change */}
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex justify-end">
                        <PercentChange value={Number(m.change24hPercent)} />
                      </div>
                    </td>

                    {/* 24h High */}
                    <td className="px-4 py-3.5 text-right text-text-secondary tabular-nums">
                      <CurrencyValue amount={m.high24h} assetSymbol={m.quoteAsset} showSymbol={false} />
                    </td>

                    {/* 24h Low */}
                    <td className="px-4 py-3.5 text-right text-text-secondary tabular-nums">
                      <CurrencyValue amount={m.low24h} assetSymbol={m.quoteAsset} showSymbol={false} />
                    </td>

                    {/* 24h Volume */}
                    <td className="px-4 py-3.5 text-right text-text-secondary tabular-nums">
                      {Number(m.volume24h).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/trade?symbol=${m.symbol}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary"
                          >
                            Trade
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Card List View (< 640px) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {filtered.length === 0 ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="p-8 text-center text-text-secondary">
              {tab === "favorites" ? (
                <div className="flex flex-col items-center gap-2">
                  <Star className="h-8 w-8 text-text-tertiary" />
                  <p className="font-medium text-text-primary">No favourites saved</p>
                  <p className="text-xs text-text-tertiary">
                    Tap the star on any pair to pin it to favourites.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-text-tertiary" />
                  <p className="font-medium text-text-primary">No matching markets</p>
                  <Button variant="outline" size="sm" onClick={() => setSearch("")} className="mt-1">
                    Clear Search
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map((m) => {
            const meta = getCryptoAssetMeta(m.baseAsset);
            return (
              <Card
                key={m.symbol}
                className="rounded-xl border-border bg-surface-elevated p-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => toggleFavorite(m.baseAsset, e)}
                      aria-pressed={m.isFavorite}
                      aria-label={m.isFavorite ? `Remove ${m.baseAsset} from favourites` : `Add ${m.baseAsset} to favourites`}
                      className="touch-target -ml-1 inline-flex items-center justify-center text-text-tertiary hover:text-warning"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          m.isFavorite ? "fill-warning text-warning" : "text-text-tertiary"
                        )}
                      />
                    </button>
                    <Link href={`/markets/${m.symbol}`} className="flex items-center gap-2.5">
                      <CryptoAssetIcon symbol={m.baseAsset} size="md" showBadge />
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-semibold text-text-primary">
                            {m.baseAsset}/{m.quoteAsset}
                          </span>
                          {meta.isFictional && (
                            <Badge variant="neutral" className="text-[9px] py-0 px-1">
                              Demo
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-text-tertiary">{meta.name}</p>
                      </div>
                    </Link>
                  </div>

                  <div className="text-right">
                    <CurrencyValue
                      amount={m.lastPrice}
                      assetSymbol={m.quoteAsset}
                      showSymbol={false}
                      className="text-base font-bold text-text-primary tabular-nums"
                    />
                    <div className="mt-0.5 flex justify-end">
                      <PercentChange value={Number(m.change24hPercent)} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-xs text-text-tertiary">
                  <span>24h Vol: <span className="font-mono text-text-secondary">{Number(m.volume24h).toLocaleString(undefined, { maximumFractionDigits: 1 })}</span></span>
                  <div className="flex gap-2">
                    <Link href={`/markets/${m.symbol}`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
                        Details
                      </Button>
                    </Link>
                    <Link href={`/trade?symbol=${m.symbol}`}>
                      <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs">
                        Trade
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
