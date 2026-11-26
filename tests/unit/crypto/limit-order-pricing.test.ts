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
  calculateFullLimitFill,
  isFreshOrderBook,
} from "@/features/crypto/limit-order-pricing";

function makeBook(
  asks: [string, string][],
  bids: [string, string][]
): OrderBook {
  return {
    symbol: "BTCUSDT",
    status: "live",
    timestamp: new Date(),

    asks: asks.map(([price, quantity]) => ({
      price: new Decimal(price),
      quantity: new Decimal(quantity),
    })),

    bids: bids.map(([price, quantity]) => ({
      price: new Decimal(price),
      quantity: new Decimal(quantity),
    })),
  };
}

const book = () =>
  makeBook(
    [
      ["59900", "0.1"],
      ["59950", "0.2"],
      ["60100", "1"],
    ],
    [
      ["59850", "0.1"],
      ["59800", "0.2"],
    ]
  );

describe("Conservative simulated limit-order pricing", () => {
  it("fills BUY at or below limit without worsening price", () => {
    const fill = calculateFullLimitFill(
      "BUY",
      new Decimal("0.1"),
      new Decimal("60000"),
      book()
    );

    expect(fill?.grossQuote.toString()).toBe("5990");

    expect(fill?.averagePrice.toString()).toBe("59900");
  });

  it("sweeps multiple price levels for a complete BUY fill", () => {
    const fill = calculateFullLimitFill(
      "BUY",
      new Decimal("0.2"),
      new Decimal("60000"),
      book()
    );

    expect(fill?.grossQuote.toString()).toBe("11985");

    expect(fill?.averagePrice.toString()).toBe("59925");
  });

  it("refuses a BUY if visible quantity within limit is insufficient", () => {
    const fill = calculateFullLimitFill(
      "BUY",
      new Decimal("0.4"),
      new Decimal("60000"),
      book()
    );

    expect(fill).toBeNull();
  });

  it("refuses a BUY when best ask is above the limit", () => {
    const fill = calculateFullLimitFill(
      "BUY",
      new Decimal("0.1"),
      new Decimal("59800"),
      book()
    );

    expect(fill).toBeNull();
  });

  it("fills SELL only against bids at or above limit", () => {
    const fill = calculateFullLimitFill(
      "SELL",
      new Decimal("0.2"),
      new Decimal("59800"),
      book()
    );

    expect(fill?.grossQuote.toString()).toBe("11965");

    expect(fill?.averagePrice.toString()).toBe("59825");
  });

  it("refuses SELL if bid is below limit", () => {
    const fill = calculateFullLimitFill(
      "SELL",
      new Decimal("0.1"),
      new Decimal("59900"),
      book()
    );

    expect(fill).toBeNull();
  });

  it("rejects a stale or mislabeled snapshot", () => {
    const fresh = book();

    expect(
      isFreshOrderBook(fresh, "BTCUSDT")
    ).toBe(true);

    expect(
      isFreshOrderBook(
        {
          ...fresh,
          timestamp: new Date(
            Date.now() - 30_000
          ),
        },
        "BTCUSDT"
      )
    ).toBe(false);

    expect(
      isFreshOrderBook(
        {
          ...fresh,
          status: "stale",
        },
        "BTCUSDT"
      )
    ).toBe(false);

    expect(
      isFreshOrderBook(
        fresh,
        "ETHUSDT"
      )
    ).toBe(false);
  });

  it("rejects malformed book levels", () => {
    expect(
      calculateFullLimitFill(
        "BUY",
        new Decimal(1),
        new Decimal(60000),
        makeBook(
          [["NaN", "1"]],
          []
        )
      )
    ).toBeNull();

    expect(
      calculateFullLimitFill(
        "SELL",
        new Decimal(1),
        new Decimal(60000),
        makeBook(
          [],
          [["60000", "-1"]]
        )
      )
    ).toBeNull();
  });
});