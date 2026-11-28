import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Simulated trading must remain disabled.
vi.mock("@/lib/feature-flags", () => ({
  CRYPTO_TRADING_ENABLED: false,
}));

// Mock database operations.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cryptoOrder: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

// Mock external market-data requests.
vi.mock("@/lib/market/service", () => ({
  getOrderBook: vi.fn(),
  getTradingInstruments: vi.fn(),
}));

import {
  prisma,
} from "@/lib/db/prisma";

import {
  getOrderBook,
} from "@/lib/market/service";

import {
  matchOpenLimitOrders,
} from "@/features/crypto/limit-order-matcher";

describe("Limit-order matcher feature flag", () => {
  it(
    "never reads orders or market data while trading is disabled",
    async () => {
      const result = await matchOpenLimitOrders();

      expect(result).toEqual({
        disabled: true,
        scanned: 0,
        filled: 0,
        skipped: 0,
        failed: 0,
      });

      expect(
        prisma.cryptoOrder.findMany
      ).not.toHaveBeenCalled();

      expect(
        prisma.cryptoOrder.count
      ).not.toHaveBeenCalled();

      expect(
        getOrderBook
      ).not.toHaveBeenCalled();
    }
  );
});