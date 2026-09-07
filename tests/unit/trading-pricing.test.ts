import { describe, expect, it } from "vitest";
import {
  computeMarketBuyFill,
  computeMarketSellFill,
  limitBuyShouldFill,
  limitSellShouldFill,
} from "@/features/crypto/trading-pricing";

describe("computeMarketBuyFill", () => {
  it("computes notional as quantity * price", () => {
    const fill = computeMarketBuyFill("0.1", "67000", 6, 2);
    expect(fill.notional).toBe("6700.00");
  });

  it("charges the fee in the base asset and nets it off the received quantity", () => {
    const fill = computeMarketBuyFill("1", "100", 6, 2);
    // 0.1% of 1 = 0.001
    expect(fill.feeAmount).toBe("0.001000");
    expect(fill.netBaseQuantity).toBe("0.999000");
  });

  it("never lets the net received quantity exceed the ordered quantity", () => {
    const fill = computeMarketBuyFill("2.5", "3400", 6, 2);
    expect(Number(fill.netBaseQuantity)).toBeLessThan(2.5);
  });
});

describe("computeMarketSellFill", () => {
  it("computes notional as quantity * price", () => {
    const fill = computeMarketSellFill("0.1", "67000", 2);
    expect(fill.notional).toBe("6700.00");
  });

  it("charges the fee in the quote asset and nets it off the received amount", () => {
    const fill = computeMarketSellFill("1", "1000", 2);
    // 0.1% of 1000 = 1.00
    expect(fill.feeAmount).toBe("1.00");
    expect(fill.netQuoteAmount).toBe("999.00");
  });
});

describe("limit order fill conditions", () => {
  it("a BUY limit fills once the ask drops to or below the limit price", () => {
    expect(limitBuyShouldFill("67000", "66999")).toBe(true);
    expect(limitBuyShouldFill("67000", "67000")).toBe(true);
    expect(limitBuyShouldFill("67000", "67001")).toBe(false);
  });

  it("a SELL limit fills once the bid rises to or above the limit price", () => {
    expect(limitSellShouldFill("67000", "67001")).toBe(true);
    expect(limitSellShouldFill("67000", "67000")).toBe(true);
    expect(limitSellShouldFill("67000", "66999")).toBe(false);
  });
});
