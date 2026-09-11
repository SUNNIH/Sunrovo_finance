import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { provisionDefaultAccountsForUser } from "@/features/authentication/provision-accounts";

const prisma = new PrismaClient();

describe("Zero-balance account provisioning", () => {
  const testUserId = `test-user-${Date.now()}`;

  beforeEach(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@test.com`,
        passwordHash: "hash",
        emailVerifiedAt: new Date(),
      },
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({ where: { ledgerAccount: { bankAccount: { userId: testUserId } } } }),
      prisma.ledgerEntry.deleteMany({ where: { ledgerAccount: { cryptoWallet: { userId: testUserId } } } }),
      prisma.ledgerAccount.deleteMany({ where: { bankAccount: { userId: testUserId } } }),
      prisma.ledgerAccount.deleteMany({ where: { cryptoWallet: { userId: testUserId } } }),
      prisma.assetBalance.deleteMany({ where: { wallet: { userId: testUserId } } }),
      prisma.cryptoWallet.deleteMany({ where: { userId: testUserId } }),
      prisma.bankAccount.deleteMany({ where: { userId: testUserId } }),
      prisma.user.deleteMany({ where: { id: testUserId } }),
    ]);
  });

  it("creates Current account with zero balance", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const currentAccount = await prisma.bankAccount.findFirst({
      where: { userId: testUserId, type: "CURRENT" },
    });

    expect(currentAccount).toBeTruthy();
    expect(currentAccount?.balanceCache.toString()).toBe("0");
    expect(currentAccount?.currencySymbol).toBe("USD");
    expect(currentAccount?.isPrimary).toBe(true);
  });

  it("creates Savings account with zero balance", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const savingsAccount = await prisma.bankAccount.findFirst({
      where: { userId: testUserId, type: "SAVINGS" },
    });

    expect(savingsAccount).toBeTruthy();
    expect(savingsAccount?.balanceCache.toString()).toBe("0");
    expect(savingsAccount?.currencySymbol).toBe("USD");
  });

  it("creates Spot Wallet with no initial balances", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const wallet = await prisma.cryptoWallet.findFirst({
      where: { userId: testUserId },
      include: { balances: true },
    });

    expect(wallet).toBeTruthy();
    expect(wallet?.label).toBe("Spot Wallet");
    expect(wallet?.balances.length).toBe(0);
  });

  it("creates ledger accounts for bank accounts", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { userId: testUserId },
      include: { ledgerAccount: true },
    });

    expect(bankAccounts.length).toBe(2);
    expect(bankAccounts[0]?.ledgerAccount).toBeTruthy();
    expect(bankAccounts[1]?.ledgerAccount).toBeTruthy();
  });

  it("does not create welcome bonus ledger entries", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const bankAccounts = await prisma.bankAccount.findMany({
      where: { userId: testUserId },
      include: { ledgerAccount: true },
    });

    const ledgerAccountIds = bankAccounts
      .map((a) => a.ledgerAccount?.id)
      .filter(Boolean) as string[];

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { ledgerAccountId: { in: ledgerAccountIds } },
    });

    expect(ledgerEntries.length).toBe(0);
  });

  it("does not create welcome bonus transaction history", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const transactions = await prisma.transaction.findMany({
      where: { userId: testUserId },
    });

    expect(transactions.length).toBe(0);
  });

  it("respects the specified fiat currency", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "EUR");
    });

    const accounts = await prisma.bankAccount.findMany({
      where: { userId: testUserId },
    });

    expect(accounts.every((a) => a.currencySymbol === "EUR")).toBe(true);
  });

  it("generates unique account numbers", async () => {
    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, testUserId, "USD");
    });

    const accounts = await prisma.bankAccount.findMany({
      where: { userId: testUserId },
    });

    const accountNumbers = accounts.map((a) => a.accountNumber);
    const uniqueNumbers = new Set(accountNumbers);

    expect(accountNumbers.length).toBe(2);
    expect(uniqueNumbers.size).toBe(2);
  });
});
