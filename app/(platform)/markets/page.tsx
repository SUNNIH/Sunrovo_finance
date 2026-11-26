import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getTradingInstruments, getMultipleMarketTickers } from "@/lib/market/service";
import { prisma } from "@/lib/db/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MarketsList } from "./markets-list";
import { MarketsSearch } from "./markets-search";

export const metadata: Metadata = { title: "Markets" };

export const dynamic = "force-dynamic";

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string | string[] }>;
}) {
  const user = await getCurrentUser();

  // Next.js 15 requires awaiting searchParams.
  const { search: searchParam } = await searchParams;

  const search = (
    typeof searchParam === "string" ? searchParam : ""
  ).trim().toUpperCase();

  // Fetch instruments and user watchlist in parallel
  const [instruments, watchlist] = await Promise.all([
    getTradingInstruments({ activeOnly: true }),
    user
      ? prisma.watchlist.findMany({
          where: { userId: user.id },
          select: { assetSymbol: true },
        })
      : Promise.resolve([]),
  ]);

  // Filter by search if provided
  const filteredInstruments = search
    ? instruments.filter(
        (i) =>
          i.symbol.includes(search) ||
          i.baseAsset.includes(search) ||
          i.quoteAsset.includes(search)
      )
    : instruments;

  // Get symbols for ticker fetch (limit to avoid rate limits)
  const symbolsToFetch = filteredInstruments.slice(0, 50).map((i) => i.symbol);

  // Fetch tickers
  const tickersMap = await getMultipleMarketTickers(symbolsToFetch);

  // Combine data
  const marketsData = filteredInstruments.slice(0, 50).map((instrument) => {
    const ticker = tickersMap.get(instrument.symbol);
    const isWatchlisted = watchlist.some((w) => w.assetSymbol === instrument.baseAsset);

    return {
      symbol: instrument.symbol,
      baseAsset: instrument.baseAsset,
      quoteAsset: instrument.quoteAsset,
      lastPrice: ticker?.lastPrice.toString() ?? "",
priceChange24h: ticker?.priceChange24h.toString() ?? "",
priceChangePercent24h:
  ticker?.priceChangePercent24h.toString() ?? "",
volume24h: ticker?.volume24h.toString() ?? "",
      status: ticker?.status || "unavailable",
      isWatchlisted,
    };
  });

  // Safely convert market values for display-only sorting.
// Missing or invalid volumes rank below valid volumes.
const sortableVolume = (value: string): number => {
  if (!value.trim()) return -1;

  const volume = Number(value);

  return Number.isFinite(volume) && volume >= 0
    ? volume
    : -1;
};

// Sort watchlisted markets first, followed by highest volume.
const sortedMarkets = [...marketsData].sort((a, b) => {
  if (a.isWatchlisted !== b.isWatchlisted) {
    return a.isWatchlisted ? -1 : 1;
  }

  return sortableVolume(b.volume24h) - sortableVolume(a.volume24h);
});

// Include only markets with valid live prices and 24h changes.
const withValidChanges = marketsData.filter((market) => {
  const price = Number(market.lastPrice);
  const change = Number(market.priceChangePercent24h);

  return (
    market.status === "live" &&
    market.lastPrice.trim() !== "" &&
    market.priceChangePercent24h.trim() !== "" &&
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(change)
  );
});

// Only positive performers qualify as gainers.
const topGainers = withValidChanges
  .filter((market) => Number(market.priceChangePercent24h) > 0)
  .sort(
    (a, b) =>
      Number(b.priceChangePercent24h) -
      Number(a.priceChangePercent24h)
  )
  .slice(0, 3);

// Only negative performers qualify as losers.
const topLosers = withValidChanges
  .filter((market) => Number(market.priceChangePercent24h) < 0)
  .sort(
    (a, b) =>
      Number(a.priceChangePercent24h) -
      Number(b.priceChangePercent24h)
  )
  .slice(0, 3);

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Cryptocurrency Markets
          </p>
          <h1 className="mt-1 text-page-title-mobile text-text-primary sm:text-page-title">
            Markets
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Live cryptocurrency prices and 24-hour market data powered by Bybit.
          </p>
        </div>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Markets */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-secondary">
              Available Markets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-text-primary">{instruments.length}</p>
            <p className="mt-1 text-xs text-text-tertiary">Trading pairs</p>
          </CardContent>
        </Card>

        {/* Top Gainer */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success" />
              Top Gainer (Shown Markets)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topGainers[0] ? (
              <>
                <p className="text-2xl font-bold text-text-primary">
                  {topGainers[0].baseAsset}
                </p>
                <p className="mt-1 text-xs text-success">
                  +{(parseFloat(topGainers[0].priceChangePercent24h) * 100).toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-sm text-text-tertiary">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Top Loser */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-danger rotate-180" />
              Top Loser (Shown Markets)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topLosers[0] ? (
              <>
                <p className="text-2xl font-bold text-text-primary">
                  {topLosers[0].baseAsset}
                </p>
                <p className="mt-1 text-xs text-danger">
                  {(parseFloat(topLosers[0].priceChangePercent24h) * 100).toFixed(2)}%
                </p>
              </>
            ) : (
              <p className="text-sm text-text-tertiary">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <MarketsSearch initialSearch={search} />

      {/* Markets List */}
      <MarketsList markets={sortedMarkets} isAuthenticated={!!user} />
    </div>
  );
}
