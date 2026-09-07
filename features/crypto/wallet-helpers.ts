import "server-only";
import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Returns the user's CryptoWallet, creating one if this is somehow their
 * first crypto interaction outside onboarding (defensive — onboarding
 * always creates one, but this keeps trading/convert robust either way).
 */
export async function ensureCryptoWallet(tx: TransactionClient, userId: string) {
  const existing = await tx.cryptoWallet.findFirst({ where: { userId } });
  if (existing) return existing;
  return tx.cryptoWallet.create({ data: { userId, label: "Spot Wallet" } });
}

/**
 * Lazily creates the AssetBalance + matching LedgerAccount for an asset
 * the wallet hasn't held before (e.g. a user's first-ever BTC purchase).
 * Safe to call whether or not the pair already exists.
 */
export async function ensureAssetBalanceAndLedgerAccount(
  tx: TransactionClient,
  walletId: string,
  assetSymbol: string
) {
  let balance = await tx.assetBalance.findUnique({
    where: { walletId_assetSymbol: { walletId, assetSymbol } },
  });
  if (!balance) {
    balance = await tx.assetBalance.create({
      data: { walletId, assetSymbol, available: "0", locked: "0" },
    });
  }

  let ledgerAccount = await tx.ledgerAccount.findFirst({
    where: { cryptoWalletId: walletId, assetSymbol, type: "ASSET" },
  });
  if (!ledgerAccount) {
    ledgerAccount = await tx.ledgerAccount.create({
      data: {
        type: "ASSET",
        assetSymbol,
        name: `Spot Wallet — ${assetSymbol}`,
        cryptoWalletId: walletId,
      },
    });
  }

  return { balance, ledgerAccount };
}
