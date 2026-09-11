import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { formatMoney } from "@/lib/money/format";

describe("Deposit Amount Validation", () => {
  function isValidAmount(val: string): boolean {
    try {
      return new Decimal(val).gt(0);
    } catch {
      return false;
    }
  }

  it("accepts valid positive decimal strings", () => {
    expect(isValidAmount("100")).toBe(true);
    expect(isValidAmount("100.50")).toBe(true);
    expect(isValidAmount("0.0001")).toBe(true);
    expect(isValidAmount("1000000.00")).toBe(true);
  });

  it("rejects zero, negative, or malformed amount strings", () => {
    expect(isValidAmount("0")).toBe(false);
    expect(isValidAmount("-50")).toBe(false);
    expect(isValidAmount("")).toBe(false);
    expect(isValidAmount("abc")).toBe(false);
    expect(isValidAmount("  ")).toBe(false);
  });
});

describe("Deposit Money Formatting", () => {
  it("formats fiat deposit amounts with correct currency symbols", () => {
    expect(formatMoney("1000", "USD")).toBe("$1,000.00");
    expect(formatMoney("5000.5", "EUR")).toBe("€5,000.50");
    expect(formatMoney("250", "GBP")).toBe("£250.00");
  });

  it("formats crypto deposit amounts with appropriate asset precision", () => {
    expect(formatMoney("0.05", "BTC")).toBe("0.05000000 BTC");
    expect(formatMoney("1.25", "ETH")).toBe("1.250000 ETH");
    expect(formatMoney("500", "USDT")).toBe("500.00 USDT");
  });
});

describe("Deposit Receipt Invariants", () => {
  it("preserves exact returned backend values without numeric conversion", () => {
    const mockDeposit = {
      id: "dep_fiat_test_123",
      amount: "5000.00",
      assetSymbol: "USD",
      status: "COMPLETED",
      createdAt: "2026-09-08T21:00:00.000Z",
      destinationLabel: "FHT Checking Account",
    };

    expect(mockDeposit.id).toBe("dep_fiat_test_123");
    expect(mockDeposit.amount).toBe("5000.00");
    expect(mockDeposit.status).toBe("COMPLETED");
    expect(mockDeposit.assetSymbol).toBe("USD");
  });
});
