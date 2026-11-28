import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getMultipleMarketTickers } from "@/lib/market/service";
import type { MarketDataStatus } from "@/lib/market/types";

/**
 * Phase 3: Cryptocurrency wallet with live market valuation
 * 
 * Displays native crypto balances with optional USDT valuation.
 * Preserves native balances during provider outages.
 * Uses Decimal arithmetic for all financial calculations.
 */

export interface WalletAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
  usdtPrice: string | null;
  usdtValue: string | null;
  priceStatus: MarketDataStatus;
}

export interface WalletView {
  walletId: string;
  assets: WalletAssetView[];
  totalUsdtValue: string | null;
  hasIncompleteValuation: boolean;
}

/**
 * Get wallet with market-based USDT valuations.
 * 
 * - Native balances are always returned regardless of market data availability
 * - USDT prices fetched from Bybit for {SYMBOL}USDT pairs
 * - Values calculated using Decimal precision
 * - Missing prices marked as unavailable, not fabricated
 */
export async function getWalletForUser(userId: string): Promise<WalletView | null> {
  const wallet = await prisma.cryptoWallet.findFirst({
    where: { userId },
    include: { balances: true },
  });

  if (!wallet) return null;

  // Filter out zero balances
  const activeBalances = wallet.balances.filter((b) =>
    b.available.greaterThan(0) || b.locked.greaterThan(0)
  );

  if (activeBalances.length === 0) {
    return {
      walletId: wallet.id,
      assets: [],
      totalUsdtValue: null,
      hasIncompleteValuation: false,
    };
  }

  // Build USDT trading pair symbols (e.g., BTCUSDT)
  const tradingPairs = activeBalances
    .filter((b) => b.assetSymbol !== "USDT") // USDT doesn't need pricing
    .map((b) => `${b.assetSymbol}USDT`);

  // Fetch market prices in parallel
  let priceMap: Map<string, { price: Decimal; status: MarketDataStatus }>;

  try {
    const tickers = await getMultipleMarketTickers(tradingPairs);
    priceMap = new Map();

    for (const [symbol, ticker] of tickers.entries()) {
      priceMap.set(symbol, {
        price: ticker.lastPrice,
        status: ticker.status,
      });
    }
  } catch (error) {
    console.error("Failed to fetch market prices for wallet:", error);
    priceMap = new Map();
  }

  // Calculate valuations
  const assets: WalletAssetView[] = [];
  let totalUsdtValue = new Decimal(0);
  let hasIncompleteValuation = false;

  for (const balance of activeBalances) {
    const totalBalance = balance.available.plus(balance.locked);

    // USDT is 1:1 with itself
    if (balance.assetSymbol === "USDT") {
      assets.push({
        assetSymbol: balance.assetSymbol,
        available: balance.available.toString(),
        locked: balance.locked.toString(),
        usdtPrice: "1.0",
        usdtValue: totalBalance.toString(),
        priceStatus: "live",
      });
      totalUsdtValue = totalUsdtValue.plus(totalBalance);
      continue;
    }

    // Lookup price for other assets
    const tradingPair = `${balance.assetSymbol}USDT`;
    const priceData = priceMap.get(tradingPair);

    if (priceData) {
      const usdtValue = totalBalance.times(priceData.price);

      assets.push({
        assetSymbol: balance.assetSymbol,
        available: balance.available.toString(),
        locked: balance.locked.toString(),
        usdtPrice: priceData.price.toString(),
        usdtValue: usdtValue.toString(),
        priceStatus: priceData.status,
      });

      // Only add to total if price is live (not stale)
      if (priceData.status === "live") {
        totalUsdtValue = totalUsdtValue.plus(usdtValue);
      } else {
        hasIncompleteValuation = true;
      }
    } else {
      // Price unavailable
      assets.push({
        assetSymbol: balance.assetSymbol,
        available: balance.available.toString(),
        locked: balance.locked.toString(),
        usdtPrice: null,
        usdtValue: null,
        priceStatus: "unavailable",
      });
      hasIncompleteValuation = true;
    }
  }

  return {
    walletId: wallet.id,
    assets,
    totalUsdtValue: hasIncompleteValuation ? null : totalUsdtValue.toString(),
    hasIncompleteValuation,
  };
}
