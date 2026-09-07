import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getTicker } from "@/lib/bybit/client";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";

export interface WalletAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
  usdValue: string;
}

/** Approximate USD value for a held asset — USDT is 1:1, others price off their *USDT pair. */
async function getUsdValue(assetSymbol: string, amount: Decimal): Promise<Decimal> {
  if (assetSymbol === "USDT" || assetSymbol === "USD") return amount;
  const pair = SUPPORTED_PAIRS.find((p) => p.baseAsset === assetSymbol);
  if (!pair) return new Decimal(0);
  const ticker = await getTicker(pair.symbol);
  return amount.mul(ticker.lastPrice);
}

export async function getWalletForUser(userId: string) {
  const wallet = await prisma.cryptoWallet.findFirst({
    where: { userId },
    include: { balances: true },
  });
  if (!wallet) return null;

  const assets: WalletAssetView[] = await Promise.all(
    wallet.balances.map(async (balance) => {
      const total = new Decimal(balance.available.toString()).add(balance.locked.toString());
      const usdValue = await getUsdValue(balance.assetSymbol, total);
      return {
        assetSymbol: balance.assetSymbol,
        available: balance.available.toString(),
        locked: balance.locked.toString(),
        usdValue: usdValue.toFixed(2),
      };
    })
  );

  const totalUsdValue = assets
    .reduce((sum, a) => sum.add(a.usdValue), new Decimal(0))
    .toFixed(2);

  return { walletId: wallet.id, assets, totalUsdValue };
}
