import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { fundUserAccount } from "@/features/admin/funding";
import { provisionDefaultAccountsForUser } from "@/features/authentication/provision-accounts";
import { AuthError } from "@/features/authentication/errors";

const prisma = new PrismaClient();

describe("Admin funding", () => {
  let adminId = "";
  let regularId = "";
  let targetId = "";

  beforeEach(async () => {
    adminId = "";
    regularId = "";
    targetId = "";

    // This suite creates and deletes financial fixtures. Fail closed.
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || process.env.SUNROVO_TEST_DB_CONFIRM !== "codex.phase6_test") {
      throw new Error("SAFETY STOP: Isolated local test connection required.");
    }
    const url = new URL(databaseUrl);
    if (
      !["postgresql:", "postgres:"].includes(url.protocol) ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.pathname !== "/codex" ||
      url.searchParams.getAll("schema").length !== 1 ||
      url.searchParams.get("schema") !== "phase6_test"
    ) {
      throw new Error("SAFETY STOP: Refusing admin funding tests outside codex.phase6_test.");
    }
    const identity = await prisma.$queryRaw<
      Array<{ databaseName: string; schemaName: string }>
    >`
      SELECT current_database() AS "databaseName", current_schema() AS "schemaName"
    `;
    if (
      identity.length !== 1 ||
      identity[0]?.databaseName !== "codex" ||
      identity[0]?.schemaName !== "phase6_test"
    ) {
      throw new Error("SAFETY STOP: PostgreSQL identity mismatch.");
    }

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
    adminId = adminProfile.userId;

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
    regularId = regularProfile.userId;

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
    targetId = targetProfile.userId;

    await prisma.$transaction(async (tx) => {
      await provisionDefaultAccountsForUser(tx, targetProfile.userId, "USD");
    });
  });

  afterEach(async () => {
    const userIds = [adminId, regularId, targetId].filter((id) => id.length > 0);
    if (userIds.length === 0) return;

    await prisma.$transaction(async (tx) => {
      const entries = await tx.ledgerEntry.findMany({
        where: {
          OR: [
            { ledgerAccount: { bankAccount: { userId: { in: userIds } } } },
            { ledgerAccount: { cryptoWallet: { userId: { in: userIds } } } },
          ],
        },
        select: { groupId: true },
      });
      const groupIds = [...new Set(entries.map((entry) => entry.groupId))];
      if (groupIds.length > 0) {
        await tx.ledgerEntry.deleteMany({ where: { groupId: { in: groupIds } } });
      }

      await tx.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await tx.transaction.deleteMany({ where: { userId: { in: userIds } } });
      await tx.ledgerAccount.deleteMany({ where: { bankAccount: { userId: { in: userIds } } } });
      await tx.ledgerAccount.deleteMany({ where: { cryptoWallet: { userId: { in: userIds } } } });
      await tx.assetBalance.deleteMany({ where: { wallet: { userId: { in: userIds } } } });
      await tx.cryptoWallet.deleteMany({ where: { userId: { in: userIds } } });
      await tx.bankAccount.deleteMany({ where: { userId: { in: userIds } } });
      await tx.profile.deleteMany({ where: { userId: { in: userIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
  });

  it("allows admin to fund a bank account", async () => {

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

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
      include: { ledgerAccount: true },
    });

    const result = await fundUserAccount(
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

    // Get ledger entries for this specific transaction's group
    expect(result.ledgerGroupId).toBeTruthy();
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        groupId: result.ledgerGroupId!,
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

  it("prevents concurrent duplicate funding with database-enforced uniqueness", async () => {

    const account = await prisma.bankAccount.findFirst({
      where: { userId: targetId, type: "CURRENT" },
    });
    expect(account).toBeTruthy();

    const idempotencyKey = `concurrent-test-${Date.now()}`;

    // Simulate concurrent requests with Promise.all
    const concurrentRequests = Array(3)
      .fill(null)
      .map(() =>
        fundUserAccount(
          adminId,
          {
            targetUserId: targetId,
            targetAccountId: account!.id,
            assetSymbol: "USD",
            amount: "500.00",
            reason: "Concurrent funding test",
          },
          idempotencyKey
        ).catch((error: unknown) => ({
          error: error instanceof Error ? error.message : String(error),
        }))
      );

    const results = await Promise.all(concurrentRequests);

    // At least one should succeed
    const successfulResults = results.filter(
      (r): r is Awaited<ReturnType<typeof fundUserAccount>> => !("error" in r)
    );
    expect(successfulResults.length).toBeGreaterThanOrEqual(1);

    // All successful results should have the same transaction ID (idempotency)
    const transactionIds = successfulResults.map((r) => r.transactionId);
    const uniqueTransactionIds = new Set(transactionIds);
    expect(uniqueTransactionIds.size).toBe(1);

    // Verify only ONE ledger group was created
    const transactions = await prisma.transaction.findMany({
      where: { 
        referenceType: "AdminFunding",
        referenceId: `admin-funding:${adminId}:${idempotencyKey}`,
      },
    });
    expect(transactions.length).toBe(1);

    // Verify balance was incremented exactly once
    const updatedAccount = await prisma.bankAccount.findUnique({
      where: { id: account!.id },
    });
    expect(updatedAccount?.balanceCache.toString()).toBe("500");

    // Verify only ONE audit log entry
    const auditLogs = await prisma.auditLog.findMany({
      where: { 
        actorUserId: adminId, 
        action: "admin.fund_account",
        targetId: account!.id,
      },
    });
    expect(auditLogs.length).toBe(1);
  });
});
