import type { Prisma, PrismaClient, LedgerAccountType } from "@prisma/client";

type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

/**
 * Platform-owned ledger accounts (no BankAccount/CryptoWallet owner) —
 * e.g. the "Demo Funding Pool" that seeds a new user's starting demo
 * balance, or (from Phase 4) fee-revenue and settlement accounts. These
 * are reference data: `prisma/seed.ts` pre-creates the ones Phase 2
 * needs, and this helper is the single, idempotent way any feature code
 * looks one up (falling back to create-if-missing defensively, so a
 * fresh DB that skipped seeding doesn't hard-fail account provisioning).
 */
export function demoFundingPoolName(assetSymbol: string): string {
  return `Demo Funding Pool (${assetSymbol})`;
}

/** Where a simulated external-bank transfer's funds are recorded as having "left" FHT. */
export function externalSettlementPoolName(assetSymbol: string): string {
  return `External Settlement — Demo (${assetSymbol})`;
}

/** Where transfer/conversion/trade fees accrue. */
export function feeRevenuePoolName(assetSymbol: string): string {
  return `Fee Revenue (${assetSymbol})`;
}

/** The platform's simulated counterparty inventory for a base asset (e.g. BTC) in the trading engine. */
export function cryptoInventoryPoolName(assetSymbol: string): string {
  return `Crypto Inventory (${assetSymbol})`;
}

/** Where the quote-asset side of a simulated trade/conversion settles (e.g. USDT). */
export function tradingSettlementPoolName(assetSymbol: string): string {
  return `Crypto Trading Settlement (${assetSymbol})`;
}

export async function getOrCreatePlatformLedgerAccount(
  tx: TransactionClient,
  params: { type: LedgerAccountType; assetSymbol: string; name: string }
) {
  const existing = await tx.ledgerAccount.findFirst({
    where: {
      type: params.type,
      assetSymbol: params.assetSymbol,
      name: params.name,
      bankAccountId: null,
      cryptoWalletId: null,
    },
  });
  if (existing) return existing;

  return tx.ledgerAccount.create({
    data: {
      type: params.type,
      assetSymbol: params.assetSymbol,
      name: params.name,
      bankAccountId: null,
      cryptoWalletId: null,
    },
  });
}

export type { Prisma };
