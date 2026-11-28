import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  getOrderBook: vi.fn(),
  getTradingInstruments: vi.fn(),
  ensureBalance: vi.fn(),
  platformAccount: vi.fn(),
  postLedger: vi.fn(),
}));

// Enable trading inside this test only.
// The application's actual feature flag remains false.
vi.mock("@/lib/feature-flags", () => ({
  CRYPTO_TRADING_ENABLED: true,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    cryptoOrder: {
      count: mocks.count,
      findMany: mocks.findMany,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/market/service", () => ({
  getOrderBook: mocks.getOrderBook,
  getTradingInstruments: mocks.getTradingInstruments,
}));

vi.mock("@/features/crypto/wallet-helpers", () => ({
  ensureAssetBalanceAndLedgerAccount: mocks.ensureBalance,
}));

vi.mock("@/lib/ledger/postLedgerEntries", () => ({
  postLedgerEntries: mocks.postLedger,
}));

vi.mock("@/lib/ledger/platform-accounts", () => ({
  getOrCreatePlatformLedgerAccount: mocks.platformAccount,
  cryptoInventoryPoolName: (asset: string) =>
    `Inventory-${asset}`,
  tradingSettlementPoolName: (asset: string) =>
    `Settlement-${asset}`,
  feeRevenuePoolName: (asset: string) =>
    `Fees-${asset}`,
}));

import {
  matchOpenLimitOrders,
} from "@/features/crypto/limit-order-matcher";

describe("Phase 4 — Automatic limit-order execution", () => {
it("settles a SELL limit order with correct fees and balanced ledger", async () => {
  const tx = {
    cryptoOrder: {
      findUnique: vi.fn().mockResolvedValue({
        id: "order-1",
        userId: "user-1",
        symbol: "BTCUSDT",
        side: "SELL",
        type: "LIMIT",
        status: "OPEN",
        quantity: new Decimal("0.1"),
        limitPrice: new Decimal("59000"),
      }),

      updateMany: vi.fn().mockResolvedValue({
        count: 1,
      }),

      update: vi.fn().mockResolvedValue({}),
    },

    cryptoWallet: {
      findFirst: vi.fn().mockResolvedValue({
        id: "wallet-1",
      }),
    },

    assetBalance: {
      updateMany: vi.fn().mockResolvedValue({
        count: 1,
      }),

      update: vi.fn().mockResolvedValue({}),
    },

    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };

  mocks.transaction.mockImplementation(
    async (callback) => callback(tx)
  );

  const result = await matchOpenLimitOrders();

  expect(result.filled).toBe(1);
  expect(result.failed).toBe(0);

  // SELL 0.1 BTC at the available bid of 59800 USDT.
  // Gross proceeds: 5980 USDT.
  // Maker fee: 0.05% = 2.99 USDT.
  // Net proceeds: 5977.01 USDT.

  expect(tx.assetBalance.updateMany).toHaveBeenCalledTimes(1);

  const sourceCall = tx.assetBalance.updateMany.mock.calls[0];

  if (!sourceCall) {
    throw new Error("Expected BTC reservation settlement");
  }

  expect(
    sourceCall[0].data.locked.decrement.toString()
  ).toBe("0.1");

  expect(tx.assetBalance.update).toHaveBeenCalledTimes(1);

  const destinationCall = tx.assetBalance.update.mock.calls[0];

  if (!destinationCall) {
    throw new Error("Expected USDT balance credit");
  }

  expect(
    destinationCall[0].data.available.increment.toString()
  ).toBe("5977.01");

  expect(mocks.postLedger).toHaveBeenCalledTimes(1);

  const ledgerCall = mocks.postLedger.mock.calls[0];

  if (!ledgerCall) {
    throw new Error("Expected ledger posting");
  }

  const legs = ledgerCall[1] as Array<{
    assetSymbol: string;
    direction: "DEBIT" | "CREDIT";
    amount: Decimal;
  }>;

  // Ledger must balance independently for BTC and USDT.
  for (const asset of ["BTC", "USDT"]) {
    const assetLegs = legs.filter(
      (leg) => leg.assetSymbol === asset
    );

    expect(assetLegs.length).toBeGreaterThan(0);

    const debits = assetLegs
      .filter((leg) => leg.direction === "DEBIT")
      .reduce(
        (sum, leg) => sum.plus(leg.amount),
        new Decimal(0)
      );

    const credits = assetLegs
      .filter((leg) => leg.direction === "CREDIT")
      .reduce(
        (sum, leg) => sum.plus(leg.amount),
        new Decimal(0)
      );

    expect(debits.eq(credits)).toBe(true);
  }

  expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
});
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.count.mockResolvedValue(1);

    mocks.findMany.mockResolvedValue([
      {
        id: "order-1",
        symbol: "BTCUSDT",
      },
    ]);

    mocks.getTradingInstruments.mockResolvedValue([
      {
        symbol: "BTCUSDT",
        baseAsset: "BTC",
        quoteAsset: "USDT",
        status: "active",
      },
    ]);

    mocks.getOrderBook.mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        {
          price: new Decimal("59900"),
          quantity: new Decimal("0.5"),
        },
      ],
      bids: [
        {
          price: new Decimal("59800"),
          quantity: new Decimal("0.5"),
        },
      ],
    });

    mocks.ensureBalance.mockImplementation(
      async (_tx: unknown, _walletId: string, asset: string) => ({
        balance: {
          id: `balance-${asset}`,
        },
        ledgerAccount: {
          id: `account-${asset}`,
        },
      })
    );

    mocks.platformAccount.mockImplementation(
      async (_tx: unknown, params: { name: string }) => ({
        id: params.name,
      })
    );

    mocks.postLedger.mockResolvedValue({
      groupId: "group-1",
    });
  });

  it("fills an eligible BUY limit order and balances the ledger", async () => {
    const tx = {
      cryptoOrder: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          userId: "user-1",
          symbol: "BTCUSDT",
          side: "BUY",
          type: "LIMIT",
          status: "OPEN",
          quantity: new Decimal("0.1"),
          limitPrice: new Decimal("60000"),
        }),

        updateMany: vi.fn().mockResolvedValue({
          count: 1,
        }),

        update: vi.fn().mockResolvedValue({}),
      },

      cryptoWallet: {
        findFirst: vi.fn().mockResolvedValue({
          id: "wallet-1",
        }),
      },

      assetBalance: {
        updateMany: vi.fn().mockResolvedValue({
          count: 1,
        }),

        update: vi.fn().mockResolvedValue({}),
      },

      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    mocks.transaction.mockImplementation(
      async (callback) => callback(tx)
    );

    const result = await matchOpenLimitOrders();

    expect(result.disabled).toBe(false);
    expect(result.scanned).toBe(1);
    expect(result.filled).toBe(1);
    expect(result.failed).toBe(0);

    // Verify that the order is claimed exactly once.
    expect(tx.cryptoOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "order-1",
          status: "OPEN",
          type: "LIMIT",
        }),
        data: expect.objectContaining({
          status: "FILLED",
        }),
      })
    );

    // Verify the reserved USDT is consumed and
    // the unused amount is returned.
   expect(tx.assetBalance.updateMany).toHaveBeenCalledTimes(1);

const reservationCall =
  tx.assetBalance.updateMany.mock.calls[0];

if (!reservationCall) {
  throw new Error("Expected reserved balance update");
}

const reservationUpdate = reservationCall[0];

    expect(
      reservationUpdate.data.locked.decrement.toString()
    ).toBe("6000");

    expect(
      reservationUpdate.data.available.increment.toString()
    ).toBe("10");

    // BUY 0.1 BTC, fee 0.05%.
    expect(tx.assetBalance.update).toHaveBeenCalledTimes(1);

const destinationCall =
  tx.assetBalance.update.mock.calls[0];

if (!destinationCall) {
  throw new Error("Expected destination balance update");
}

const destinationUpdate = destinationCall[0];

    expect(
      destinationUpdate.data.available.increment.toString()
    ).toBe("0.09995");

    // Verify that the matcher submitted balanced
    // ledger entries for each asset.
    expect(mocks.postLedger).toHaveBeenCalledTimes(1);

    expect(mocks.postLedger).toHaveBeenCalledTimes(1);

const ledgerCall = mocks.postLedger.mock.calls[0];

if (!ledgerCall) {
  throw new Error("Expected ledger posting");
}

const legs = ledgerCall[1] as Array<{
  assetSymbol: string;
  direction: "DEBIT" | "CREDIT";
  amount: Decimal;
}>;

    for (const asset of ["BTC", "USDT"]) {
      const assetLegs = legs.filter(
        (leg) => leg.assetSymbol === asset
      );

      const debits = assetLegs
        .filter((leg) => leg.direction === "DEBIT")
        .reduce(
          (sum, leg) => sum.plus(leg.amount),
          new Decimal(0)
        );

      const credits = assetLegs
        .filter((leg) => leg.direction === "CREDIT")
        .reduce(
          (sum, leg) => sum.plus(leg.amount),
          new Decimal(0)
        );

      expect(debits.eq(credits)).toBe(true);
    }

    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });

  it("does not execute orders when no OPEN orders exist", async () => {
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);

    const result = await matchOpenLimitOrders();

    expect(result.scanned).toBe(0);
    expect(result.filled).toBe(0);

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.postLedger).not.toHaveBeenCalled();
  });

  it("does not execute orders using stale market data", async () => {
    mocks.getOrderBook.mockResolvedValue({
      symbol: "BTCUSDT",
      status: "stale",
      timestamp: new Date(Date.now() - 60000),
      asks: [],
      bids: [],
    });

    const result = await matchOpenLimitOrders();

    expect(result.scanned).toBe(1);
    expect(result.filled).toBe(0);
    expect(result.skipped).toBe(1);

    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.postLedger).not.toHaveBeenCalled();
  });

  it("prevents settlement when another process claims the order", async () => {
    const tx = {
      cryptoOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: "order-1",
          userId: "user-1",
          symbol: "BTCUSDT",
          side: "BUY",
          type: "LIMIT",
          status: "OPEN",
          quantity: new Decimal("0.1"),
          limitPrice: new Decimal("60000"),
        }),

        // Another matcher or cancellation already claimed it.
        updateMany: vi.fn().mockResolvedValue({
          count: 0,
        }),
      },
    };

    mocks.transaction.mockImplementation(
      async (callback) => callback(tx)
    );

    const result = await matchOpenLimitOrders();

    expect(result.filled).toBe(0);
    expect(result.skipped).toBe(1);

    expect(mocks.postLedger).not.toHaveBeenCalled();
  });
});