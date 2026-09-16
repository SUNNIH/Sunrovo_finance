import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createTransfer } from "@/features/banking/transfers";
import { reviewTransfer } from "@/features/admin/transfers";
import { hashPassword } from "@/lib/auth/password";
import { hashTransactionPin } from "@/lib/auth/transaction-pin";
import type { TransferInput } from "@/lib/validation/banking";
import Decimal from "decimal.js";

describe("External Transfer Admin Approval", () => {
  const testUserId = "test-user-external-xfer";
  const testAdminId = "test-admin-xfer-review";
  const testAccountId = "test-acct-external-xfer";
  const testSavingsId = "test-savings-external-xfer";
  const testInternalBeneficiaryId = "test-internal-ben-xfer";
  const testExternalBeneficiaryId = "test-external-ben-xfer";
  const testPin = "123456";

  beforeEach(async () => {
    // Create test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: "test.xfer@example.com",
        passwordHash: await hashPassword("password123"),
        role: "USER",
        status: "ACTIVE",
        profile: {
          create: {
            fullName: "Test User",
            preferredFiatCurrency: "USD",
            onboardingCompletedAt: new Date(),
          },
        },
        securitySetting: {
          create: {
            transactionPinHash: await hashTransactionPin(testPin),
          },
        },
      },
    });

    // Create test admin
    await prisma.user.create({
      data: {
        id: testAdminId,
        email: "admin.xfer@example.com",
        passwordHash: await hashPassword("adminpass"),
        role: "ADMIN",
        status: "ACTIVE",
        profile: {
          create: {
            fullName: "Admin User",
            preferredFiatCurrency: "USD",
            onboardingCompletedAt: new Date(),
          },
        },
      },
    });

    // Create bank accounts
    const currentAccount = await prisma.bankAccount.create({
      data: {
        id: testAccountId,
        userId: testUserId,
        type: "CURRENT",
        currencySymbol: "USD",
        accountNumber: "1100000001",
        balanceCache: new Decimal("5000.00"),
        isPrimary: true,
      },
    });

    await prisma.bankAccount.create({
      data: {
        id: testSavingsId,
        userId: testUserId,
        type: "SAVINGS",
        currencySymbol: "USD",
        accountNumber: "1100000002",
        balanceCache: new Decimal("3000.00"),
      },
    });

    // Create ledger account
    await prisma.ledgerAccount.create({
      data: {
        type: "ASSET",
        assetSymbol: "USD",
        name: `Bank Account ${currentAccount.accountNumber}`,
        bankAccountId: currentAccount.id,
      },
    });

    await prisma.ledgerAccount.create({
      data: {
        type: "ASSET",
        assetSymbol: "USD",
        name: `Bank Account 1100000002`,
        bankAccountId: testSavingsId,
      },
    });

    // Create beneficiaries
    await prisma.beneficiary.create({
      data: {
        id: testInternalBeneficiaryId,
        userId: testUserId,
        type: "INTERNAL_PLT",
        nickname: "Friend at FISE",
        accountName: "Friend",
        accountNumber: "1100000002",
      },
    });

    await prisma.beneficiary.create({
      data: {
        id: testExternalBeneficiaryId,
        userId: testUserId,
        type: "EXTERNAL_BANK",
        nickname: "External Bank",
        accountName: "External Account",
        accountNumber: "999999999",
        bankName: "Other Bank",
      },
    });
  });

  afterEach(async () => {
    await prisma.$transaction([
      prisma.notification.deleteMany({ where: { userId: { in: [testUserId, testAdminId] } } }),
      prisma.transaction.deleteMany({ where: { userId: testUserId } }),
      prisma.ledgerEntry.deleteMany({}),
      prisma.transfer.deleteMany({ where: { userId: testUserId } }),
      prisma.beneficiary.deleteMany({ where: { userId: testUserId } }),
      prisma.ledgerAccount.deleteMany({ where: { bankAccountId: { in: [testAccountId, testSavingsId] } } }),
      prisma.bankAccount.deleteMany({ where: { userId: testUserId } }),
      prisma.securitySetting.deleteMany({ where: { userId: { in: [testUserId, testAdminId] } } }),
      prisma.profile.deleteMany({ where: { userId: { in: [testUserId, testAdminId] } } }),
      prisma.auditLog.deleteMany({ where: { actorUserId: { in: [testUserId, testAdminId] } } }),
      prisma.user.deleteMany({ where: { id: { in: [testUserId, testAdminId] } } }),
    ]);
  });

  it("internal FISE transfer completes immediately without admin approval", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testInternalBeneficiaryId,
      },
      amount: "100.00",
      narration: "Internal transfer",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-internal-1", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    expect(transfer.status).toBe("COMPLETED");
    expect(transfer.reviewedByAdminId).toBeNull();
  });

  it("external bank transfer creates PENDING status", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "External transfer",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-1", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    expect(transfer.status).toBe("PENDING");
    expect(transfer.sourceAccountId).toBe(testAccountId);
  });

  it("external transfer debits customer immediately", async () => {
    const beforeBalance = new Decimal(
      (await prisma.bankAccount.findUnique({ where: { id: testAccountId } }))!.balanceCache.toString()
    );

    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    await createTransfer(testUserId, input, "test-external-2", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    const afterBalance = new Decimal(
      (await prisma.bankAccount.findUnique({ where: { id: testAccountId } }))!.balanceCache.toString()
    );

    expect(afterBalance.lessThan(beforeBalance)).toBe(true);
  });

  it("admin can approve external transfer", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-3", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    const result = await reviewTransfer(testAdminId, transfer.id, "APPROVE");

    expect(result.transfer.status).toBe("COMPLETED");
    expect(result.transfer.reviewedByAdminId).toBe(testAdminId);
  });

  it("approval does not debit customer twice", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-4", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    const balanceBeforeApproval = new Decimal(
      (await prisma.bankAccount.findUnique({ where: { id: testAccountId } }))!.balanceCache.toString()
    );

    await reviewTransfer(testAdminId, transfer.id, "APPROVE");

    const balanceAfterApproval = new Decimal(
      (await prisma.bankAccount.findUnique({ where: { id: testAccountId } }))!.balanceCache.toString()
    );

    expect(balanceAfterApproval.equals(balanceBeforeApproval)).toBe(true);
  });

  it("admin can reject external transfer", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-5", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    const result = await reviewTransfer(testAdminId, transfer.id, "REJECT", "Test rejection");

    expect(result.transfer.status).toBe("REVERSED");
    expect(result.transfer.rejectionReason).toBe("Test rejection");
  });

  it("rejection refunds exact source account", async () => {
    const balanceBefore = new Decimal(
      (await prisma.bankAccount.findUnique({ where: { id: testAccountId } }))!.balanceCache.toString()
    );

    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-6", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    await reviewTransfer(testAdminId, transfer.id, "REJECT", "Test");

    const balanceAfter = new Decimal(
      (await prisma.bankAccount.findUnique({ where: { id: testAccountId } }))!.balanceCache.toString()
    );

    expect(balanceAfter.equals(balanceBefore)).toBe(true);
  });

  it("prevents duplicate approval", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-7", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    await reviewTransfer(testAdminId, transfer.id, "APPROVE");
    await expect(reviewTransfer(testAdminId, transfer.id, "APPROVE")).rejects.toThrow();
  });

  it("prevents approve after reject", async () => {
    const input: TransferInput = {
      sourceAccountId: testAccountId,
      destination: {
        kind: "beneficiary",
        beneficiaryId: testExternalBeneficiaryId,
      },
      amount: "250.00",
      narration: "Test",
      transactionPin: testPin,
    };

    const transfer = await createTransfer(testUserId, input, "test-external-8", {
      ipAddress: "127.0.0.1",
      userAgent: "test",
    });

    await reviewTransfer(testAdminId, transfer.id, "REJECT", "Test");
    await expect(reviewTransfer(testAdminId, transfer.id, "APPROVE")).rejects.toThrow();
  });
});
