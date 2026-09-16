import { describe, expect, it, vi, beforeEach } from "vitest";
import { fiatDepositSchema } from "@/lib/validation/treasury";
import { createFiatDeposit } from "@/features/treasury/deposits";
import { prisma } from "@/lib/db/prisma";
import * as accountsModule from "@/features/banking/accounts";
import { AuthError } from "@/features/authentication/errors";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    deposit: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    bankAccount: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    ledgerAccount: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/features/banking/accounts", () => ({
  getOwnedAccountOrThrow: vi.fn(),
  getAccountsForUser: vi.fn(),
}));

describe("fiatDepositSchema validation", () => {
  const validPayload = {
    accountId: "acct_usd_123",
    amount: "1500.00",
    sendingBank: "JPMorgan Chase",
    senderName: "Alice Smith",
    transferReference: "WIRE-REF-998877",
    customerNote: "Deposit for payroll",
  };

  it("accepts complete and valid incoming fiat transfer inputs", () => {
    const result = fiatDepositSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.accountId).toBe("acct_usd_123");
      expect(result.data.amount).toBe("1500.00");
      expect(result.data.sendingBank).toBe("JPMorgan Chase");
      expect(result.data.senderName).toBe("Alice Smith");
      expect(result.data.transferReference).toBe("WIRE-REF-998877");
      expect(result.data.customerNote).toBe("Deposit for payroll");
    }
  });

  it("accepts inputs without optional customerNote", () => {
    const { customerNote, ...rest } = validPayload;
    const result = fiatDepositSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("trims whitespace from string fields", () => {
    const result = fiatDepositSchema.safeParse({
      ...validPayload,
      sendingBank: "   Barclays Bank   ",
      senderName: "   Bob Jones   ",
      transferReference: "   REF-12345   ",
      customerNote: "   Optional memo   ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sendingBank).toBe("Barclays Bank");
      expect(result.data.senderName).toBe("Bob Jones");
      expect(result.data.transferReference).toBe("REF-12345");
      expect(result.data.customerNote).toBe("Optional memo");
    }
  });

  it("rejects empty or missing accountId", () => {
    const result = fiatDepositSchema.safeParse({ ...validPayload, accountId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid, zero, or negative amounts", () => {
    expect(fiatDepositSchema.safeParse({ ...validPayload, amount: "0" }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, amount: "-100" }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, amount: "abc" }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, amount: "" }).success).toBe(false);
  });

  it("rejects missing or blank sendingBank", () => {
    expect(fiatDepositSchema.safeParse({ ...validPayload, sendingBank: "" }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, sendingBank: "   " }).success).toBe(false);
  });

  it("rejects missing or blank senderName", () => {
    expect(fiatDepositSchema.safeParse({ ...validPayload, senderName: "" }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, senderName: "   " }).success).toBe(false);
  });

  it("rejects missing or blank transferReference", () => {
    expect(fiatDepositSchema.safeParse({ ...validPayload, transferReference: "" }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, transferReference: "   " }).success).toBe(false);
  });

  it("rejects fields exceeding maximum lengths", () => {
    expect(fiatDepositSchema.safeParse({ ...validPayload, sendingBank: "A".repeat(101) }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, senderName: "B".repeat(101) }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, transferReference: "C".repeat(101) }).success).toBe(false);
    expect(fiatDepositSchema.safeParse({ ...validPayload, customerNote: "D".repeat(501) }).success).toBe(false);
  });
});

describe("createFiatDeposit service flow", () => {
  const userId = "user_fiat_123";
  const idempotencyKey = "client_idem_456";
  const namespacedKey = `${userId}:${idempotencyKey}`;

  const validAccount = {
    id: "acct_target_usd",
    userId,
    currencySymbol: "USD",
    balanceCache: "5000.00",
    accountNumber: "1122334455",
    type: "CURRENT",
  };

  const validDepositInput = {
    accountId: "acct_target_usd",
    amount: "1500.00",
    sendingBank: "JPMorgan Chase",
    senderName: "Alice Smith",
    transferReference: "WIRE-REF-998877",
    customerNote: "Transfer reference invoice #104",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects if the target bank account does not belong to the user", async () => {
    vi.mocked(prisma.deposit.findUnique).mockResolvedValueOnce(null);
    vi.mocked(accountsModule.getOwnedAccountOrThrow).mockRejectedValueOnce(
      new AuthError("ACCOUNT_NOT_FOUND", "Account not found.", 404)
    );

    await expect(createFiatDeposit(userId, validDepositInput, idempotencyKey)).rejects.toThrow(
      "Account not found."
    );
  });

  it("rejects if the target account currency is not a supported fiat currency", async () => {
    vi.mocked(prisma.deposit.findUnique).mockResolvedValueOnce(null);
    vi.mocked(accountsModule.getOwnedAccountOrThrow).mockResolvedValueOnce({
      ...validAccount,
      currencySymbol: "BTC",
    } as any);

    await expect(createFiatDeposit(userId, validDepositInput, idempotencyKey)).rejects.toThrow(
      "Account currency is not a supported fiat currency."
    );
  });

  it("returns existing deposit on duplicate idempotency key (idempotency check)", async () => {
    const existingDeposit = {
      id: "dep_existing_123",
      userId,
      bankAccountId: "acct_target_usd",
      assetSymbol: "USD",
      amount: "1500.00",
      status: "PENDING",
      idempotencyKey: namespacedKey,
      completedAt: null,
      ledgerGroupId: null,
    };

    vi.mocked(prisma.deposit.findUnique).mockResolvedValueOnce(existingDeposit as any);

    const result = await createFiatDeposit(userId, validDepositInput, idempotencyKey);

    expect(result).toBe(existingDeposit);
    expect(accountsModule.getOwnedAccountOrThrow).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("creates PENDING deposit and PENDING transaction with zero ledger posting and unchanged balanceCache", async () => {
    vi.mocked(prisma.deposit.findUnique).mockResolvedValueOnce(null);
    vi.mocked(accountsModule.getOwnedAccountOrThrow).mockResolvedValueOnce(validAccount as any);

    const createdDeposit = {
      id: "dep_new_pending_789",
      userId,
      bankAccountId: "acct_target_usd",
      assetSymbol: "USD",
      amount: "1500.00",
      sendingBank: "JPMorgan Chase",
      senderName: "Alice Smith",
      transferReference: "WIRE-REF-998877",
      customerNote: "Transfer reference invoice #104",
      status: "PENDING",
      idempotencyKey: namespacedKey,
      completedAt: null,
      ledgerGroupId: null,
      createdAt: new Date(),
    };

    const mockTx = {
      deposit: {
        create: vi.fn().mockResolvedValue(createdDeposit),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: "tx_record_123" }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "audit_123" }),
      },
      bankAccount: {
        update: vi.fn(),
      },
      ledgerAccount: {
        findUnique: vi.fn(),
      },
    };

    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
      return callback(mockTx);
    });

    const result = await createFiatDeposit(userId, validDepositInput, idempotencyKey);

    // Verify returned deposit
    expect(result.id).toBe("dep_new_pending_789");
    expect(result.status).toBe("PENDING");
    expect(result.ledgerGroupId).toBeNull();
    expect(result.completedAt).toBeNull();

    // Verify exact deposit.create payload
    expect(mockTx.deposit.create).toHaveBeenCalledTimes(1);
    expect(mockTx.deposit.create).toHaveBeenCalledWith({
      data: {
        userId,
        bankAccountId: "acct_target_usd",
        assetSymbol: "USD",
        amount: "1500.00",
        sendingBank: "JPMorgan Chase",
        senderName: "Alice Smith",
        transferReference: "WIRE-REF-998877",
        customerNote: "Transfer reference invoice #104",
        status: "PENDING",
        idempotencyKey: namespacedKey,
        completedAt: null,
        ledgerGroupId: null,
      },
    });

    // CRITICAL: Verify bankAccount.update was NEVER called (balanceCache unchanged)
    expect(mockTx.bankAccount.update).not.toHaveBeenCalled();

    // CRITICAL: Verify ledgerAccount was NEVER queried (zero ledger interaction)
    expect(mockTx.ledgerAccount.findUnique).not.toHaveBeenCalled();

    // Verify transaction.create record
    expect(mockTx.transaction.create).toHaveBeenCalledTimes(1);
    expect(mockTx.transaction.create).toHaveBeenCalledWith({
      data: {
        userId,
        type: "DEPOSIT",
        direction: "CREDIT",
        status: "PENDING",
        assetSymbol: "USD",
        amount: "1500.00",
        counterparty: "JPMorgan Chase",
        narration: "Incoming bank transfer from JPMorgan Chase (Ref: WIRE-REF-998877)",
        referenceType: "Deposit",
        referenceId: "dep_new_pending_789",
        ledgerGroupId: null,
        isDemo: true,
      },
    });

    // Verify auditLog.create record
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(mockTx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: userId,
        actorRole: "USER",
        action: "treasury.fiat_deposit_requested",
        targetType: "Deposit",
        targetId: "dep_new_pending_789",
        metadata: {
          bankAccountId: "acct_target_usd",
          assetSymbol: "USD",
          amount: "1500.00",
          sendingBank: "JPMorgan Chase",
          senderName: "Alice Smith",
          transferReference: "WIRE-REF-998877",
          status: "PENDING",
        },
      },
    });
  });
});
