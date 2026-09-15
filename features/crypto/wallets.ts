import "server-only";
import { prisma } from "@/lib/db/prisma";

/**
 * Phase 3: Deposit-and-hold wallet (no live market valuation)
 * 
 * Returns native crypto balances only.
 * USD valuation removed — wallet no longer depends on Bybit/live prices.
 */

export interface WalletAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
}

export async function getWalletForUser(userId: string) {
  const wallet = await prisma.cryptoWallet.findFirst({
    where: { userId },
    include: { balances: true },
  });
  if (!wallet) return null;

  const assets: WalletAssetView[] = wallet.balances.map((balance) => ({
    assetSymbol: balance.assetSymbol,
    available: balance.available.toString(),
    locked: balance.locked.toString(),
  }));

  return { walletId: wallet.id, assets };
}
