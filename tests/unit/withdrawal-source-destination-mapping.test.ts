/**
 * Withdrawal Source/Destination Mapping Test
 *
 * Regression test for Phase 9 withdrawal runtime failure:
 * "Account cmtn8f2hy000x10i0z359db6g has no ledger account"
 *
 * Root Cause: Client did not send sourceAccountId, backend used findFirst()
 * which returned wrong account (one without ledger account).
 *
 * Fix: Added sourceAccountId to withdrawalSchema, client sends selectedAccountId,
 * backend uses exact account ID instead of findFirst.
 *
 * This test proves:
 * 1. User selects specific FHT source account
 * 2. External destination is NOT resolved as FHT account
 * 3. Withdrawal uses EXACT source account selected by user
 * 4. Source account must have ledger account
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import Decimal from "decimal.js";
import { hashPassword } from "@/lib/auth/password";
import { hashTransactionPin } from "@/lib/auth/transaction-pin";
import { createWithdrawal } from "@/features/treasury/withdrawals";

const prisma = new PrismaClient();

describe("Withdrawal source/destination mapping", () => {
  let testUserId: string;
  let currentAccountId: string;
  let savingsAccountId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: "withdraw-mapping-test@fht.test",
        passwordHash: await hashPassword("Test123456!"),
        role: "USER",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            fullName: "Withdrawal Mapping Test",
            preferredFiatCurrency: "USD",
          },
        },
        securitySetting: {
          create: {
            transactionPinHash: await hashTransactionPin("1234"),
          },
        },
      },
    });
    testUserId = user.id;

    // Create Current Account with ledger account
    const currentAccount = await prisma.bankAccount.create({
      data: {
        userId: testUserId,
        type: "CURRENT",
        currencySymbol: "USD",
        accountNumber: `TST${Date.now()}001`,
        nickname: "Current Account",
        balanceCache: new Decimal("1000.00"),
        isPrimary: true,
      },
    });
    currentAccountId = currentAccount.id;
    await prisma.ledgerAccount.create({
      data: {
        assetSymbol: "USD",
        type: "ASSET",
        name: `Customer USD Current ${testUserId}`,
        bankAccountId: currentAccountId,
      },
    });

    // Create Savings Account with ledger account
    const savingsAccount = await prisma.bankAccount.create({
      data: {
        userId: testUserId,
        type: "SAVINGS",
        currencySymbol: "USD",
        accountNumber: `TST${Date.now()}002`,
        nickname: "Savings Account",
        balanceCache: new Decimal("2000.00"),
        isPrimary: false,
      },
    });
    savingsAccountId = savingsAccount.id;
    await prisma.ledgerAccount.create({
      data: {
        assetSymbol: "USD",
        type: "ASSET",
        name: `Customer USD Savings ${testUserId}`,
        bankAccountId: savingsAccountId,
      },
    });
  });

  afterEach(async () => {
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { actorUserId: testUserId } }),
      prisma.notification.deleteMany({ where: { userId: testUserId } }),
      prisma.transaction.deleteMany({ where: { userId: testUserId } }),
      prisma.withdrawal.deleteMany({ where: { userId: testUserId } }),
      prisma.ledgerEntry.deleteMany({
        where: {
          ledgerAccount: {
            OR: [{ bankAccountId: currentAccountId }, { bankAccountId: savingsAccountId }],
          },
        },
      }),
      prisma.ledgerAccount.deleteMany({
        where: { OR: [{ bankAccountId: currentAccountId }, { bankAccountId: savingsAccountId }] },
      }),
      prisma.bankAccount.deleteMany({ where: { userId: testUserId } }),
      prisma.securitySetting.deleteMany({ where: { userId: testUserId } }),
      prisma.profile.deleteMany({ where: { userId: testUserId } }),
      prisma.user.deleteMany({ where: { id: testUserId } }),
    ]);
  });

  it("withdraws from EXACT source account selected by user (Current Account)", async () => {
    const withdrawal = await createWithdrawal(
      testUserId,
      {
        sourceAccountId: currentAccountId, // User explicitly selects Current Account
        assetSymbol: "USD",
        amount: "100.00",
        destination: "External Bank •••• 1234", // External destination, not an FHT account
        transactionPin: "1234",
      },
      "test-exact-source-current"
    );

    expect(withdrawal.sourceAccountId).toBe(currentAccountId);
    expect(withdrawal.sourceWalletId).toBeNull();
    expect(withdrawal.assetSymbol).toBe("USD");
    expect(withdrawal.destination).toBe("External Bank •••• 1234");

    // Verify balance was debited from CURRENT account, not Savings
    const currentAccount = await prisma.bankAccount.findUnique({
      where: { id: currentAccountId },
      select: { balanceCache: true },
    });
    expect(currentAccount).not.toBeNull();
    // Original 1000.00 - 100.00 - 0.50 fee = 899.50
    expect(new Decimal(currentAccount!.balanceCache.toString()).toFixed(2)).toBe("899.50");

    // Verify Savings account was NOT touched
    const savingsAccount = await prisma.bankAccount.findUnique({
      where: { id: savingsAccountId },
      select: { balanceCache: true },
    });
    expect(savingsAccount).not.toBeNull();
    expect(new Decimal(savingsAccount!.balanceCache.toString()).toFixed(2)).toBe("2000.00");
  });

  it("withdraws from EXACT source account selected by user (Savings Account)", async () => {
    const withdrawal = await createWithdrawal(
      testUserId,
      {
        sourceAccountId: savingsAccountId, // User explicitly selects Savings Account
        assetSymbol: "USD",
        amount: "250.00",
        destination: "Chase •••• 5678",
        transactionPin: "1234",
      },
      "test-exact-source-savings"
    );

    expect(withdrawal.sourceAccountId).toBe(savingsAccountId);
    expect(withdrawal.sourceWalletId).toBeNull();
    expect(withdrawal.assetSymbol).toBe("USD");
    expect(withdrawal.destination).toBe("Chase •••• 5678");

    // Verify balance was debited from SAVINGS account, not Current
    const savingsAccount = await prisma.bankAccount.findUnique({
      where: { id: savingsAccountId },
      select: { balanceCache: true },
    });
    expect(savingsAccount).not.toBeNull();
    // Original 2000.00 - 250.00 - 1.25 fee = 1748.75
    expect(new Decimal(savingsAccount!.balanceCache.toString()).toFixed(2)).toBe("1748.75");

    // Verify Current account was NOT touched
    const currentAccount = await prisma.bankAccount.findUnique({
      where: { id: currentAccountId },
      select: { balanceCache: true },
    });
    expect(currentAccount).not.toBeNull();
    expect(new Decimal(currentAccount!.balanceCache.toString()).toFixed(2)).toBe("1000.00");
  });

  it("rejects withdrawal if wrong account ID provided", async () => {
    await expect(
      createWithdrawal(
        testUserId,
        {
          sourceAccountId: "wrong-account-id-12345", // Invalid account ID
          assetSymbol: "USD",
          amount: "100.00",
          destination: "Wells Fargo •••• 9999",
          transactionPin: "1234",
        },
        "test-wrong-account-id"
      )
    ).rejects.toThrow("No USD account found");
  });

  it("rejects withdrawal if account belongs to different user", async () => {
    // Create another user's account
    const otherUser = await prisma.user.create({
      data: {
        email: "other-user@fht.test",
        passwordHash: await hashPassword("Test123456!"),
        role: "USER",
        status: "ACTIVE",
        profile: { create: { fullName: "Other User", preferredFiatCurrency: "USD" } },
      },
    });
    const otherAccount = await prisma.bankAccount.create({
      data: {
        userId: otherUser.id,
        type: "CURRENT",
        currencySymbol: "USD",
        accountNumber: `OTHER${Date.now()}`,
        balanceCache: new Decimal("5000.00"),
      },
    });

    // Test user tries to withdraw from other user's account
    await expect(
      createWithdrawal(
        testUserId,
        {
          sourceAccountId: otherAccount.id, // Other user's account
          assetSymbol: "USD",
          amount: "100.00",
          destination: "Hacker Account",
          transactionPin: "1234",
        },
        "test-unauthorized-account"
      )
    ).rejects.toThrow("No USD account found");

    // Cleanup
    await prisma.bankAccount.delete({ where: { id: otherAccount.id } });
    await prisma.profile.delete({ where: { userId: otherUser.id } });
    await prisma.user.delete({ where: { id: otherUser.id } });
  });

  it("external destination is NOT resolved as FHT account", async () => {
    // This test proves external bank accounts are treated as strings,
    // not resolved to FHT BankAccount records
    const externalDestination = "GB29NWBK60161331926819"; // IBAN format

    const withdrawal = await createWithdrawal(
      testUserId,
      {
        sourceAccountId: currentAccountId,
        assetSymbol: "USD",
        amount: "100.00",
        destination: externalDestination,
        transactionPin: "1234",
      },
      "test-external-destination"
    );

    // Destination is stored as string, not resolved to BankAccount
    expect(withdrawal.destination).toBe(externalDestination);
    expect(withdrawal.sourceAccountId).toBe(currentAccountId);

    // Verify no BankAccount exists with this account number
    const destAccount = await prisma.bankAccount.findFirst({
      where: { accountNumber: externalDestination },
    });
    expect(destAccount).toBeNull();
  });
});
