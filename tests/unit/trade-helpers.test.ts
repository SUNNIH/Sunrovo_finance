import { describe, expect, it } from "vitest";
import {
  calculateShortcutQuantity,
  calculateOrderPreview,
} from "@/components/financial/trade-helpers";
import type { SupportedPair } from "@/lib/bybit/instruments";

const mockBtcUsdt: SupportedPair = {
  symbol: "BTCUSDT",
  baseAsset: "BTC",
  quoteAsset: "USDT",
  pricePrecision: 2,
  quantityPrecision: 6,
  minOrderQuantity: "0.0001",
  minOrderValue: "5",
  isFictional: false,
  basePriceHint: 67000,
};

describe("calculateShortcutQuantity", () => {
  it("calculates 25%, 50%, 75%, and 100% for SELL respecting quantity precision", () => {
    const availableBase = "1.2345678"; // more digits than precision 6
    const q25 = calculateShortcutQuantity({
      percentage: 25,
      side: "SELL",
      availableBase,
      availableQuote: "1000",
      price: "60000",
      quantityPrecision: mockBtcUsdt.quantityPrecision,
    });
    // 1.2345678 * 0.25 = 0.30864195 -> truncated to 6 decimals: 0.308641
    expect(q25).toBe("0.308641");

    const q100 = calculateShortcutQuantity({
      percentage: 100,
      side: "SELL",
      availableBase,
      availableQuote: "1000",
      price: "60000",
      quantityPrecision: mockBtcUsdt.quantityPrecision,
    });
    // Truncated to 6 decimals: 1.234567 (never rounds up to 1.234568 which would exceed available balance)
    expect(q100).toBe("1.234567");
    expect(Number(q100)).toBeLessThanOrEqual(Number(availableBase));
  });

  it("calculates percentage for BUY spending quote balance at given price", () => {
    const availableQuote = "10000";
    const price = "50000";
    const q50 = calculateShortcutQuantity({
      percentage: 50,
      side: "BUY",
      availableBase: "0",
      availableQuote,
      price,
      quantityPrecision: mockBtcUsdt.quantityPrecision,
    });
    // 5000 / 50000 = 0.100000
    expect(q50).toBe("0.100000");

    const q100 = calculateShortcutQuantity({
      percentage: 100,
      side: "BUY",
      availableBase: "0",
      availableQuote,
      price,
      quantityPrecision: mockBtcUsdt.quantityPrecision,
    });
    // 10000 / 50000 = 0.200000
    expect(q100).toBe("0.200000");
  });

  it("returns empty string when balance or price is 0 or invalid", () => {
    expect(
      calculateShortcutQuantity({
        percentage: 50,
        side: "BUY",
        availableBase: "0",
        availableQuote: "0",
        price: "50000",
        quantityPrecision: 6,
      })
    ).toBe("");

    expect(
      calculateShortcutQuantity({
        percentage: 100,
        side: "BUY",
        availableBase: "0",
        availableQuote: "1000",
        price: "0",
        quantityPrecision: 6,
      })
    ).toBe("");

    expect(
      calculateShortcutQuantity({
        percentage: 50,
        side: "SELL",
        availableBase: "0",
        availableQuote: "1000",
        price: "50000",
        quantityPrecision: 6,
      })
    ).toBe("");
  });
});

describe("calculateOrderPreview", () => {
  it("calculates indicative Market BUY preview using existing computeMarketBuyFill math", () => {
    const preview = calculateOrderPreview({
      side: "BUY",
      orderType: "MARKET",
      quantity: "0.1",
      limitPrice: "",
      bestAsk: "60000",
      bestBid: "59990",
      pair: mockBtcUsdt,
      availableBase: "0",
      availableQuote: "10000",
    });

    expect(preview.indicativePrice).toBe("60000.00");
    expect(preview.notional).toBe("6000.00");
    // Fee: 0.1% of 0.1 BTC = 0.000100 BTC
    expect(preview.feeAmount).toBe("0.000100");
    expect(preview.feeAsset).toBe("BTC");
    expect(preview.netAmount).toBe("0.099900");
    expect(preview.isValid).toBe(true);
    expect(preview.validationError).toBeUndefined();
  });

  it("calculates indicative Market SELL preview using existing computeMarketSellFill math", () => {
    const preview = calculateOrderPreview({
      side: "SELL",
      orderType: "MARKET",
      quantity: "0.5",
      limitPrice: "",
      bestAsk: "60010",
      bestBid: "60000",
      pair: mockBtcUsdt,
      availableBase: "1.0",
      availableQuote: "0",
    });

    expect(preview.indicativePrice).toBe("60000.00");
    expect(preview.notional).toBe("30000.00");
    // Fee: 0.1% of 30000 = 30.00 USDT
    expect(preview.feeAmount).toBe("30.00");
    expect(preview.feeAsset).toBe("USDT");
    expect(preview.netAmount).toBe("29970.00");
    expect(preview.isValid).toBe(true);
  });

  it("detects insufficient balance and sets validationError", () => {
    const preview = calculateOrderPreview({
      side: "BUY",
      orderType: "MARKET",
      quantity: "0.1",
      limitPrice: "",
      bestAsk: "60000",
      bestBid: "59990",
      pair: mockBtcUsdt,
      availableBase: "0",
      availableQuote: "100", // Not enough for 6000 USDT
    });

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain("Insufficient USDT balance");
  });

  it("detects order below minimum order value", () => {
    const preview = calculateOrderPreview({
      side: "BUY",
      orderType: "MARKET",
      quantity: "0.0001",
      limitPrice: "",
      bestAsk: "10000",
      bestBid: "9990",
      pair: mockBtcUsdt, // minOrderValue is 5 USDT; 0.0001 * 10000 = 1.00 USDT
      availableBase: "0",
      availableQuote: "1000",
    });

    expect(preview.isValid).toBe(false);
    expect(preview.validationError).toContain("Minimum order value is 5 USDT");
  });
});
