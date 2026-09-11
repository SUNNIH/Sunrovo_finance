import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { fundUserAccount, ADMIN_FUNDING_POOL_NAME } from "@/features/admin/funding";
import { provisionDefaultAccountsForUser } from "@/features/authentication/provision-accounts";
import { AuthError } from "@/features/authentication/errors";

const prisma = new PrismaClient();

describe("Admin funding", () => {
  const adminUserId = `test-admin-${Date.now()}`;
  const regularUserId = `test-user-${Date.now()}`;
  const targetUserId = `test-target-${Date.now()}`;

  beforeEach(async () => {
    // Create admin user
    const adminProfile = await prisma.profile.create({
      data: {
        fullName: "Test Admin",
        preferredFiatCurrency: "USD",
        onboardingCompletedAt: new Date(),
        user: {
          create: {
            email: `admin-${Date.now()}@test.com`,
            passwordHash: "hash",
            role: "ADMIN",
            emailVerifiedAt: new Date(),
          },
        },
      },
    });
    Object.assign(globalThis, { __testAdminId: adminProfile.userId });

    // Create regular user
    const regularProfile = await prisma.profile.create({
      data: {
        fullName: "Regular User",
        preferredFiatCurrency: "USD",
        onboardingCompletedAt: new Date(),
        user: {
          create: {
            email: `user-${Date.now()}@test.com`,
            passwordHash: "hash",
            role: "USER",
            emailVerifiedAt: new Date(),
          },
        },
      },
    });
    Object.assign(globalThis, { __testRegularUserId: regularProfile.userId });

    // Create target user with zero-balance accounts
    const targetProfile = await prisma.profile.create({
      data: {
        fullName: "Target User",
        preferredFiatCurrency: "USD",
        onboardingCompletedAt: new Date(),
        user: {
          create: {
            email: `target-${Date.now()}@test.com`,
            passwordHash: "hash",
            role: "USER",
            emailVerifiedAt: new Date(),
          },
        },
      },
    });
    Object.assign(globalThis, { __testTargetUserId: targetProfile.userId });

    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, targetProfile.userId, "USD");
    });
  });

  afterEach(async () => {
    const adminId = (globalThis as any).__testAdminId;
    const regularId = (globalThis as any).__testRegularUserId;
    const targetId = (globalThis as any).__testTargetUserId;

    // Clean up in reverse dependency order
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { actorUserId: { in: [adminId, regularId, targetId] } } }),
      prisma.transaction.deleteMany({ where: { userId: { in: [adminId, regularId, targetId] } } }),
      prisma.ledgerEntry.deleteMany({ where: { ledgerAccount: { bankAccount: { userId: { in: [adminId, regularId, targetId] } } } } }),
      prisma.ledgerEntry.deleteMany({ where: { ledgerAccount: { cryptoWallet: { userId: { in: [adminId, regularId, targetId] } } } } }),
      prisma.ledgerAccount.deleteMany({ where: { bankAccount: { userId: { in: [adminId, regularId, targetId] } } } }),
      prisma.ledgerAccount.deleteMany({ where: { cryptoWallet: { userId: { in: [adminId, regularId, targetId] } } } }),
      prisma.assetBalance.deleteMany({ where: { wallet: { userId: { in: [adminId, regularId, targetId] } } } }),
      prisma.cryptoWallet.deleteMany({ where: { userId: { in: [adminId, regularId, targetId] } } }),
      prisma.bankAccount.deleteMany({ where: { userId: { in: [adminId, regularId, targetId] } } }),
      prisma.profile.deleteMany({ where: { userId: { in: [adminId, regularId, targetId] } } }),
      prisma.user.deleteMany({ where: { id: { in: [adminId, regularId, targetId] } } }),
    ]);
  });

  it("allows admin to fund a bank account", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });
    expect(account).toBeTruthy();

    const result = await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetAccountId: account!.id,
        assetSymbol: "USD",
        amount: "1000.00",
        reason: "Test funding for development",
      },
      `test-key-${Date.now()}`
    );

    expect(result.transactionId).toBeTruthy();
    expect(result.alreadyProcessed).toBe(false);

    const updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account!.id },
    });
    expect(updatedAccount?.balanceCache.toString()).toBe("1000");
  });

  it("rejects funding from non-admin user", async () => {
    const regularId = (globalThis as any).__testRegularUserId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    await expect(
      fundUserAccount(
        regularId,
        {
          targetUserId: targetId,
          targetAccountId: account!.id,
          assetSymbol: "USD",
          amount: "1000.00",
          reason: "Unauthorized funding attempt",
        },
        `test-key-${Date.now()}`
      )
    ).rejects.toThrow(AuthError);
  });

  it("creates balanced ledger entries", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
      include: { ledgerAccount: true },
    });

    await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetAccountId: account!.id,
        assetSymbol: "USD",
        amount: "500.00",
        reason: "Test funding",
      },
      `test-key-${Date.now()}`
    );

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        OR: [
          { ledgerAccountId: account!.ledgerAccount!.id },
          {
            ledgerAccount: {
              name: ADMIN_FUNDING_POOL_NAME("USD"),
              assetSymbol: "USD",
            },
          },
        ],
      },
    });

    expect(ledgerEntries.length).toBeGreaterThanOrEqual(2);

    const debitSum = ledgerEntries
      .filter((e) => e.direction === "DEBIT")
      .reduce((sum, e) => sum.add(new Decimal(e.amount.toString())), new Decimal(0));

    const creditSum = ledgerEntries
      .filter((e) => e.direction === "CREDIT")
      .reduce((sum, e) => sum.add(new Decimal(e.amount.toString())), new Decimal(0));

    expect(debitSum.eq(creditSum)).toBe(true);
  });

  it("prevents duplicate funding with same idempotency key", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    const idempotencyKey = `test-key-${Date.now()}`;

    const result1 = await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetAccountId: account!.id,
        assetSymbol: "USD",
        amount: "250.00",
        reason: "First funding",
      },
      idempotencyKey
    );

    const result2 = await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetAccountId: account!.id,
        assetSymbol: "USD",
        amount: "250.00",
        reason: "Duplicate funding",
      },
      idempotencyKey
    );

    expect(result2.alreadyProcessed).toBe(true);
    expect(result1.transactionId).toBe(result2.transactionId);

    const updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account!.id },
    });
    expect(updatedAccount?.balanceCache.toString()).toBe("250");
  });

  it("rejects funding with mismatched currency", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    await expect(
      fundUserAccount(
        adminId,
        {
          targetUserId: targetId,
          targetAccountId: account!.id,
          assetSymbol: "EUR",
          amount: "1000.00",
          reason: "Wrong currency",
        },
        `test-key-${Date.now()}`
      )
    ).rejects.toThrow(AuthError);
  });

  it("rejects funding account belonging to different user", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;
    const regularId = (globalThis as any).__testRegularUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    await expect(
      fundUserAccount(
        adminId,
        {
          targetUserId: regularId,
          targetAccountId: account!.id,
          assetSymbol: "USD",
          amount: "1000.00",
          reason: "Wrong user",
        },
        `test-key-${Date.now()}`
      )
    ).rejects.toThrow(AuthError);
  });

  it("creates user transaction history", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetAccountId: account!.id,
        assetSymbol: "USD",
        amount: "750.00",
        reason: "Development test credit",
      },
      `test-key-${Date.now()}`
    );

    const transaction = await prisma.transaction.findFirst({
      where: { userId: targetId, type: "DEPOSIT" },
    });

    expect(transaction).toBeTruthy();
    expect(transaction?.amount.toString()).toBe("750");
    expect(transaction?.assetSymbol).toBe("USD");
    expect(transaction?.narration).toBe("Development test credit");
    expect(transaction?.counterparty).toBe("Platform Treasury");
  });

  it("creates admin audit log", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetAccountId: account!.id,
        assetSymbol: "USD",
        amount: "1500.00",
        reason: "Admin funding test",
      },
      `test-key-${Date.now()}`
    );

    const auditLog = await prisma.auditLog.findFirst({
      where: { actorUserId: adminId, action: "admin.fund_account" },
    });

    expect(auditLog).toBeTruthy();
    expect(auditLog?.targetType).toBe("BankAccount");
    expect(auditLog?.targetId).toBe(account!.id);
  });

  it("allows funding crypto wallet", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const wallet = await prisma.cryptoWallet.findFirst({
      where: { userId: targetId },
    });
    expect(wallet).toBeTruthy();

    await fundUserAccount(
      adminId,
      {
        targetUserId: targetId,
        targetWalletId: wallet!.id,
        assetSymbol: "USDT",
        amount: "5000.000000",
        reason: "Initial crypto funding",
      },
      `test-key-${Date.now()}`
    );

    const assetBalance = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: { walletId: wallet!.id, assetSymbol: "USDT" },
      },
    });

    expect(assetBalance).toBeTruthy();
    expect(assetBalance?.available.toString()).toBe("5000");
  });

  it("rejects zero or negative amounts", async () => {
    const adminId = (globalThis as any).__testAdminId;
    const targetId = (globalThis as any).__testTargetUserId;

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });

    await expect(
      fundUserAccount(
        adminId,
        {
          targetUserId: targetId,
          targetAccountId: account!.id,
          assetSymbol: "USD",
          amount: "0",
          reason: "Zero funding",
        },
        `test-key-${Date.now()}`
      )
    ).rejects.toThrow(AuthError);

    await expect(
      fundUserAccount(
        adminId,
        {
          targetUserId: targetId,
          targetAccountId: account!.id,
          assetSymbol: "USD",
          amount: "-100",
          reason: "Negative funding",
        },
        `test-key-${Date.now()}`
      )
    ).rejects.toThrow(AuthError);
  });
});
