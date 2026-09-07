import { describe, expect, it } from "vitest";
import {
  generateMockTicker,
  generateMockCandles,
  generateMockOrderBook,
  generateMockTrades,
} from "@/lib/bybit/mock-data";
import { getSupportedPair } from "@/lib/bybit/instruments";

const btc = getSupportedPair("BTCUSDT")!;
const plt = getSupportedPair("PLTUSDT")!;

describe("generateMockTicker", () => {
  it("produces a plausible ticker near the pair's base price", () => {
    const ticker = generateMockTicker(btc);
    expect(ticker.symbol).toBe("BTCUSDT");
    expect(ticker.isStale).toBe(true);
    const price = Number(ticker.lastPrice);
    expect(price).toBeGreaterThan(btc.basePriceHint * 0.9);
    expect(price).toBeLessThan(btc.basePriceHint * 1.1);
  });

  it("keeps high >= last >= low", () => {
    const ticker = generateMockTicker(btc);
    expect(Number(ticker.high24h)).toBeGreaterThanOrEqual(Number(ticker.lastPrice) * 0.999);
    expect(Number(ticker.low24h)).toBeLessThanOrEqual(Number(ticker.lastPrice) * 1.001);
  });

  it("respects the pair's price precision", () => {
    const ticker = generateMockTicker(plt);
    expect(ticker.lastPrice.split(".")[1]?.length).toBe(plt.pricePrecision);
  });
});

describe("generateMockCandles", () => {
  it("returns the requested number of candles in ascending time order", () => {
    const candles = generateMockCandles(btc, "15", 50);
    expect(candles).toHaveLength(50);
    const times = candles.map((c) => new Date(c.openTime).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("each candle's high is the max and low is the min of open/close", () => {
    const candles = generateMockCandles(btc, "60", 10);
    for (const candle of candles) {
      const open = Number(candle.open);
      const high = Number(candle.high);
      const low = Number(candle.low);
      const close = Number(candle.close);
      expect(high).toBeGreaterThanOrEqual(Math.max(open, close));
      expect(low).toBeLessThanOrEqual(Math.min(open, close));
    }
  });
});

describe("generateMockOrderBook", () => {
  it("orders bids descending and asks ascending, with best bid below best ask", () => {
    const book = generateMockOrderBook(btc);
    const bidPrices = book.bids.map((b) => Number(b.price));
    const askPrices = book.asks.map((a) => Number(a.price));
    expect(bidPrices).toEqual([...bidPrices].sort((a, b) => b - a));
    expect(askPrices).toEqual([...askPrices].sort((a, b) => a - b));
    expect(bidPrices[0]).toBeLessThan(askPrices[0]!);
  });
});

describe("generateMockTrades", () => {
  it("returns the requested number of trades with a valid side", () => {
    const trades = generateMockTrades(btc, 20);
    expect(trades).toHaveLength(20);
    for (const trade of trades) {
      expect(["BUY", "SELL"]).toContain(trade.side);
      expect(Number(trade.price)).toBeGreaterThan(0);
    }
  });
});
