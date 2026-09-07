import { describe, expect, it } from "vitest";
import { calculateWithdrawalAmounts, calculateWithdrawalRefund } from "@/lib/treasury/withdrawal-math";

describe("withdrawal money math", () => {
  it("uses canonical asset precision for a new request and its cache debit", () => {
    expect(calculateWithdrawalAmounts("10.25", "0.005", 2)).toEqual({
      amount: "10.25",
      fee: "0.05",
      totalDebit: "10.30",
    });
  });

  it("rejects excess precision instead of silently changing the requested amount", () => {
    expect(() => calculateWithdrawalAmounts("10.251", "0.005", 2)).toThrow("at most 2 decimal places");
  });

  it("restores the exact historical cache debit for a legacy non-canonical amount", () => {
    // Old requests decremented the cache after asset-precision rounding.
    expect(calculateWithdrawalRefund("1.234", "0.01", 2)).toBe("1.24");
  });
});
