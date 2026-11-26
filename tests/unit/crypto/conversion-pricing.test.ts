import {
  describe,
  expect,
  it,
} from "vitest";

import Decimal from "decimal.js";

import type {
  OrderBook,
} from "@/lib/market/types";

import {
  calculateConversionPrice,
  validateConversionOrderBook,
} from "@/features/crypto/conversion-pricing";

function makeBook(): OrderBook {
  return {
    symbol: "BTCUSDT",
    status: "live",
    timestamp: new Date(),

    bids: [
      {
        price: new Decimal("60000"),
        quantity: new Decimal("0.05"),
      },
      {
        price: new Decimal("59900"),
        quantity: new Decimal("0.1"),
      },
    ],

    asks: [
      {
        price: new Decimal("60100"),
        quantity: new Decimal("0.1"),
      },
      {
        price: new Decimal("60200"),
        quantity: new Decimal("0.2"),
      },
    ],
  };
}

describe("Phase 5 — Conversion Pricing", () => {
  it("prices BTC to USDT using bids", () => {
    const result = calculateConversionPrice(
      makeBook(),
      "BTCUSDT",
      "BASE_TO_USDT",
      new Decimal("0.05")
    );

    expect(
      result.grossAmount.toString()
    ).toBe("3000");

    expect(
      result.feeAmount.toString()
    ).toBe("3");

    expect(
      result.netAmount.toString()
    ).toBe("2997");
  });

  it("uses multiple bid levels when necessary", () => {
    const result = calculateConversionPrice(
      makeBook(),
      "BTCUSDT",
      "BASE_TO_USDT",
      new Decimal("0.1")
    );

    // 0.05 BTC at 60000 = 3000 USDT
    // 0.05 BTC at 59900 = 2995 USDT

    expect(
      result.grossAmount.toString()
    ).toBe("5995");

    expect(
      result.feeAmount.toString()
    ).toBe("5.995");

    expect(
      result.netAmount.toString()
    ).toBe("5989.005");
  });

  it("prices USDT to BTC using asks", () => {
    const result = calculateConversionPrice(
      makeBook(),
      "BTCUSDT",
      "USDT_TO_BASE",
      new Decimal("6010")
    );

    // 6010 USDT / 60100 = 0.1 BTC

    expect(
      result.grossAmount.toString()
    ).toBe("0.1");

    expect(
      result.feeAmount.toString()
    ).toBe("0.0001");

    expect(
      result.netAmount.toString()
    ).toBe("0.0999");
  });

  it("rejects insufficient bid liquidity", () => {
    expect(() =>
      calculateConversionPrice(
        makeBook(),
        "BTCUSDT",
        "BASE_TO_USDT",
        new Decimal("1")
      )
    ).toThrow(
      "Insufficient market liquidity"
    );
  });

  it("rejects insufficient ask liquidity", () => {
    expect(() =>
      calculateConversionPrice(
        makeBook(),
        "BTCUSDT",
        "USDT_TO_BASE",
        new Decimal("100000")
      )
    ).toThrow(
      "Insufficient market liquidity"
    );
  });

  it("rejects stale market data", () => {
    const book = makeBook();

    book.timestamp = new Date(
      Date.now() - 30000
    );

    expect(() =>
      validateConversionOrderBook(
        book,
        "BTCUSDT"
      )
    ).toThrow();
  });

  it("rejects the wrong market symbol", () => {
    expect(() =>
      calculateConversionPrice(
        makeBook(),
        "ETHUSDT",
        "BASE_TO_USDT",
        new Decimal("0.1")
      )
    ).toThrow();
  });

  it("rejects malformed order-book prices", () => {
    const book = makeBook();

    book.bids[0]!.price = new Decimal("NaN");

    expect(() =>
      calculateConversionPrice(
        book,
        "BTCUSDT",
        "BASE_TO_USDT",
        new Decimal("0.1")
      )
    ).toThrow();
  });

  it("rejects invalid conversion amounts", () => {
    expect(() =>
      calculateConversionPrice(
        makeBook(),
        "BTCUSDT",
        "BASE_TO_USDT",
        new Decimal("-0.1")
      )
    ).toThrow();

    expect(() =>
      calculateConversionPrice(
        makeBook(),
        "BTCUSDT",
        "BASE_TO_USDT",
        new Decimal("Infinity")
      )
    ).toThrow();
  });
});