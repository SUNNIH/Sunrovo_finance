import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

async function generateUniqueAccountNumber(tx: TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = String(randomInt(1_000_000_000, 9_999_999_999));
    const existing = await tx.bankAccount.findUnique({ where: { accountNumber: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique account number after 8 attempts.");
}

/**
 * Creates a new user's default accounts (FHT Current, FHT Savings,
 * a spot crypto wallet) with ZERO balances. Admins can fund accounts
 * later through the platform funding interface.
 * Must be called inside an existing `prisma.$transaction`.
 */
export async function provisionDefaultAccountsForUser(
  tx: TransactionClient,
  userId: string,
  fiatCurrency: string
): Promise<void> {
  // --- Fiat: Current + Savings accounts ---------------------------------
  const [currentAccountNumber, savingsAccountNumber] = await Promise.all([
    generateUniqueAccountNumber(tx),
    generateUniqueAccountNumber(tx),
  ]);

  const currentAccount = await tx.bankAccount.create({
    data: {
      userId,
      type: "CURRENT",
      currencySymbol: fiatCurrency,
      accountNumber: currentAccountNumber,
      nickname: "FHT Current Account",
      isPrimary: true,
      balanceCache: "0",
    },
  });
  const savingsAccount = await tx.bankAccount.create({
    data: {
      userId,
      type: "SAVINGS",
      currencySymbol: fiatCurrency,
      accountNumber: savingsAccountNumber,
      nickname: "FHT Savings Account",
      balanceCache: "0",
    },
  });

  await tx.ledgerAccount.create({
    data: {
      type: "ASSET",
      assetSymbol: fiatCurrency,
      name: "FHT Current Account",
      bankAccountId: currentAccount.id,
    },
  });
  await tx.ledgerAccount.create({
    data: {
      type: "ASSET",
      assetSymbol: fiatCurrency,
      name: "FHT Savings Account",
      bankAccountId: savingsAccount.id,
    },
  });

  // --- Crypto: spot wallet (no initial balance) --------------------------
  const cryptoWallet = await tx.cryptoWallet.create({
    data: { userId, label: "Spot Wallet" },
  });
  
  // No initial asset balance or ledger entries — wallet starts empty.
  // USDT balance will be created on-demand when first needed (deposit, trade, admin funding).
}
