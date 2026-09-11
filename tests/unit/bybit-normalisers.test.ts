import { describe, expect, it } from "vitest";
import {
  normaliseTicker,
  normaliseCandles,
  normaliseLiveKline,
  normaliseOrderBook,
  normaliseTrades,
} from "@/lib/bybit/normalisers";
import { getSupportedPair } from "@/lib/bybit/instruments";

const btc = getSupportedPair("BTCUSDT")!;

describe("normaliseTicker", () => {
  it("converts a Bybit V5 ticker row into an FHT MarketTicker", () => {
    const raw = {
      symbol: "BTCUSDT",
      lastPrice: "67123.45",
      price24hPcnt: "0.0231",
      highPrice24h: "68000",
      lowPrice24h: "66000",
      volume24h: "12345.6",
      bid1Price: "67120",
      ask1Price: "67126",
    };
    const ticker = normaliseTicker(raw, btc);
    expect(ticker.symbol).toBe("BTCUSDT");
    expect(ticker.lastPrice).toBe("67123.45");
    expect(ticker.change24hPercent).toBe("2.31");
    expect(ticker.isStale).toBe(false);
  });

  it("falls back to lastPrice for bid/ask when they're missing", () => {
    const raw = { symbol: "BTCUSDT", lastPrice: "67000", highPrice24h: "67500", lowPrice24h: "66500" };
    const ticker = normaliseTicker(raw, btc);
    expect(ticker.bestBid).toBe("67000.00");
    expect(ticker.bestAsk).toBe("67000.00");
  });
});

describe("normaliseCandles", () => {
  it("reverses Bybit's newest-first order to oldest-first", () => {
    const raw = [
      ["3000", "103", "104", "102", "103.5", "10"],
      ["2000", "102", "103", "101", "102.5", "10"],
      ["1000", "100", "101", "99", "100.5", "10"],
    ];
    const candles = normaliseCandles(raw, btc);
    expect(candles.map((c) => c.openTime)).toEqual([
      new Date(1000).toISOString(),
      new Date(2000).toISOString(),
      new Date(3000).toISOString(),
    ]);
  });

  it("throws on a malformed (non-array) response instead of returning garbage", () => {
    expect(() => normaliseCandles({ not: "an array" }, btc)).toThrow();
  });
});

describe("normaliseLiveKline", () => {
  it("maps a WebSocket kline payload to the same Candle contract as REST", () => {
    expect(normaliseLiveKline({ start: "1700000000000", open: "100", high: "102", low: "99", close: "101", volume: "4.2" }, btc)).toMatchObject({
      openTime: new Date(1700000000000).toISOString(),
      open: "100.00",
      close: "101.00",
      volume: "4.2",
    });
  });

  it("rejects an incomplete WebSocket kline payload", () => {
    expect(() => normaliseLiveKline({ start: "1700000000000", open: "100" }, btc)).toThrow();
  });
});

describe("normaliseOrderBook", () => {
  it("maps Bybit's b/a shorthand fields to bids/asks", () => {
    const raw = { b: [["67000", "0.5"]], a: [["67010", "0.3"]] };
    const book = normaliseOrderBook(raw, btc);
    expect(book.bids).toEqual([{ price: "67000.00", quantity: "0.500000" }]);
    expect(book.asks).toEqual([{ price: "67010.00", quantity: "0.300000" }]);
    expect(book.isStale).toBe(false);
  });

  it("throws when bids/asks are missing", () => {
    expect(() => normaliseOrderBook({}, btc)).toThrow();
  });
});

describe("normaliseTrades", () => {
  it("normalises side casing and maps execId to id", () => {
    const raw = [{ execId: "abc123", price: "67000", size: "0.01", side: "Buy", time: "1700000000000" }];
    const trades = normaliseTrades(raw, btc);
    expect(trades[0]).toMatchObject({ id: "abc123", side: "BUY" });
  });

  it("maps a Sell side correctly", () => {
    const raw = [{ execId: "abc124", price: "67000", size: "0.01", side: "Sell", time: "1700000000000" }];
    const trades = normaliseTrades(raw, btc);
    expect(trades[0]?.side).toBe("SELL");
  });
});
