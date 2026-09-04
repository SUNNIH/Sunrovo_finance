"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Star } from "lucide-react";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";
import { Badge } from "@/components/ui/badge";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface MarketRow {
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

type Tab = "favorites" | "all" | "gainers" | "losers";

const TABS: { id: Tab; label: string }[] = [
  { id: "favorites", label: "Favourites" },
  { id: "all", label: "All" },
  { id: "gainers", label: "Gainers" },
  { id: "losers", label: "Losers" },
];

export function MarketsClient({ initialMarkets }: { initialMarkets: MarketRow[] }) {
  const [markets, setMarkets] = React.useState(initialMarkets);
  const [tab, setTab] = React.useState<Tab>("all");
  const [search, setSearch] = React.useState("");

  const anyStale = markets.some((m) => m.isStale);

  const filtered = markets
    .filter((m) => `${m.baseAsset}${m.symbol}`.toLowerCase().includes(search.toLowerCase()))
    .filter((m) => {
      if (tab === "favorites") return m.isFavorite;
      return true;
    })
    .sort((a, b) => {
      if (tab === "gainers") return Number(b.change24hPercent) - Number(a.change24hPercent);
      if (tab === "losers") return Number(a.change24hPercent) - Number(b.change24hPercent);
      return 0;
    });

  async function toggleFavorite(baseAsset: string, event: React.MouseEvent) {
    event.preventDefault();
    setMarkets((prev) => prev.map((m) => (m.baseAsset === baseAsset ? { ...m, isFavorite: !m.isFavorite } : m)));
    try {
      await postJson("/api/watchlist", { assetSymbol: baseAsset });
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setMarkets((prev) => prev.map((m) => (m.baseAsset === baseAsset ? { ...m, isFavorite: !m.isFavorite } : m)));
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {anyStale && (
        <Badge variant="warning" className="w-fit">
          Market data temporarily delayed — showing the most recent cached prices
        </Badge>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-md border border-border bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                tab === t.id ? "bg-primary text-primary-foreground" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="search"
            placeholder="Search coins, pairs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search markets"
            className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface-elevated">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left text-label uppercase text-text-tertiary">
            <tr>
              <th className="px-4 py-2.5 font-medium">Pair</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">24h High</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">24h Low</th>
              <th className="px-4 py-2.5 text-right font-medium">Last Price</th>
              <th className="px-4 py-2.5 text-right font-medium">24h Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-secondary">
                  No markets match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.symbol} className="transition-colors duration-150 hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <Link href={`/markets/${m.symbol}`} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(m.baseAsset, e)}
                        aria-pressed={m.isFavorite}
                        aria-label={m.isFavorite ? `Remove ${m.baseAsset} from favourites` : `Add ${m.baseAsset} to favourites`}
                        className="touch-target inline-flex items-center justify-center text-text-tertiary hover:text-warning"
                      >
                        <Star className={m.isFavorite ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />
                      </button>
                      <span className="font-medium text-text-primary">
                        {m.baseAsset}/{m.quoteAsset}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-right text-text-secondary sm:table-cell">
                    <CurrencyValue amount={m.high24h} assetSymbol={m.quoteAsset} showSymbol={false} />
                  </td>
                  <td className="hidden px-4 py-3 text-right text-text-secondary sm:table-cell">
                    <CurrencyValue amount={m.low24h} assetSymbol={m.quoteAsset} showSymbol={false} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">
                    <CurrencyValue amount={m.lastPrice} assetSymbol={m.quoteAsset} showSymbol={false} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PercentChange value={Number(m.change24hPercent)} className="justify-end" />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
