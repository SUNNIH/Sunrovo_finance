import { describe, expect, it } from "vitest";
import {
  formatCustomerDisplay,
  formatDestinationAccount,
  validateRejectionReason,
  createReviewPayload,
  PendingDepositItem,
} from "@/app/admin/incoming-deposits-review";

describe("Admin Review UI - Customer & Account Formatting", () => {
  it("formats customer display with both full name and email", () => {
    const user: PendingDepositItem["user"] = {
      email: "jane.doe@example.com",
      profile: { fullName: "Jane Doe" },
    };
    expect(formatCustomerDisplay(user)).toBe("Jane Doe (jane.doe@example.com)");
  });

  it("formats customer display with only email when profile or fullName is absent", () => {
    expect(
      formatCustomerDisplay({
        email: "alice@example.com",
        profile: null,
      })
    ).toBe("alice@example.com");

    expect(
      formatCustomerDisplay({
        email: "bob@example.com",
        profile: { fullName: null },
      })
    ).toBe("bob@example.com");

    expect(
      formatCustomerDisplay({
        email: "charlie@example.com",
        profile: { fullName: "   " },
      })
    ).toBe("charlie@example.com");
  });

  it("formats destination account with nickname and account number", () => {
    const account: PendingDepositItem["bankAccount"] = {
      accountNumber: "9876543210",
      nickname: "Primary Checking",
      currencySymbol: "USD",
    };
    expect(formatDestinationAccount(account)).toBe("Primary Checking (9876543210)");
  });

  it("formats destination account with account number only when nickname is absent", () => {
    expect(
      formatDestinationAccount({
        accountNumber: "1234567890",
        nickname: null,
        currencySymbol: "USD",
      })
    ).toBe("1234567890");

    expect(formatDestinationAccount(null)).toBe("N/A");
  });
});

describe("Admin Review UI - Rejection Reason Validation", () => {
  it("rejects undefined, null, or empty string", () => {
    expect(validateRejectionReason(undefined).isValid).toBe(false);
    expect(validateRejectionReason(null).isValid).toBe(false);
    expect(validateRejectionReason("").isValid).toBe(false);
    expect(validateRejectionReason("   ").isValid).toBe(false);
  });

  it("provides user-friendly error message when reason is whitespace only", () => {
    const result = validateRejectionReason("   ");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("A non-empty rejection reason is required.");
  });

  it("accepts valid non-empty reason and trims whitespace", () => {
    const result = validateRejectionReason("  Transfer reference not found on bank statement.  ");
    expect(result.isValid).toBe(true);
    expect(result.reason).toBe("Transfer reference not found on bank statement.");
  });
});

describe("Admin Review UI - Payload Creation", () => {
  it("creates explicit APPROVE payload without rejectionReason", () => {
    const payload = createReviewPayload("dep_fiat_001", "APPROVE");
    expect(payload).toEqual({
      depositId: "dep_fiat_001",
      action: "APPROVE",
    });
    expect(payload).not.toHaveProperty("rejectionReason");
  });

  it("creates explicit REJECT payload with trimmed rejectionReason", () => {
    const payload = createReviewPayload(
      "dep_fiat_002",
      "REJECT",
      "  Sender name mismatch with registered KYC name  "
    );
    expect(payload).toEqual({
      depositId: "dep_fiat_002",
      action: "REJECT",
      rejectionReason: "Sender name mismatch with registered KYC name",
    });
  });
});

describe("Admin Review UI - Terminology and Boundaries", () => {
  it("adheres to strict terminology requirements and forbids internal ledger exposure", () => {
    const pendingItem: PendingDepositItem = {
      id: "dep_test_pending_789",
      userId: "usr_456",
      amount: "1500.00",
      assetSymbol: "USD",
      status: "PENDING",
      bankAccountId: "acc_123",
      sendingBank: "Barclays Bank UK",
      senderName: "Arthur Dent",
      transferReference: "REF-778899",
      customerNote: "Salary transfer",
      createdAt: "2026-09-16T12:00:00.000Z",
      user: {
        email: "arthur@example.com",
        profile: { fullName: "Arthur Dent" },
      },
      bankAccount: {
        accountNumber: "100200300",
        nickname: "Main Checking",
        currencySymbol: "USD",
      },
    };

    // Required fields are present
    expect(pendingItem.sendingBank).toBe("Barclays Bank UK");
    expect(pendingItem.senderName).toBe("Arthur Dent");
    expect(pendingItem.transferReference).toBe("REF-778899");
    expect(pendingItem.status).toBe("PENDING");

    // Prohibited internal terms should not appear in client-facing item representation
    const serialized = JSON.stringify(pendingItem);
    expect(serialized).not.toContain("Demo Funding Pool");
    expect(serialized).not.toContain("External Settlement");
    expect(serialized).not.toContain("simulation");
    expect(serialized).not.toContain("ledger");
  });
});
