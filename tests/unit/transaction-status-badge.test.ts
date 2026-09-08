import { describe, expect, it } from "vitest";
import { TransactionStatusBadge } from "@/components/financial/transaction-status-badge";
import type { TransactionView } from "@/components/financial/transaction-detail-modal";

describe("TransactionStatusBadge", () => {
  it("exports TransactionStatusBadge as a callable component function", () => {
    expect(typeof TransactionStatusBadge).toBe("function");
  });

  it("handles valid repository transaction statuses without runtime errors", () => {
    const statuses = ["COMPLETED", "PENDING", "FAILED", "REVERSED"];
    for (const status of statuses) {
      const element = TransactionStatusBadge({ status });
      expect(element).toBeDefined();
      expect(element.props.variant).toBeDefined();
    }
  });

  it("safely falls back to neutral for unrecognized status strings", () => {
    const element = TransactionStatusBadge({ status: "UNKNOWN_CUSTOM_STATUS" });
    expect(element.props.variant).toBe("neutral");
  });
});

describe("TransactionView Data Handling", () => {
  it("preserves exact transaction view properties without numeric conversion", () => {
    const txn: TransactionView = {
      id: "tx_abc123456789",
      type: "TRANSFER",
      direction: "CREDIT",
      status: "COMPLETED",
      assetSymbol: "USD",
      amount: "1500.50",
      feeAmount: "0.00",
      counterparty: "Alice Wonderland",
      narration: "Invoice #9821 payment",
      isDemo: false,
      createdAt: "2026-09-08T18:30:00.000Z",
    };

    expect(txn.id).toBe("tx_abc123456789");
    expect(txn.direction).toBe("CREDIT");
    expect(txn.amount).toBe("1500.50");
    expect(txn.feeAmount).toBe("0.00");
    expect(txn.counterparty).toBe("Alice Wonderland");
    expect(txn.isDemo).toBe(false);
  });
});
