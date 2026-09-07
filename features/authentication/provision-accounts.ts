import "server-only";
import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { demoFundingPoolName, getOrCreatePlatformLedgerAccount } from "@/lib/ledger/platform-accounts";

type TransactionClient = Prisma.TransactionClient;

/** Starting demo balances, seeded once at onboarding (product rule: "Seed a small demo balance"). */
const STARTING_CURRENT_BALANCE = "5000.00";
const STARTING_SAVINGS_BALANCE = "2000.00";
const STARTING_USDT_BALANCE = "500.000000";

async function generateUniqueAccountNumber(tx: TransactionClient): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = String(randomInt(1_000_000_000, 9_999_999_999));
    const existing = await tx.bankAccount.findUnique({ where: { accountNumber: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique account number after 8 attempts.");
}

/**
 * Creates a new user's default demo accounts (PLT Current, PLT Savings,
 * a spot crypto wallet with a USDT balance) and posts the balanced
 * ledger entries that fund them from the platform's "Demo Funding Pool."
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
      nickname: "PLT Current Account",
      isPrimary: true,
      balanceCache: STARTING_CURRENT_BALANCE,
    },
  });
  const savingsAccount = await tx.bankAccount.create({
    data: {
      userId,
      type: "SAVINGS",
      currencySymbol: fiatCurrency,
      accountNumber: savingsAccountNumber,
      nickname: "PLT Savings Account",
      balanceCache: STARTING_SAVINGS_BALANCE,
    },
  });

  const currentLedgerAccount = await tx.ledgerAccount.create({
    data: {
      type: "ASSET",
      assetSymbol: fiatCurrency,
      name: "PLT Current Account",
      bankAccountId: currentAccount.id,
    },
  });
  const savingsLedgerAccount = await tx.ledgerAccount.create({
    data: {
      type: "ASSET",
      assetSymbol: fiatCurrency,
      name: "PLT Savings Account",
      bankAccountId: savingsAccount.id,
    },
  });

  const fiatFundingPool = await getOrCreatePlatformLedgerAccount(tx, {
    type: "EQUITY",
    assetSymbol: fiatCurrency,
    name: demoFundingPoolName(fiatCurrency),
  });

  // --- Crypto: spot wallet + USDT starting balance -----------------------
  const cryptoWallet = await tx.cryptoWallet.create({
    data: { userId, label: "Spot Wallet" },
  });
  await tx.assetBalance.create({
    data: {
      walletId: cryptoWallet.id,
      assetSymbol: "USDT",
      available: STARTING_USDT_BALANCE,
      locked: "0",
    },
  });
  const usdtLedgerAccount = await tx.ledgerAccount.create({
    data: {
      type: "ASSET",
      assetSymbol: "USDT",
      name: "Spot Wallet — USDT",
      cryptoWalletId: cryptoWallet.id,
    },
  });
  const usdtFundingPool = await getOrCreatePlatformLedgerAccount(tx, {
    type: "EQUITY",
    assetSymbol: "USDT",
    name: demoFundingPoolName("USDT"),
  });

  // --- Post balanced ledger entries for every seeded balance -------------
  const { groupId: currentGroupId } = await postLedgerEntries(tx, [
    {
      ledgerAccountId: currentLedgerAccount.id,
      direction: "DEBIT",
      assetSymbol: fiatCurrency,
      amount: STARTING_CURRENT_BALANCE,
      referenceType: "AccountProvisioning",
      referenceId: currentAccount.id,
    },
    {
      ledgerAccountId: fiatFundingPool.id,
      direction: "CREDIT",
      assetSymbol: fiatCurrency,
      amount: STARTING_CURRENT_BALANCE,
      referenceType: "AccountProvisioning",
      referenceId: currentAccount.id,
    },
  ]);

  const { groupId: savingsGroupId } = await postLedgerEntries(tx, [
    {
      ledgerAccountId: savingsLedgerAccount.id,
      direction: "DEBIT",
      assetSymbol: fiatCurrency,
      amount: STARTING_SAVINGS_BALANCE,
      referenceType: "AccountProvisioning",
      referenceId: savingsAccount.id,
    },
    {
      ledgerAccountId: fiatFundingPool.id,
      direction: "CREDIT",
      assetSymbol: fiatCurrency,
      amount: STARTING_SAVINGS_BALANCE,
      referenceType: "AccountProvisioning",
      referenceId: savingsAccount.id,
    },
  ]);

  const { groupId: usdtGroupId } = await postLedgerEntries(tx, [
    {
      ledgerAccountId: usdtLedgerAccount.id,
      direction: "DEBIT",
      assetSymbol: "USDT",
      amount: STARTING_USDT_BALANCE,
      referenceType: "AccountProvisioning",
      referenceId: cryptoWallet.id,
    },
    {
      ledgerAccountId: usdtFundingPool.id,
      direction: "CREDIT",
      assetSymbol: "USDT",
      amount: STARTING_USDT_BALANCE,
      referenceType: "AccountProvisioning",
      referenceId: cryptoWallet.id,
    },
  ]);

  // --- User-visible transaction history rows ------------------------------
  await tx.transaction.createMany({
    data: [
      {
        userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        status: "COMPLETED",
        assetSymbol: fiatCurrency,
        amount: STARTING_CURRENT_BALANCE,
        narration: "Welcome bonus — PLT Current Account",
        referenceType: "BankAccount",
        referenceId: currentAccount.id,
        ledgerGroupId: currentGroupId,
        isDemo: true,
      },
      {
        userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        status: "COMPLETED",
        assetSymbol: fiatCurrency,
        amount: STARTING_SAVINGS_BALANCE,
        narration: "Welcome bonus — PLT Savings Account",
        referenceType: "BankAccount",
        referenceId: savingsAccount.id,
        ledgerGroupId: savingsGroupId,
        isDemo: true,
      },
      {
        userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        status: "COMPLETED",
        assetSymbol: "USDT",
        amount: STARTING_USDT_BALANCE,
        narration: "Welcome bonus — Spot Wallet",
        referenceType: "CryptoWallet",
        referenceId: cryptoWallet.id,
        ledgerGroupId: usdtGroupId,
        isDemo: true,
      },
    ],
  });
}
