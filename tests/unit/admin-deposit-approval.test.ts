import { describe, expect, it, vi, beforeEach } from "vitest";
import { approveFiatDeposit, rejectFiatDeposit } from "@/features/admin/deposits";
import { adminDepositReviewSchema } from "@/lib/validation/treasury";
import { prisma } from "@/lib/db/prisma";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { externalSettlementPoolName, getOrCreatePlatformLedgerAccount } from "@/lib/ledger/platform-accounts";
import { AuthError } from "@/features/authentication/errors";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    deposit: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
    },
    bankAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ledgerAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/ledger/postLedgerEntries", () => ({
  postLedgerEntries: vi.fn(),
}));

vi.mock("@/lib/ledger/platform-accounts", () => ({
  externalSettlementPoolName: vi.fn((symbol: string) => `External Settlement — Demo (${symbol})`),
  demoFundingPoolName: vi.fn((symbol: string) => `Demo Funding Pool (${symbol})`),
  getOrCreatePlatformLedgerAccount: vi.fn(),
}));

describe("approveFiatDeposit - Admin Approval Backend", () => {
  const adminId = "admin_super_001";
  const userId = "user_cust_123";
  const depositId = "dep_incoming_pending_001";
  const bankAccountId = "acct_target_usd_456";
  const customerLedgerAccountId = "ledger_acct_cust_789";
  const settlementPoolLedgerAccountId = "ledger_acct_settlement_001";
  const generatedLedgerGroupId = "uuid-ledger-group-approval-123";

  const pendingDeposit = {
    id: depositId,
    userId,
    bankAccountId,
    assetSymbol: "USD",
    amount: "2500.00",
    status: "PENDING",
    completedAt: null,
    ledgerGroupId: null,
    sendingBank: "JPMorgan Chase",
    senderName: "Alice Smith",
    transferReference: "WIRE-REF-998877",
  };

  const validBankAccount = {
    id: bankAccountId,
    userId,
    currencySymbol: "USD",
    balanceCache: "1000.00",
  };

  const validCustomerLedgerAccount = {
    id: customerLedgerAccountId,
    bankAccountId,
    assetSymbol: "USD",
  };

  const validSettlementPoolAccount = {
    id: settlementPoolLedgerAccountId,
    name: "External Settlement — Demo (USD)",
    assetSymbol: "USD",
  };

  let mockTx: any;
  let currentDepositState: any;

  beforeEach(() => {
    vi.clearAllMocks();

    currentDepositState = { ...pendingDeposit };

    mockTx = {
      deposit: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...currentDepositState })),
        updateMany: vi.fn().mockImplementation(({ where, data }) => {
          if (where.id === depositId && currentDepositState.status === where.status) {
            currentDepositState = { ...currentDepositState, ...data };
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: 0 });
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          currentDepositState = { ...currentDepositState, ...data };
          return Promise.resolve({ ...currentDepositState });
        }),
      },
      bankAccount: {
        findUnique: vi.fn().mockResolvedValue(validBankAccount),
        update: vi.fn().mockResolvedValue({ ...validBankAccount, balanceCache: "3500.00" }),
      },
      ledgerAccount: {
        findUnique: vi.fn().mockResolvedValue(validCustomerLedgerAccount),
      },
      transaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit_log_1" }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: "notif_1" }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });

    vi.mocked(getOrCreatePlatformLedgerAccount).mockResolvedValue(validSettlementPoolAccount as any);
    vi.mocked(postLedgerEntries).mockResolvedValue({ groupId: generatedLedgerGroupId });
  });

  it("successfully approves a PENDING deposit and executes balanced ledger entries", async () => {
    const result = await approveFiatDeposit(adminId, depositId);

    // Verify Deposit returned as COMPLETED with ledgerGroupId
    expect(result.deposit.status).toBe("COMPLETED");
    expect(result.deposit.ledgerGroupId).toBe(generatedLedgerGroupId);
    expect(result.deposit.reviewedByAdminId).toBe(adminId);
    expect(result.deposit.completedAt).toBeInstanceOf(Date);
    expect(result.deposit.reviewedAt).toBeInstanceOf(Date);
    expect(result.ledgerGroupId).toBe(generatedLedgerGroupId);

    // Verify exact atomic claim transitioned status from PENDING to COMPLETED
    expect(mockTx.deposit.updateMany).toHaveBeenCalledWith({
      where: { id: depositId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        reviewedByAdminId: adminId,
        reviewedAt: expect.any(Date),
      },
    });

    // Verify External Settlement account used (NOT Demo Funding Pool)
    expect(externalSettlementPoolName).toHaveBeenCalledWith("USD");
    expect(getOrCreatePlatformLedgerAccount).toHaveBeenCalledWith(mockTx, {
      type: "EQUITY",
      assetSymbol: "USD",
      name: "External Settlement — Demo (USD)",
    });

    // Verify balanced ledger legs posted
    expect(postLedgerEntries).toHaveBeenCalledWith(mockTx, [
      {
        ledgerAccountId: customerLedgerAccountId,
        direction: "DEBIT",
        assetSymbol: "USD",
        amount: "2500.00",
        referenceType: "Deposit",
        referenceId: depositId,
      },
      {
        ledgerAccountId: settlementPoolLedgerAccountId,
        direction: "CREDIT",
        assetSymbol: "USD",
        amount: "2500.00",
        referenceType: "Deposit",
        referenceId: depositId,
      },
    ]);

    // Verify balanceCache incremented ONCE
    expect(mockTx.bankAccount.update).toHaveBeenCalledTimes(1);
    expect(mockTx.bankAccount.update).toHaveBeenCalledWith({
      where: { id: bankAccountId },
      data: {
        balanceCache: {
          increment: "2500.00",
        },
      },
    });

    // Verify Deposit finalized with completedAt and ledgerGroupId
    expect(mockTx.deposit.update).toHaveBeenCalledWith({
      where: { id: depositId },
      data: {
        completedAt: expect.any(Date),
        ledgerGroupId: generatedLedgerGroupId,
      },
    });

    // Verify existing Transaction updated to COMPLETED targeting status PENDING (no duplicate transaction created)
    expect(mockTx.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        referenceType: "Deposit",
        referenceId: depositId,
        status: "PENDING",
      },
      data: {
        status: "COMPLETED",
        ledgerGroupId: generatedLedgerGroupId,
      },
    });
    expect(mockTx.transaction.create).not.toHaveBeenCalled();

    // Verify audit log created
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: adminId,
        actorRole: "ADMIN",
        action: "admin.approve_deposit",
        targetType: "Deposit",
        targetId: depositId,
        metadata: {
          bankAccountId,
          assetSymbol: "USD",
          amount: "2500.00",
          ledgerGroupId: generatedLedgerGroupId,
        },
      },
    });

    // Verify customer notification created
    expect(mockTx.notification.create).toHaveBeenCalledWith({
      data: {
        userId,
        type: "TRANSACTION",
        title: "Deposit approved",
        body: expect.stringContaining("2500.00 USD"),
      },
    });
  });

  it("blocks duplicate approval if deposit is not in PENDING status", async () => {
    currentDepositState.status = "COMPLETED";

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      "Only pending deposits can be reviewed."
    );

    expect(mockTx.deposit.updateMany).not.toHaveBeenCalled();
    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
  });

  it("blocks concurrent approval by atomically transitioning PENDING to COMPLETED in the claim", async () => {
    // Simulate competing admin having already claimed the deposit and transitioned status to COMPLETED
    mockTx.deposit.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      "This deposit was just reviewed by another administrator."
    );

    // Verify claim targeted status: "PENDING" and atomically transitioned to "COMPLETED"
    expect(mockTx.deposit.updateMany).toHaveBeenCalledWith({
      where: { id: depositId, status: "PENDING" },
      data: {
        status: "COMPLETED",
        reviewedByAdminId: adminId,
        reviewedAt: expect.any(Date),
      },
    });

    // Ledger posting and balanceCache must NOT execute if claim failed
    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
    expect(mockTx.transaction.updateMany).not.toHaveBeenCalled();
  });

  it("verifies that after a successful claim, status transitions to COMPLETED and competing claims fail", async () => {
    // First admin successfully claims and approves
    const res1 = await approveFiatDeposit(adminId, depositId);
    expect(res1.deposit.status).toBe("COMPLETED");

    // Second admin attempts concurrent approval on the now-COMPLETED deposit
    await expect(approveFiatDeposit("admin_competing_002", depositId)).rejects.toThrow(
      "Only pending deposits can be reviewed."
    );

    // Verify second attempt was rejected before any ledger or balance mutations
    expect(mockTx.bankAccount.update).toHaveBeenCalledTimes(1); // Only the first approval incremented
    expect(postLedgerEntries).toHaveBeenCalledTimes(1);
  });

  it("rejects if deposit has no associated bankAccountId", async () => {
    currentDepositState.bankAccountId = null;

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      "Only incoming fiat deposits with an associated bank account can be reviewed."
    );
  });

  it("revalidates bank account existence", async () => {
    mockTx.bankAccount.findUnique.mockResolvedValueOnce(null);

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      "Target bank account not found."
    );
  });

  it("revalidates bank account ownership (rejects if account belongs to another user)", async () => {
    mockTx.bankAccount.findUnique.mockResolvedValueOnce({
      ...validBankAccount,
      userId: "different_user_999",
    });

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      "Target bank account does not belong to deposit user."
    );
  });

  it("revalidates currency consistency (rejects if account currency doesn't match deposit assetSymbol)", async () => {
    mockTx.bankAccount.findUnique.mockResolvedValueOnce({
      ...validBankAccount,
      currencySymbol: "EUR",
    });

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      "Account currency EUR does not match deposit asset USD."
    );
  });

  it("throws if bank account has no ledger account", async () => {
    mockTx.ledgerAccount.findUnique.mockResolvedValueOnce(null);

    await expect(approveFiatDeposit(adminId, depositId)).rejects.toThrow(
      `Bank account ${bankAccountId} has no ledger account`
    );

    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
  });
});

describe("rejectFiatDeposit - Admin Rejection Backend", () => {
  const adminId = "admin_super_001";
  const userId = "user_cust_123";
  const depositId = "dep_incoming_pending_001";
  const bankAccountId = "acct_target_usd_456";
  const rejectionReason = "Originating account name does not match KYC profile";

  const pendingDeposit = {
    id: depositId,
    userId,
    bankAccountId,
    assetSymbol: "USD",
    amount: "2500.00",
    status: "PENDING",
    completedAt: null,
    ledgerGroupId: null,
    rejectionReason: null,
    sendingBank: "JPMorgan Chase",
    senderName: "Unknown Party",
    transferReference: "WIRE-REF-998877",
  };

  let mockTx: any;
  let currentDepositState: any;

  beforeEach(() => {
    vi.clearAllMocks();

    currentDepositState = { ...pendingDeposit };

    mockTx = {
      deposit: {
        findUnique: vi.fn().mockImplementation(() => Promise.resolve({ ...currentDepositState })),
        updateMany: vi.fn().mockImplementation(({ where, data }) => {
          if (where.id === depositId && currentDepositState.status === where.status) {
            currentDepositState = { ...currentDepositState, ...data };
            return Promise.resolve({ count: 1 });
          }
          return Promise.resolve({ count: 0 });
        }),
      },
      bankAccount: {
        update: vi.fn(),
      },
      transaction: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit_log_rej" }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: "notif_rej" }),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      return callback(mockTx);
    });
  });

  it("successfully rejects a PENDING deposit and transitions status to FAILED", async () => {
    const result = await rejectFiatDeposit(adminId, depositId, rejectionReason);

    // Verify deposit returned as FAILED with rejection metadata
    expect(result.deposit?.status).toBe("FAILED");
    expect(result.deposit?.reviewedByAdminId).toBe(adminId);
    expect(result.deposit?.rejectionReason).toBe(rejectionReason);
    expect(result.deposit?.reviewedAt).toBeInstanceOf(Date);
    expect(result.deposit?.ledgerGroupId).toBeNull();

    // Verify exact atomic claim was performed: where id & status = PENDING, data status = FAILED
    expect(mockTx.deposit.updateMany).toHaveBeenCalledWith({
      where: { id: depositId, status: "PENDING" },
      data: {
        status: "FAILED",
        reviewedByAdminId: adminId,
        reviewedAt: expect.any(Date),
        rejectionReason,
      },
    });

    // Verify existing Transaction updated to FAILED with status PENDING filter
    expect(mockTx.transaction.updateMany).toHaveBeenCalledTimes(1);
    expect(mockTx.transaction.updateMany).toHaveBeenCalledWith({
      where: {
        userId,
        referenceType: "Deposit",
        referenceId: depositId,
        status: "PENDING",
      },
      data: {
        status: "FAILED",
      },
    });
    expect(mockTx.transaction.create).not.toHaveBeenCalled();

    // CRITICAL FINANCIAL INVARIANT: Zero ledger postings
    expect(postLedgerEntries).not.toHaveBeenCalled();

    // CRITICAL FINANCIAL INVARIANT: balanceCache completely unchanged
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();

    // Verify audit log created
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: adminId,
        actorRole: "ADMIN",
        action: "admin.reject_deposit",
        targetType: "Deposit",
        targetId: depositId,
        metadata: {
          bankAccountId,
          assetSymbol: "USD",
          amount: "2500.00",
          rejectionReason,
        },
      },
    });

    // Verify customer notification created with rejection reason
    expect(mockTx.notification.create).toHaveBeenCalledWith({
      data: {
        userId,
        type: "TRANSACTION",
        title: "Deposit rejected",
        body: expect.stringContaining(rejectionReason),
      },
    });
  });

  it("requires a non-empty rejection reason", async () => {
    await expect(rejectFiatDeposit(adminId, depositId, "")).rejects.toThrow(
      "Rejection reason is required."
    );

    await expect(rejectFiatDeposit(adminId, depositId, "   ")).rejects.toThrow(
      "Rejection reason is required."
    );

    expect(mockTx.deposit.updateMany).not.toHaveBeenCalled();
    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
  });

  it("blocks rejection if deposit is not in PENDING status", async () => {
    currentDepositState.status = "COMPLETED";

    await expect(rejectFiatDeposit(adminId, depositId, rejectionReason)).rejects.toThrow(
      "Only pending deposits can be reviewed."
    );

    expect(mockTx.deposit.updateMany).not.toHaveBeenCalled();
    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
  });

  it("blocks concurrent rejection if another admin claimed the deposit (count !== 1)", async () => {
    mockTx.deposit.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(rejectFiatDeposit(adminId, depositId, rejectionReason)).rejects.toThrow(
      "This deposit was just reviewed by another administrator."
    );

    expect(mockTx.transaction.updateMany).not.toHaveBeenCalled();
    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
  });

  it("blocks approval after deposit has been rejected (approve-after-reject blocked)", async () => {
    // Admin rejects deposit
    const rejResult = await rejectFiatDeposit(adminId, depositId, rejectionReason);
    expect(rejResult.deposit?.status).toBe("FAILED");

    // Competing/subsequent admin attempts to approve
    await expect(approveFiatDeposit("admin_2", depositId)).rejects.toThrow(
      "Only pending deposits can be reviewed."
    );

    // Ledger posting must not have run
    expect(postLedgerEntries).not.toHaveBeenCalled();
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();
  });

  it("blocks repeated rejection on an already rejected deposit (repeated rejection blocked)", async () => {
    // First rejection succeeds
    const rejResult = await rejectFiatDeposit(adminId, depositId, rejectionReason);
    expect(rejResult.deposit?.status).toBe("FAILED");

    // Second rejection attempt fails
    await expect(rejectFiatDeposit("admin_2", depositId, "Duplicate rejection attempt")).rejects.toThrow(
      "Only pending deposits can be reviewed."
    );
  });
});

describe("adminDepositReviewSchema - API Action Validation", () => {
  const depositId = "dep_test_review_123";

  it("1. missing action rejected (no silent approve)", () => {
    const result = adminDepositReviewSchema.safeParse({
      depositId,
    });
    expect(result.success).toBe(false);
  });

  it("2. invalid action rejected", () => {
    const result = adminDepositReviewSchema.safeParse({
      depositId,
      action: "INVALID_ACTION",
    });
    expect(result.success).toBe(false);
  });

  it("3. APPROVE accepted without rejectionReason", () => {
    const result = adminDepositReviewSchema.safeParse({
      depositId,
      action: "APPROVE",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depositId).toBe(depositId);
      expect(result.data.action).toBe("APPROVE");
      expect(result.data.rejectionReason).toBeUndefined();
    }
  });

  it("4. REJECT without reason rejected", () => {
    // Missing rejectionReason
    const missingReason = adminDepositReviewSchema.safeParse({
      depositId,
      action: "REJECT",
    });
    expect(missingReason.success).toBe(false);
    if (!missingReason.success) {
      expect(missingReason.error.issues[0]?.message).toBe("Provide a rejection reason.");
    }

    // Empty string rejectionReason
    const emptyReason = adminDepositReviewSchema.safeParse({
      depositId,
      action: "REJECT",
      rejectionReason: "",
    });
    expect(emptyReason.success).toBe(false);

    // Whitespace-only rejectionReason
    const whitespaceReason = adminDepositReviewSchema.safeParse({
      depositId,
      action: "REJECT",
      rejectionReason: "   ",
    });
    expect(whitespaceReason.success).toBe(false);
  });

  it("5. REJECT with reason accepted", () => {
    const result = adminDepositReviewSchema.safeParse({
      depositId,
      action: "REJECT",
      rejectionReason: "Sender account name mismatch",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.depositId).toBe(depositId);
      expect(result.data.action).toBe("REJECT");
      expect(result.data.rejectionReason).toBe("Sender account name mismatch");
    }
  });
});


