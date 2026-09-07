import { describe, expect, it } from "vitest";
import { Money, MoneyAssetMismatchError } from "@/lib/money/money";
import { formatMoney } from "@/lib/money/format";

describe("Money", () => {
  it("adds and subtracts exactly, without floating-point drift", () => {
    // 0.1 + 0.2 famously != 0.3 in IEEE 754 float arithmetic.
    const a = Money.fromString("0.1", "USD");
    const b = Money.fromString("0.2", "USD");
    expect(a.add(b).toDecimalString()).toBe("0.3");
  });

  it("rejects operations across different assets", () => {
    const usd = Money.fromString("10", "USD");
    const btc = Money.fromString("1", "BTC");
    expect(() => usd.add(btc)).toThrow(MoneyAssetMismatchError);
  });

  it("never lets a subtraction silently underflow past zero without a signed result", () => {
    const balance = Money.fromString("100.00", "USD");
    const debit = Money.fromString("150.00", "USD");
    const result = balance.subtract(debit);
    expect(result.isNegative()).toBe(true);
    expect(result.toDecimalString()).toBe("-50");
  });

  it("rounds down to asset precision without rounding up over the true value", () => {
    const amount = Money.fromString("1.999999999", "BTC");
    expect(amount.toFixed(8)).toBe("1.99999999");
  });
});

describe("formatMoney", () => {
  it("formats fiat with the correct symbol and tabular-ready precision", () => {
    expect(formatMoney("48765.3", "USD")).toBe("$48,765.30");
  });

  it("formats crypto with the asset symbol suffix", () => {
    expect(formatMoney("1.5", "BTC")).toBe("1.50000000 BTC");
  });
});
