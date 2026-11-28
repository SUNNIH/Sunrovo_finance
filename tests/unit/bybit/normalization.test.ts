/**
 * Bybit Normalization Tests
 */

import { describe, it, expect } from "vitest";
import { Decimal } from "decimal.js";
import * as normalization from "@/lib/bybit/normalization";
import type { BybitTicker, BybitInstrument, BybitKline, BybitOrderBookResult } from "@/lib/bybit/types";

describe("normalization", () => {
  describe("normalizeTickerResponse", () => {
    it("should normalize Bybit ticker to internal format", () => {
      const bybitTicker: BybitTicker = {
        symbol: "BTCUSDT",
        lastPrice: "50000.00",
        highPrice24h: "51000.00",
        lowPrice24h: "49000.00",
        prevPrice24h: "49500.00",
        volume24h: "1234.567",
        turnover24h: "61728350.00",
        price24hPcnt: "0.0101",
        usdIndexPrice: "50000.00",
      };

      const ticker = normalization.normalizeTickerResponse(bybitTicker, "live");

      expect(ticker.symbol).toBe("BTCUSDT");
      expect(ticker.lastPrice).toBeInstanceOf(Decimal);
      expect(ticker.lastPrice.toString()).toBe("50000");
      expect(ticker.high24h.toString()).toBe("51000");
      expect(ticker.low24h.toString()).toBe("49000");
      expect(ticker.priceChange24h.toString()).toBe("500"); // 50000 - 49500
      expect(ticker.priceChangePercent24h.toString()).toBe("0.0101");
      expect(ticker.volume24h.toString()).toBe("1234.567");
      expect(ticker.status).toBe("live");
    });
  });

  describe("normalizeInstrument", () => {
    it("should normalize Bybit instrument to internal format", () => {
      const bybitInstrument: BybitInstrument = {
        symbol: "BTCUSDT",
        baseCoin: "BTC",
        quoteCoin: "USDT",
        innovation: "0",
        status: "Trading",
        marginTrading: "none",
        lotSizeFilter: {
          basePrecision: "0.000001",
          quotePrecision: "0.01",
          minOrderQty: "0.000048",
          maxOrderQty: "71.73956243",
          minOrderAmt: "1",
          maxOrderAmt: "2000000",
        },
        priceFilter: {
          tickSize: "0.01",
        },
      };

      const instrument = normalization.normalizeInstrument(bybitInstrument);

      expect(instrument.symbol).toBe("BTCUSDT");
      expect(instrument.baseAsset).toBe("BTC");
      expect(instrument.quoteAsset).toBe("USDT");
      expect(instrument.status).toBe("active");
      expect(instrument.minOrderQuantity.toString()).toBe("0.000048");
      expect(instrument.tickSize.toString()).toBe("0.01");
      expect(instrument.pricePrecision).toBe(2); // 0.01 has 2 decimal places
      expect(instrument.quantityPrecision).toBe(6); // 0.000001 has 6 decimal places
    });

    it("should handle prelisting status", () => {
      const bybitInstrument: BybitInstrument = {
        symbol: "NEWUSDT",
        baseCoin: "NEW",
        quoteCoin: "USDT",
        innovation: "1",
        status: "PreLaunch",
        marginTrading: "none",
        lotSizeFilter: {
          basePrecision: "0.01",
          quotePrecision: "0.01",
          minOrderQty: "1",
          maxOrderQty: "10000",
          minOrderAmt: "1",
          maxOrderAmt: "100000",
        },
        priceFilter: {
          tickSize: "0.001",
        },
      };

      const instrument = normalization.normalizeInstrument(bybitInstrument);
      expect(instrument.status).toBe("prelisting");
    });
  });

  describe("normalizeKline", () => {
    it("should normalize Bybit kline to internal format", () => {
      const bybitKline: BybitKline = [
        "1672531200000", // startTime (2023-01-01 00:00:00 UTC)
        "50000.00", // open
        "51000.00", // high
        "49000.00", // low
        "50500.00", // close
        "123.456", // volume
        "6172835.00", // turnover
      ];

      const candle = normalization.normalizeKline("BTCUSDT", bybitKline, "60", true);

      expect(candle.symbol).toBe("BTCUSDT");
      expect(candle.interval).toBe("1h");
      expect(candle.open.toString()).toBe("50000");
      expect(candle.high.toString()).toBe("51000");
      expect(candle.low.toString()).toBe("49000");
      expect(candle.close.toString()).toBe("50500");
      expect(candle.volume.toString()).toBe("123.456");
      expect(candle.quoteVolume.toString()).toBe("6172835");
      expect(candle.isFinal).toBe(true);
      expect(candle.openTime).toBeInstanceOf(Date);
      expect(candle.closeTime).toBeInstanceOf(Date);
    });
  });

  describe("normalizeOrderBook", () => {
    it("should normalize Bybit order book to internal format", () => {
      const bybitOrderBook: BybitOrderBookResult = {
        s: "BTCUSDT",
        b: [
          ["50000.00", "1.5"],
          ["49999.00", "2.0"],
          ["49998.00", "0.5"],
        ],
        a: [
          ["50001.00", "1.0"],
          ["50002.00", "1.5"],
          ["50003.00", "2.5"],
        ],
        ts: 1672531200000,
        u: 12345,
      };

      const orderBook = normalization.normalizeOrderBook(bybitOrderBook, "live");

      expect(orderBook.symbol).toBe("BTCUSDT");
      expect(orderBook.bids).toHaveLength(3);
      expect(orderBook.asks).toHaveLength(3);
      expect(orderBook.bids[0]!.price.toString()).toBe("50000");
      expect(orderBook.bids[0]!.quantity.toString()).toBe("1.5");
      expect(orderBook.asks[0]!.price.toString()).toBe("50001");
      expect(orderBook.status).toBe("live");
      expect(orderBook.updateId).toBe(12345);
    });
  });

  describe("toBybitInterval", () => {
    it("should convert internal intervals to Bybit format", () => {
      expect(normalization.toBybitInterval("1m")).toBe("1");
      expect(normalization.toBybitInterval("5m")).toBe("5");
      expect(normalization.toBybitInterval("15m")).toBe("15");
      expect(normalization.toBybitInterval("1h")).toBe("60");
      expect(normalization.toBybitInterval("4h")).toBe("240");
      expect(normalization.toBybitInterval("1d")).toBe("D");
      expect(normalization.toBybitInterval("1w")).toBe("W");
      expect(normalization.toBybitInterval("1M")).toBe("M");
    });
  });
});
