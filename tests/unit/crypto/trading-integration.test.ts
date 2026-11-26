import { describe, it, expect, beforeAll, beforeEach, vi, afterEach } from "vitest";
import Decimal from "decimal.js";
import { matchOpenLimitOrders } from "@/features/crypto/limit-order-matcher";
import { getOrderBook } from "@/lib/market/service";
import { prisma } from "@/lib/db/prisma";
import { placeOrder, cancelOrder } from "@/features/crypto/trading";
import { createConversionQuote, executeConversion } from "@/features/crypto/conversion";
import { assertBalancedPosting } from "@/lib/ledger/postLedgerEntries";
import type { PostingLeg } from "@/lib/ledger/types";
import { randomUUID } from "node:crypto";

import {
  ensureAssetBalanceAndLedgerAccount,
} from "@/features/crypto/wallet-helpers";

import {
  getOrCreatePlatformLedgerAccount,
  demoFundingPoolName,
} from "@/lib/ledger/platform-accounts";

import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";

/**
 * Phase 4 Trading — Integration Tests
 * 
 * Uses real Prisma transaction infrastructure and ledger validation.
 * Tests per-asset balancing, fee accounting, wallet balances, and reservation release.
 * 
 * These tests verify the actual implementation without extensive mocking.
 */

// Mock only external dependencies
vi.mock("@/lib/market/service", () => ({
  getOrderBook: vi.fn().mockImplementation(async () => ({
  symbol: "BTCUSDT",
  status: "live",
  timestamp: new Date(),
  asks: [
    {
      price: new Decimal("57900"),
      quantity: new Decimal("1"),
    },
  ],
  bids: [
    {
      price: new Decimal("57800"),
      quantity: new Decimal("1"),
    },
  ],
})),
  getMarketTicker: vi.fn().mockResolvedValue({
    symbol: "BTCUSDT",
    lastPrice: new Decimal(60000),
    high24h: new Decimal(62000),
    low24h: new Decimal(58000),
    volume24h: new Decimal(1000),
    quoteVolume24h: new Decimal(60000000),
    priceChange24h: new Decimal(1000),
    priceChangePercent24h: new Decimal(1.69),
    status: "live",
    timestamp: new Date(),
  }),
  getTradingInstruments: vi.fn().mockResolvedValue([
    {
      symbol: "BTCUSDT",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      status: "active",
      pricePrecision: 2,
      quantityPrecision: 6,
      minOrderQuantity: new Decimal(0.0001),
      maxOrderQuantity: new Decimal(100),
      minOrderValue: new Decimal(10),
    },
  ]),
}));
// Enable simulated trading only inside this test module.
// This does not modify the application feature flag.
vi.mock("@/lib/feature-flags", () => ({
  CRYPTO_TRADING_ENABLED: true,
  CRYPTO_CONVERSION_ENABLED: true,
}));

describe("Phase 4 Trading — Integration Tests", () => {
  let testUserId = "";
let testWalletId: string;
let testFundingGroupId = "";
it("should settle a LIMIT BUY against real PostgreSQL", async () => {
  const placed = await placeOrder({
    userId: testUserId,
    symbol: "BTCUSDT",
    side: "BUY",
    type: "LIMIT",
    quantity: "0.05",
    limitPrice: "58000",
    idempotencyKey: `phase6-limit-buy-${randomUUID()}`,
  });

  expect(placed.success).toBe(true);
  expect(placed.orderId).toBeDefined();

  const before = await prisma.cryptoOrder.findUniqueOrThrow({
    where: { id: placed.orderId! },
  });

  expect(before.status).toBe("OPEN");

  const reservedBalance = await prisma.assetBalance.findUniqueOrThrow({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "USDT",
      },
    },
  });

  // 0.05 BTC * 58,000 = 2,900 USDT reserved.
  expect(reservedBalance.locked.toString()).toBe("2900");
  expect(reservedBalance.available.toString()).toBe("7100");

  // Execute the actual matcher against PostgreSQL.
  const result = await matchOpenLimitOrders();

  expect(result.disabled).toBe(false);
  expect(result.filled).toBe(1);
  expect(result.failed).toBe(0);

  const filledOrder = await prisma.cryptoOrder.findUniqueOrThrow({
    where: { id: placed.orderId! },
  });

  expect(filledOrder.status).toBe("FILLED");
  expect(filledOrder.filledPrice?.toString()).toBe("57900");
  expect(filledOrder.feeAmount.toString()).toBe("0.000025");
  expect(filledOrder.ledgerGroupId).toBeTruthy();

  const usdt = await prisma.assetBalance.findUniqueOrThrow({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "USDT",
      },
    },
  });

  const btc = await prisma.assetBalance.findUniqueOrThrow({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "BTC",
      },
    },
  });

  // Reserved: 2,900
  // Actual cost: 0.05 * 57,900 = 2,895
  // Refund: 5 USDT
  expect(usdt.available.toString()).toBe("7105");
  expect(usdt.locked.toString()).toBe("0");

  // BTC received after 0.05% maker fee.
  expect(btc.available.toString()).toBe("0.049975");

  // Verify the real persisted ledger entries.
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      groupId: filledOrder.ledgerGroupId!,
    },
  });

  const legs: PostingLeg[] = entries.map((entry) => ({
    ledgerAccountId: entry.ledgerAccountId,
    direction: entry.direction,
    assetSymbol: entry.assetSymbol,
    amount: new Decimal(entry.amount.toString()),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
  }));

  expect(legs.length).toBeGreaterThan(0);
  expect(() => assertBalancedPosting(legs)).not.toThrow();

  // Running the matcher again must not settle this order twice.
  const secondRun = await matchOpenLimitOrders();

  expect(secondRun.filled).toBe(0);

  const orderAfterRetry = await prisma.cryptoOrder.findUniqueOrThrow({
    where: { id: placed.orderId! },
  });

  expect(orderAfterRetry.ledgerGroupId).toBe(
    filledOrder.ledgerGroupId
  );

  const entryCountAfterRetry = await prisma.ledgerEntry.count({
    where: {
      groupId: filledOrder.ledgerGroupId!,
    },
  });

  expect(entryCountAfterRetry).toBe(entries.length);
});
it("should settle a LIMIT SELL against real PostgreSQL", async () => {
  // First acquire BTC using the existing funded wallet.
  const buy = await placeOrder({
    userId: testUserId,
    symbol: "BTCUSDT",
    side: "BUY",
    type: "MARKET",
    quantity: "0.1",
    idempotencyKey: `phase6-sell-funding-${randomUUID()}`,
  });

  expect(buy.success).toBe(true);

  // Configure a fresh, executable SELL market snapshot.
  vi.mocked(getOrderBook).mockResolvedValueOnce({
    symbol: "BTCUSDT",
    status: "live",
    timestamp: new Date(),
    asks: [
      {
        price: new Decimal("61200"),
        quantity: new Decimal("1"),
      },
    ],
    bids: [
      {
        price: new Decimal("61100"),
        quantity: new Decimal("1"),
      },
    ],
  });

  const placed = await placeOrder({
    userId: testUserId,
    symbol: "BTCUSDT",
    side: "SELL",
    type: "LIMIT",
    quantity: "0.05",
    limitPrice: "61000",
    idempotencyKey: `phase6-limit-sell-${randomUUID()}`,
  });

  expect(placed.success).toBe(true);

  const before = await prisma.cryptoOrder.findUniqueOrThrow({
    where: { id: placed.orderId! },
  });

  expect(before.status).toBe("OPEN");

  const btcBefore = await prisma.assetBalance.findUniqueOrThrow({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "BTC",
      },
    },
  });

  expect(btcBefore.locked.toString()).toBe("0.05");

  // Execute the real matcher.
  const result = await matchOpenLimitOrders();

  expect(result.filled).toBe(1);
  expect(result.failed).toBe(0);

  const filledOrder = await prisma.cryptoOrder.findUniqueOrThrow({
    where: { id: placed.orderId! },
  });

  expect(filledOrder.status).toBe("FILLED");
  expect(filledOrder.filledPrice?.toString()).toBe("61100");

  // Gross: 0.05 * 61,100 = 3,055 USDT
  // Maker fee: 0.05% = 1.5275 USDT
  expect(filledOrder.feeAmount.toString()).toBe("1.5275");

  const btc = await prisma.assetBalance.findUniqueOrThrow({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "BTC",
      },
    },
  });

  const usdt = await prisma.assetBalance.findUniqueOrThrow({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "USDT",
      },
    },
  });

  // Initial market BUY acquired 0.0999 BTC.
  // Limit SELL consumed 0.05 BTC.
  expect(btc.available.toString()).toBe("0.0499");
  expect(btc.locked.toString()).toBe("0");

  // USDT after BUY: 4,000
  // Net SELL proceeds: 3,053.4725
  expect(usdt.available.toString()).toBe("7053.4725");

  expect(filledOrder.ledgerGroupId).toBeTruthy();

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      groupId: filledOrder.ledgerGroupId!,
    },
  });

  const legs: PostingLeg[] = entries.map((entry) => ({
    ledgerAccountId: entry.ledgerAccountId,
    direction: entry.direction,
    assetSymbol: entry.assetSymbol,
    amount: new Decimal(entry.amount.toString()),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
  }));

  expect(legs.length).toBeGreaterThan(0);
  expect(() => assertBalancedPosting(legs)).not.toThrow();

  const feeEntry = legs.find(
    (entry) =>
      entry.referenceType === "CryptoTradeFee" &&
      entry.assetSymbol === "USDT" &&
      entry.direction === "DEBIT"
  );

  expect(feeEntry?.amount.toString()).toBe("1.5275");
});
  // SAFETY CHECK: Ensure we're running against an isolated test database
  beforeAll(async () => {
  const expectedDatabase = "platinum_trust_bank";
  const expectedSchema = "phase6_test";

  const expectedConfirmation =
    `${expectedDatabase}.${expectedSchema}`;

  if (
    process.env.SUNROVO_TEST_DB_CONFIRM !==
    expectedConfirmation
  ) {
    throw new Error(
      "SAFETY STOP: Explicit Phase 6 test database confirmation required."
    );
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "SAFETY STOP: DATABASE_URL is missing."
    );
  }

  const url = new URL(databaseUrl);

  const configuredDatabase = decodeURIComponent(
    url.pathname.replace(/^\/+/, "")
  );

  const configuredSchema = url.searchParams.get("schema");

  const allowedHosts = ["localhost", "127.0.0.1"];

  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !allowedHosts.includes(url.hostname) ||
    configuredDatabase !== expectedDatabase ||
    configuredSchema !== expectedSchema
  ) {
    throw new Error(
      "SAFETY STOP: Refusing to run tests outside the isolated Phase 6 database."
    );
  }

  // Verify the actual PostgreSQL connection.
  const identity = await prisma.$queryRaw<
    Array<{
      databaseName: string;
      schemaName: string;
    }>
  >`
    SELECT
      current_database() AS "databaseName",
      current_schema() AS "schemaName"
  `;

  const connectedIdentity = identity[0];

if (
  identity.length !== 1 ||
  !connectedIdentity ||
  connectedIdentity.databaseName !== expectedDatabase ||
  connectedIdentity.schemaName !== expectedSchema
) {
  throw new Error(
    "SAFETY STOP: PostgreSQL connection identity mismatch."
  );
}

    console.log(
    "Phase 6 database verified:",
    `${expectedDatabase}.${expectedSchema}`
  );
});

beforeEach(async () => {
  testUserId = `phase4-test-${randomUUID()}`;
testWalletId = "";
testFundingGroupId = "";

  

  await prisma.$transaction(async (tx) => {
    // Create a unique temporary test user.
    await tx.user.create({
      data: {
        id: testUserId,
        email: `phase4-${randomUUID()}@test.invalid`,
        passwordHash: "integration-test-only",
        emailVerifiedAt: new Date(),
        role: "USER",
      },
    });

    // Create the test wallet.
    const wallet = await tx.cryptoWallet.create({
      data: {
        userId: testUserId,
        label: "Phase 4 Integration Test Wallet",
      },
    });

    testWalletId = wallet.id;

    // Obtain the wallet's USDT balance and ledger account.
    const {
      balance,
      ledgerAccount,
    } = await ensureAssetBalanceAndLedgerAccount(
      tx,
      wallet.id,
      "USDT"
    );

    // Obtain the simulated funding counterparty.
    const fundingPool =
      await getOrCreatePlatformLedgerAccount(tx, {
        type: "ASSET",
        assetSymbol: "USDT",
        name: demoFundingPoolName("USDT"),
      });

    const fundingAmount = new Decimal("10000");

    // Record balanced funding entries.
    const fundingPosting = await postLedgerEntries(tx, [
      {
        ledgerAccountId: ledgerAccount.id,
        direction: "DEBIT",
        assetSymbol: "USDT",
        amount: fundingAmount,
        referenceType: "Phase4TestFunding",
        referenceId: testUserId,
      },
      {
        ledgerAccountId: fundingPool.id,
        direction: "CREDIT",
        assetSymbol: "USDT",
        amount: fundingAmount,
        referenceType: "Phase4TestFunding",
        referenceId: testUserId,
      },
    ]);
testFundingGroupId = fundingPosting.groupId;
    // Update the balance cache within the same transaction.
    await tx.assetBalance.update({
      where: {
        id: balance.id,
      },
      data: {
        available: {
          increment: fundingAmount,
        },
      },
    });
  });
});

  afterEach(async () => {
  try {
    if (!testUserId) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Identify orders created by this test user.
const orders = await tx.cryptoOrder.findMany({
  where: {
    userId: testUserId,
  },
  select: {
    ledgerGroupId: true,
  },
});

// Identify the exact ledger posting groups created
// by this test's funding and completed trades.
const ledgerGroupIds = [
  testFundingGroupId,
  ...orders.flatMap((order) =>
    order.ledgerGroupId ? [order.ledgerGroupId] : []
  ),
].filter((groupId) => groupId.length > 0);

// Delete both wallet and platform counterparty entries
// belonging to these exact transaction groups.
if (ledgerGroupIds.length > 0) {
  await tx.ledgerEntry.deleteMany({
    where: {
      groupId: {
        in: ledgerGroupIds,
      },
    },
  });
}

      await tx.cryptoOrder.deleteMany({
        where: {
          userId: testUserId,
        },
      });

      // Phase 6: Identify conversion settlement groups.
      const conversions = await tx.conversion.findMany({
        where: {
          userId: testUserId,
        },
        select: {
          ledgerGroupId: true,
        },
      });

      const conversionLedgerGroupIds = conversions
        .flatMap((conv) =>
          conv.ledgerGroupId ? [conv.ledgerGroupId] : []
        )
        .filter((groupId) => groupId.length > 0);

      // Phase 6: Delete conversion transaction-history records.
      await tx.transaction.deleteMany({
        where: {
          userId: testUserId,
          type: "CONVERSION",
        },
      });

      // Phase 6: Delete conversion ledger entries.
      if (conversionLedgerGroupIds.length > 0) {
        await tx.ledgerEntry.deleteMany({
          where: {
            groupId: {
              in: conversionLedgerGroupIds,
            },
          },
        });
      }

      // Phase 6: Delete conversion records.
      await tx.conversion.deleteMany({
        where: {
          userId: testUserId,
        },
      });

      // Phase 6: Delete conversion quotes.
      await tx.conversionQuote.deleteMany({
        where: {
          userId: testUserId,
        },
      });

      await tx.auditLog.deleteMany({
        where: {
          actorUserId: testUserId,
        },
      });

      if (testWalletId) {
        await tx.ledgerAccount.deleteMany({
          where: {
            cryptoWalletId: testWalletId,
          },
        });

        await tx.assetBalance.deleteMany({
          where: {
            walletId: testWalletId,
          },
        });

        await tx.cryptoWallet.deleteMany({
          where: {
            id: testWalletId,
            userId: testUserId,
          },
        });
      }

      await tx.user.deleteMany({
        where: {
          id: testUserId,
        },
      });
    });
 } finally {
  vi.clearAllMocks();
}
});

  it("should create balanced ledger entries per asset for BUY market order", async () => {
    const result = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.1",
      idempotencyKey: `int-test-buy-${Date.now()}`,
    });

    expect(result.success).toBe(true);
expect(result.orderId).toBeDefined();

// Retrieve the actual order committed to PostgreSQL.
const order = await prisma.cryptoOrder.findUnique({
  where: {
    id: result.orderId!,
  },
  select: {
    ledgerGroupId: true,
  },
});

expect(order?.ledgerGroupId).toBeTruthy();

// Retrieve the actual ledger entries committed
// for this specific trading transaction.
const postedEntries = await prisma.ledgerEntry.findMany({
  where: {
    groupId: order!.ledgerGroupId!,
  },
});

// Convert persisted rows into the standard ledger
// posting structure used by the validation utility.
const capturedLedgerLegs: PostingLeg[] = postedEntries.map(
  (entry) => ({
    ledgerAccountId: entry.ledgerAccountId,
    direction: entry.direction,
    assetSymbol: entry.assetSymbol,
    amount: new Decimal(entry.amount.toString()),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
  })
);

expect(capturedLedgerLegs.length).toBeGreaterThan(0);
    // Verify ledger legs are balanced per asset
    expect(() => assertBalancedPosting(capturedLedgerLegs)).not.toThrow();

    // Verify BTC legs balance
    const btcLegs = capturedLedgerLegs.filter((l) => l.assetSymbol === "BTC");
    const btcDebits = btcLegs
      .filter((l) => l.direction === "DEBIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    const btcCredits = btcLegs
      .filter((l) => l.direction === "CREDIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    expect(btcDebits.toString()).toBe(btcCredits.toString());

    // Verify USDT legs balance
    const usdtLegs = capturedLedgerLegs.filter((l) => l.assetSymbol === "USDT");
    const usdtDebits = usdtLegs
      .filter((l) => l.direction === "DEBIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    const usdtCredits = usdtLegs
      .filter((l) => l.direction === "CREDIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    expect(usdtDebits.toString()).toBe(usdtCredits.toString());
  });

  it("should correctly update wallet balances after market order", async () => {
    const result = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.1",
      idempotencyKey: `int-test-balance-${Date.now()}`,
    });

    expect(result.success).toBe(true);

    // Check wallet balances
    const usdtBalance = await prisma.assetBalance.findUnique({
      where: { walletId_assetSymbol: { walletId: testWalletId, assetSymbol: "USDT" } },
    });

    const btcBalance = await prisma.assetBalance.findUnique({
      where: { walletId_assetSymbol: { walletId: testWalletId, assetSymbol: "BTC" } },
    });

    // USDT should be reduced by (quantity * price)
    expect(usdtBalance?.available.toNumber()).toBeLessThan(10000);

    // BTC should be increased (minus fee)
    expect(btcBalance?.available.toNumber()).toBeGreaterThan(0);
    expect(btcBalance?.available.toNumber()).toBeLessThan(0.1); // Less than full quantity due to fee
  });

  it("should properly lock funds for limit order", async () => {
    const result = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: "0.05",
      limitPrice: "58000",
      idempotencyKey: `int-test-limit-${Date.now()}`,
    });

    expect(result.success).toBe(true);

    // Check wallet balances
    const usdtBalance = await prisma.assetBalance.findUnique({
      where: { walletId_assetSymbol: { walletId: testWalletId, assetSymbol: "USDT" } },
    });

    // USDT should be moved from available to locked
    const expectedLocked = new Decimal(0.05).times(58000); // quantity * limitPrice
    expect(usdtBalance?.locked.toString()).toBe(expectedLocked.toString());
    expect(usdtBalance?.available.toString()).toBe(new Decimal(10000).minus(expectedLocked).toString());
  });

  it("should properly release locked funds on order cancellation", async () => {
    // Place limit order
    const placeResult = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: "0.05",
      limitPrice: "58000",
      idempotencyKey: `int-test-cancel-${Date.now()}`,
    });

    expect(placeResult.success).toBe(true);
    const orderId = placeResult.orderId!;

    // Verify funds are locked
    let usdtBalance = await prisma.assetBalance.findUnique({
      where: { walletId_assetSymbol: { walletId: testWalletId, assetSymbol: "USDT" } },
    });
    expect(usdtBalance?.locked.toNumber()).toBeGreaterThan(0);

    // Cancel order
    const cancelResult = await cancelOrder({
      userId: testUserId,
      orderId,
    });

    expect(cancelResult.success).toBe(true);

    // Verify funds are released
    usdtBalance = await prisma.assetBalance.findUnique({
      where: { walletId_assetSymbol: { walletId: testWalletId, assetSymbol: "USDT" } },
    });
    expect(usdtBalance?.locked.toString()).toBe("0");
    expect(usdtBalance?.available.toString()).toBe("10000");

    // Verify order status
    const order = await prisma.cryptoOrder.findUnique({ where: { id: orderId } });
    expect(order?.status).toBe("CANCELLED");
  });

  it("should verify fee accounting in ledger entries", async () => {
    const result = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.1",
      idempotencyKey: `int-test-fee-${Date.now()}`,
    });

    // Find fee-related ledger entries
    expect(result.success).toBe(true);
expect(result.orderId).toBeDefined();

const order = await prisma.cryptoOrder.findUnique({
  where: {
    id: result.orderId!,
  },
  select: {
    ledgerGroupId: true,
  },
});

expect(order?.ledgerGroupId).toBeTruthy();

// Read fee entries committed to PostgreSQL.
const feeLegs = await prisma.ledgerEntry.findMany({
  where: {
    groupId: order!.ledgerGroupId!,
    referenceType: "CryptoTradeFee",
  },
});

    expect(feeLegs.length).toBeGreaterThan(0);

    // Fee should be debited to fee revenue account
    const feeLeg = feeLegs.find((l) => l.direction === "DEBIT" && l.assetSymbol === "BTC");
    expect(feeLeg).toBeDefined();

    // Fee amount should be approximately 0.1% of quantity
    const expectedFee = new Decimal(0.1).times(0.001);
    expect(new Decimal(feeLeg!.amount).toString()).toBe(expectedFee.toString());
  });

  it("should reject idempotency key reuse with different parameters", async () => {
    const idempKey = `int-test-idem-${Date.now()}`;

    // First order
    const result1 = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.1",
      idempotencyKey: idempKey,
    });

    expect(result1.success).toBe(true);

    // Attempt reuse with different quantity
    const result2 = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.2", // Different!
      idempotencyKey: idempKey,
    });

    expect(result2.success).toBe(false);
    expect(result2.error).toContain("different order parameters");

    // Verify only one order was created
    const orders = await prisma.cryptoOrder.findMany({
      where: { idempotencyKey: idempKey },
    });
    expect(orders.length).toBe(1);
  });

  it("should accept idempotency key reuse with identical parameters", async () => {
    const idempKey = `int-test-idem-same-${Date.now()}`;
    const orderParams = {
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY" as const,
      type: "MARKET" as const,
      quantity: "0.1",
      idempotencyKey: idempKey,
    };

    // First order
    const result1 = await placeOrder(orderParams);
    expect(result1.success).toBe(true);

    // Retry with identical parameters
    const result2 = await placeOrder(orderParams);
    expect(result2.success).toBe(true);
    expect(result2.orderId).toBe(result1.orderId);

    // Verify only one order was created
    const orders = await prisma.cryptoOrder.findMany({
      where: { idempotencyKey: idempKey },
    });
    expect(orders.length).toBe(1);
  });
it("should settle market SELL using existing wallet balances", async () => {
  // Step 1: Buy BTC using the existing funded USDT wallet.
  const buyResult = await placeOrder({
    userId: testUserId,
    symbol: "BTCUSDT",
    side: "BUY",
    type: "MARKET",
    quantity: "0.05",
    idempotencyKey: `phase6-sell-setup-${randomUUID()}`,
  });

  expect(buyResult.success).toBe(true);

  // Step 2: Confirm BTC was credited.
  const btcBeforeSell = await prisma.assetBalance.findUnique({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "BTC",
      },
    },
  });

  // 0.05 BTC minus the 0.1% buying fee.
  expect(btcBeforeSell?.available.toString()).toBe("0.04995");

  // Step 3: Sell 0.04 BTC from that same wallet.
  const sellResult = await placeOrder({
    userId: testUserId,
    symbol: "BTCUSDT",
    side: "SELL",
    type: "MARKET",
    quantity: "0.04",
    idempotencyKey: `phase6-market-sell-${randomUUID()}`,
  });

  expect(sellResult.success).toBe(true);
  expect(sellResult.orderId).toBeDefined();

  // Step 4: Verify the committed order.
  const sellOrder = await prisma.cryptoOrder.findUniqueOrThrow({
    where: { id: sellResult.orderId! },
  });

  expect(sellOrder.status).toBe("FILLED");
  expect(sellOrder.side).toBe("SELL");
  expect(sellOrder.quantity.toString()).toBe("0.04");

  // 0.04 BTC * 60,000 USDT = 2,400 USDT
  // Trading fee = 0.1% = 2.4 USDT
  expect(sellOrder.feeAmount.toString()).toBe("2.4");

  // Step 5: Verify the customer's actual wallet balances.
  const btcAfterSell = await prisma.assetBalance.findUnique({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "BTC",
      },
    },
  });

  const usdtAfterSell = await prisma.assetBalance.findUnique({
    where: {
      walletId_assetSymbol: {
        walletId: testWalletId,
        assetSymbol: "USDT",
      },
    },
  });

  // BTC: 0.04995 - 0.04 = 0.00995
  expect(btcAfterSell?.available.toString()).toBe("0.00995");

  // USDT:
  // Initial funding: 10,000
  // BTC purchase: -3,000
  // BTC sale proceeds after fee: +2,397.6
  // Final balance: 9,397.6
  expect(usdtAfterSell?.available.toString()).toBe("9397.6");

  expect(btcAfterSell?.locked.toString()).toBe("0");
  expect(usdtAfterSell?.locked.toString()).toBe("0");

  // Step 6: Verify actual PostgreSQL ledger entries.
  expect(sellOrder.ledgerGroupId).toBeTruthy();

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      groupId: sellOrder.ledgerGroupId!,
    },
  });

  const ledgerLegs: PostingLeg[] = entries.map((entry) => ({
    ledgerAccountId: entry.ledgerAccountId,
    direction: entry.direction,
    assetSymbol: entry.assetSymbol,
    amount: new Decimal(entry.amount.toString()),
    referenceType: entry.referenceType,
    referenceId: entry.referenceId,
  }));

  expect(ledgerLegs.length).toBeGreaterThan(0);

  // Every asset must balance independently.
  expect(() => assertBalancedPosting(ledgerLegs)).not.toThrow();

  // Step 7: Verify the USDT trading fee was recorded.
  const feeEntry = ledgerLegs.find(
    (entry) =>
      entry.referenceType === "CryptoTradeFee" &&
      entry.assetSymbol === "USDT"
  );

  expect(feeEntry).toBeDefined();
  expect(feeEntry?.amount.toString()).toBe("2.4");
});

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase 6: Cryptocurrency Conversion Integration Tests
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it("should execute USDT → BTC conversion with balanced ledger settlement", async () => {
    // Mock fresh BTCUSDT order book with executable liquidity
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60100"), quantity: new Decimal("1.0") },
        { price: new Decimal("60200"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    // Step 1: Create conversion quote
    const quoteResult = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "3000",
    });

    expect(quoteResult.success).toBe(true);
    expect(quoteResult.quoteId).toBeDefined();

    // Verify quote persisted to PostgreSQL
    const quote = await prisma.conversionQuote.findUniqueOrThrow({
      where: { id: quoteResult.quoteId! },
    });

    expect(quote.fromAsset).toBe("USDT");
    expect(quote.toAsset).toBe("BTC");
    expect(quote.fromAmount.toString()).toBe("3000");
    expect(quote.consumedAt).toBeNull();

    // The authoritative expected value is what the quote stored.
    // The conversion-pricing module already applied ROUND_DOWN rules.
    const authoritativeNetAmount = quote.toAmount;

    // Step 2: Execute conversion
    const idempotencyKey = `phase6-conv-usdt-btc-${randomUUID()}`;

    const execResult = await executeConversion({
      userId: testUserId,
      quoteId: quoteResult.quoteId!,
      idempotencyKey,
    });

    expect(execResult.success).toBe(true);
    expect(execResult.conversionId).toBeDefined();

    // Step 3: Verify quote consumed
    const consumedQuote = await prisma.conversionQuote.findUniqueOrThrow({
      where: { id: quoteResult.quoteId! },
    });

    expect(consumedQuote.consumedAt).not.toBeNull();

    // Step 4: Verify conversion record
    const conversion = await prisma.conversion.findUniqueOrThrow({
      where: { id: execResult.conversionId! },
    });

    expect(conversion.status).toBe("COMPLETED");
    expect(conversion.userId).toBe(testUserId);
    expect(conversion.fromAsset).toBe("USDT");
    expect(conversion.toAsset).toBe("BTC");
    expect(conversion.fromAmount.toString()).toBe("3000");
    expect(conversion.ledgerGroupId).toBeTruthy();

    // Step 5: Verify wallet balances
    const usdtBalance = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    const btcBalance = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    // USDT: 10000 - 3000 = 7000
    expect(usdtBalance.available.toString()).toBe("7000");
    expect(usdtBalance.locked.toString()).toBe("0");

    // BTC: 0 + authoritative net amount from quote
    expect(btcBalance.available.toString()).toBe(authoritativeNetAmount.toString());
    expect(btcBalance.locked.toString()).toBe("0");

    // Step 6: Verify transaction history
    const txnHistory = await prisma.transaction.findMany({
      where: {
        userId: testUserId,
        type: "CONVERSION",
        referenceId: conversion.id,
      },
    });

    expect(txnHistory.length).toBe(1);
    expect(txnHistory[0]!.assetSymbol).toBe("USDT");
    expect(txnHistory[0]!.amount.toString()).toBe("3000");
    expect(txnHistory[0]!.status).toBe("COMPLETED");

    // Step 7: Verify ledger entries balance
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: conversion.ledgerGroupId! },
    });

    const legs: PostingLeg[] = ledgerEntries.map((entry) => ({
      ledgerAccountId: entry.ledgerAccountId,
      direction: entry.direction,
      assetSymbol: entry.assetSymbol,
      amount: new Decimal(entry.amount.toString()),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
    }));

    expect(legs.length).toBeGreaterThan(0);
    expect(() => assertBalancedPosting(legs)).not.toThrow();

    // Verify BTC ledger balances
    const btcLegs = legs.filter((l) => l.assetSymbol === "BTC");
    const btcDebits = btcLegs
      .filter((l) => l.direction === "DEBIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    const btcCredits = btcLegs
      .filter((l) => l.direction === "CREDIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    expect(btcDebits.toString()).toBe(btcCredits.toString());

    // Verify USDT ledger balances
    const usdtLegs = legs.filter((l) => l.assetSymbol === "USDT");
    const usdtDebits = usdtLegs
      .filter((l) => l.direction === "DEBIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    const usdtCredits = usdtLegs
      .filter((l) => l.direction === "CREDIT")
      .reduce((sum, l) => sum.plus(l.amount), new Decimal(0));
    expect(usdtDebits.toString()).toBe(usdtCredits.toString());

    // Step 8: Verify fee revenue entry
    const feeEntry = legs.find(
      (l) => l.referenceType === "ConversionFee" && l.assetSymbol === "BTC" && l.direction === "DEBIT"
    );
    expect(feeEntry).toBeDefined();
    expect(feeEntry!.amount.toString()).toBe(quote.feeAmount.toString());
  });

  it("should execute BTC → USDT conversion after acquiring BTC", async () => {
    // Step 1: Acquire BTC first through conversion
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    const btcAcquireQuote = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "6000",
    });

    expect(btcAcquireQuote.success).toBe(true);

    await executeConversion({
      userId: testUserId,
      quoteId: btcAcquireQuote.quoteId!,
      idempotencyKey: `phase6-conv-acquire-btc-${randomUUID()}`,
    });

    // Verify BTC acquired
    const btcAfterAcquire = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    expect(btcAfterAcquire.available.gt(0)).toBe(true);
    const acquiredBTC = btcAfterAcquire.available;

    // Step 2: Convert BTC back to USDT
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60200"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    const convertBackAmount = acquiredBTC.times("0.5"); // Convert half

    const btcToUsdtQuote = await createConversionQuote({
      userId: testUserId,
      fromAsset: "BTC",
      toAsset: "USDT",
      fromAmount: convertBackAmount.toString(),
    });

    expect(btcToUsdtQuote.success).toBe(true);

    const convertBackResult = await executeConversion({
      userId: testUserId,
      quoteId: btcToUsdtQuote.quoteId!,
      idempotencyKey: `phase6-conv-btc-usdt-${randomUUID()}`,
    });

    expect(convertBackResult.success).toBe(true);

    // Step 3: Verify balances
    const finalBtc = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    const finalUsdt = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    // BTC should be reduced
    expect(finalBtc.available.lt(acquiredBTC)).toBe(true);

    // USDT should be increased from the conversion
    expect(finalUsdt.available.gt(4000)).toBe(true); // After spending 6000 and getting some back

    // Step 4: Verify conversion record and ledger balance
    const conversion = await prisma.conversion.findUniqueOrThrow({
      where: { id: convertBackResult.conversionId! },
    });

    expect(conversion.fromAsset).toBe("BTC");
    expect(conversion.toAsset).toBe("USDT");
    expect(conversion.status).toBe("COMPLETED");

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: conversion.ledgerGroupId! },
    });

    const legs: PostingLeg[] = ledgerEntries.map((entry) => ({
      ledgerAccountId: entry.ledgerAccountId,
      direction: entry.direction,
      assetSymbol: entry.assetSymbol,
      amount: new Decimal(entry.amount.toString()),
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
    }));

    expect(() => assertBalancedPosting(legs)).not.toThrow();
  });

  it("should enforce durable idempotency for conversion execution", async () => {
    // Mock order book
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    // Step 1: Create quote
    const quoteResult = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "1000",
    });

    expect(quoteResult.success).toBe(true);

    const idempotencyKey = `phase6-conv-idempotency-${randomUUID()}`;

    // Step 2: First execution
    const result1 = await executeConversion({
      userId: testUserId,
      quoteId: quoteResult.quoteId!,
      idempotencyKey,
    });

    expect(result1.success).toBe(true);
    const originalConversionId = result1.conversionId!;

    // Capture balances after first execution
    const btcAfterFirst = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    const usdtAfterFirst = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    // Step 3: Retry with same idempotency key
    const result2 = await executeConversion({
      userId: testUserId,
      quoteId: quoteResult.quoteId!,
      idempotencyKey, // Same key
    });

    expect(result2.success).toBe(true);
    expect(result2.conversionId).toBe(originalConversionId);

    // Step 4: Retry with different idempotency key
    const result3 = await executeConversion({
      userId: testUserId,
      quoteId: quoteResult.quoteId!,
      idempotencyKey: `different-key-${randomUUID()}`,
    });

    expect(result3.success).toBe(true);
    expect(result3.conversionId).toBe(originalConversionId);

    // Step 5: Verify exactly one conversion
    const conversions = await prisma.conversion.findMany({
      where: {
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
      },
    });

    expect(conversions.length).toBe(1);
    expect(conversions[0]!.id).toBe(originalConversionId);

    // Step 6: Verify exactly one transaction history record
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: testUserId,
        type: "CONVERSION",
        referenceId: originalConversionId,
      },
    });

    expect(transactions.length).toBe(1);

    // Step 7: Verify balances unchanged by retries
    const btcAfterRetries = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    const usdtAfterRetries = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    expect(btcAfterRetries.available.toString()).toBe(btcAfterFirst.available.toString());
    expect(usdtAfterRetries.available.toString()).toBe(usdtAfterFirst.available.toString());

    // Step 8: Verify ledger entries not duplicated
    const ledgerGroups = conversions.map((c) => c.ledgerGroupId).filter(Boolean);
    expect(ledgerGroups.length).toBe(1);

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: ledgerGroups[0]! },
    });

    // Should be a consistent set, not duplicated
    const entryCount = ledgerEntries.length;
    expect(entryCount).toBeGreaterThan(0);

    // All entries should reference the same group
    const uniqueGroups = new Set(ledgerEntries.map((e) => e.groupId));
    expect(uniqueGroups.size).toBe(1);
  });

  it("should reject expired quote without settlement", async () => {
    // Mock order book
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    // Step 1: Create quote
    const quoteResult = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "500",
    });

    expect(quoteResult.success).toBe(true);

    // Step 2: Manually expire the quote in the test database
    await prisma.conversionQuote.update({
      where: { id: quoteResult.quoteId! },
      data: { expiresAt: new Date(Date.now() - 1000) }, // 1 second ago
    });

    // Capture balances before attempted execution
    // Note: BTC balance may not exist yet since no conversion executed
    const btcBefore = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    const usdtBefore = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    // Step 3: Attempt execution
    const execResult = await executeConversion({
      userId: testUserId,
      quoteId: quoteResult.quoteId!,
      idempotencyKey: `phase6-conv-expired-${randomUUID()}`,
    });

    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain("expired");

    // Step 4: Verify no conversion record created
    const conversions = await prisma.conversion.findMany({
      where: {
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
      },
    });

    expect(conversions.length).toBe(0);

    // Step 5: Verify no transaction history created
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: testUserId,
        type: "CONVERSION",
      },
    });

    expect(transactions.length).toBe(0);

    // Step 6: Verify balances unchanged
    const btcAfter = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    const usdtAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    // BTC balance may not exist if no prior conversions created it
    if (btcBefore) {
      expect(btcAfter).toBeDefined();
      expect(btcAfter!.available.toString()).toBe(btcBefore.available.toString());
    } else {
      // If BTC balance didn't exist before, it should still not exist
      expect(btcAfter).toBeNull();
    }

    expect(usdtAfter.available.toString()).toBe(usdtBefore.available.toString());

    // Step 7: Verify quote not consumed
    const quote = await prisma.conversionQuote.findUniqueOrThrow({
      where: { id: quoteResult.quoteId! },
    });

    expect(quote.consumedAt).toBeNull();
  });

  it("should reject conversion with insufficient balance and rollback", async () => {
    // Mock order book
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    // Step 1: Create quote requiring more than available balance
    // Current balance is 10,000 USDT
    const quoteResult = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "15000", // More than available
    });

    expect(quoteResult.success).toBe(true);

    // Capture balances before execution
    const usdtBefore = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    // Step 2: Attempt execution
    const execResult = await executeConversion({
      userId: testUserId,
      quoteId: quoteResult.quoteId!,
      idempotencyKey: `phase6-conv-insufficient-${randomUUID()}`,
    });

    expect(execResult.success).toBe(false);
    expect(execResult.error).toContain("Insufficient");

    // Step 3: Verify PostgreSQL rolled back quote consumption
    const quote = await prisma.conversionQuote.findUniqueOrThrow({
      where: { id: quoteResult.quoteId! },
    });

    expect(quote.consumedAt).toBeNull();

    // Step 4: Verify no conversion record created
    const conversions = await prisma.conversion.findMany({
      where: {
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
      },
    });

    expect(conversions.length).toBe(0);

    // Step 5: Verify no transaction history created
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: testUserId,
        type: "CONVERSION",
      },
    });

    expect(transactions.length).toBe(0);

    // Step 6: Verify balances unchanged
    const usdtAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    expect(usdtAfter.available.toString()).toBe(usdtBefore.available.toString());
    expect(usdtAfter.locked.toString()).toBe("0");
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Phase 6: Concurrent Financial Operations & Reconciliation
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  it("should prevent double-spend with concurrent market orders", async () => {
    // Current balance: 10,000 USDT
    // Order 1: Buy 0.1 BTC @ 60,000 = 6,000 USDT
    // Order 2: Buy 0.1 BTC @ 60,000 = 6,000 USDT
    // Combined: 12,000 USDT (exceeds available)
    // Only one should succeed

    const usdtBefore = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    const initialAvailable = usdtBefore.available;

    // Execute two concurrent orders
    const [result1, result2] = await Promise.allSettled([
      placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: `phase6-concurrent-1-${randomUUID()}`,
      }),
      placeOrder({
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "MARKET",
        quantity: "0.1",
        idempotencyKey: `phase6-concurrent-2-${randomUUID()}`,
      }),
    ]);

    // At least one must succeed (non-deterministic which one wins)
    const successfulResults = [result1, result2].filter(
      (r) => r.status === "fulfilled" && r.value.success
    );

    expect(successfulResults.length).toBeGreaterThanOrEqual(1);
    expect(successfulResults.length).toBeLessThanOrEqual(2);

    // If both succeeded, combined cost must not exceed initial balance
    if (successfulResults.length === 2) {
      const totalCost = new Decimal(6000).times(2); // 12,000 USDT
      expect(totalCost.lte(initialAvailable)).toBe(true);
    }

    // Verify final balances are non-negative
    const usdtAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    expect(usdtAfter.available.gte(0)).toBe(true);
    expect(usdtAfter.locked.gte(0)).toBe(true);

    // Verify total spent does not exceed initial available
    const totalSpent = initialAvailable.minus(usdtAfter.available);
    expect(totalSpent.lte(initialAvailable)).toBe(true);

    // Verify each successful order has exactly one ledger group
    for (const result of successfulResults) {
      if (result.status === "fulfilled" && result.value.orderId) {
        const order = await prisma.cryptoOrder.findUnique({
          where: { id: result.value.orderId },
        });

        if (order?.ledgerGroupId) {
          const entries = await prisma.ledgerEntry.findMany({
            where: { groupId: order.ledgerGroupId },
          });

          expect(entries.length).toBeGreaterThan(0);

          // Verify entries belong to exactly one group
          const uniqueGroups = new Set(entries.map((e) => e.groupId));
          expect(uniqueGroups.size).toBe(1);
        }
      }
    }

    // Verify no negative balances
    const btcAfter = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    if (btcAfter) {
      expect(btcAfter.available.gte(0)).toBe(true);
      expect(btcAfter.locked.gte(0)).toBe(true);
    }
  });

  it("should handle concurrent conversion requests with insufficient combined balance", async () => {
    // Current balance: 10,000 USDT (or less from previous tests)
    // Quote 1: 7,000 USDT → BTC
    // Quote 2: 7,000 USDT → BTC
    // Combined: 14,000 USDT (exceeds available if balance < 14,000)

    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    const usdtBefore = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    const initialAvailable = usdtBefore.available;

    // Create two quotes
    const quote1 = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "7000",
    });

    const quote2 = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "7000",
    });

    expect(quote1.success).toBe(true);
    expect(quote2.success).toBe(true);

    // Execute concurrently
    const [result1, result2] = await Promise.allSettled([
      executeConversion({
        userId: testUserId,
        quoteId: quote1.quoteId!,
        idempotencyKey: `phase6-conv-concurrent-1-${randomUUID()}`,
      }),
      executeConversion({
        userId: testUserId,
        quoteId: quote2.quoteId!,
        idempotencyKey: `phase6-conv-concurrent-2-${randomUUID()}`,
      }),
    ]);

    // Collect successful conversions
    const successfulConversions = [result1, result2].filter(
      (r) => r.status === "fulfilled" && r.value.success
    );

    // If initial balance < 14,000, at most one should succeed
    if (initialAvailable.lt(14000)) {
      expect(successfulConversions.length).toBeLessThanOrEqual(1);
    }

    // Verify no negative balances
    const usdtAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    expect(usdtAfter.available.gte(0)).toBe(true);
    expect(usdtAfter.locked.gte(0)).toBe(true);

    // Verify total spent does not exceed initial available
    const totalSpent = initialAvailable.minus(usdtAfter.available);
    expect(totalSpent.lte(initialAvailable)).toBe(true);

    // Verify only successful conversions have records
    for (const result of [result1, result2]) {
      if (result.status === "fulfilled" && result.value.success) {
        const conversion = await prisma.conversion.findUnique({
          where: { id: result.value.conversionId! },
        });

        expect(conversion).toBeDefined();
        expect(conversion!.status).toBe("COMPLETED");
        expect(conversion!.ledgerGroupId).toBeTruthy();
      }
    }

    // Verify failed executions did not consume quotes or create partial records
    const allConversions = await prisma.conversion.findMany({
      where: { userId: testUserId },
    });

    // Number of conversion records should match successful executions
    expect(allConversions.length).toBe(successfulConversions.length);
  });

  it("should handle same conversion quote with simultaneous execution", async () => {
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    // Create one quote
    const quoteResult = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "500",
    });

    expect(quoteResult.success).toBe(true);

    const usdtBefore = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    const initialAvailable = usdtBefore.available;

    // Execute same quote concurrently with different idempotency keys
    const [result1, result2, result3] = await Promise.allSettled([
      executeConversion({
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
        idempotencyKey: `phase6-same-quote-1-${randomUUID()}`,
      }),
      executeConversion({
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
        idempotencyKey: `phase6-same-quote-2-${randomUUID()}`,
      }),
      executeConversion({
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
        idempotencyKey: `phase6-same-quote-3-${randomUUID()}`,
      }),
    ]);

    // All fulfilled results should return the same conversion ID
    const fulfilledResults = [result1, result2, result3].filter(
      (r) => r.status === "fulfilled"
    ) as PromiseFulfilledResult<{ success: boolean; conversionId?: string; error?: string }>[];

    const successfulConversions = fulfilledResults.filter((r) => r.value.success);

    expect(successfulConversions.length).toBeGreaterThanOrEqual(1);

    // All successful results should reference the same conversion
    if (successfulConversions.length > 0) {
      const conversionIds = successfulConversions.map((r) => r.value.conversionId);
      const uniqueIds = new Set(conversionIds);
      expect(uniqueIds.size).toBe(1);
    }

    // Verify exactly one conversion record
    const conversions = await prisma.conversion.findMany({
      where: {
        userId: testUserId,
        quoteId: quoteResult.quoteId!,
      },
    });

    expect(conversions.length).toBe(1);

    // Verify exactly one ledger group
    const conversion = conversions[0]!;
    expect(conversion.ledgerGroupId).toBeTruthy();

    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: conversion.ledgerGroupId! },
    });

    expect(ledgerEntries.length).toBeGreaterThan(0);

    const uniqueGroups = new Set(ledgerEntries.map((e) => e.groupId));
    expect(uniqueGroups.size).toBe(1);

    // Verify exactly one transaction history record
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: testUserId,
        type: "CONVERSION",
        referenceId: conversion.id,
      },
    });

    expect(transactions.length).toBe(1);

    // Verify quote consumed exactly once
    const quote = await prisma.conversionQuote.findUniqueOrThrow({
      where: { id: quoteResult.quoteId! },
    });

    expect(quote.consumedAt).not.toBeNull();

    // Verify wallet balances reflect only one conversion
    const usdtAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    const spent = initialAvailable.minus(usdtAfter.available);
    expect(spent.toString()).toBe("500");

    expect(usdtAfter.available.gte(0)).toBe(true);
  });

  it("should handle concurrent limit-order matcher execution", async () => {
    // Create an eligible OPEN limit order
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("57900"), quantity: new Decimal("1") },
      ],
      bids: [
        { price: new Decimal("57800"), quantity: new Decimal("1") },
      ],
    });

    const orderResult = await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "LIMIT",
      quantity: "0.02",
      limitPrice: "58000",
      idempotencyKey: `phase6-concurrent-matcher-${randomUUID()}`,
    });

    expect(orderResult.success).toBe(true);
    expect(orderResult.orderId).toBeDefined();

    const orderBefore = await prisma.cryptoOrder.findUniqueOrThrow({
      where: { id: orderResult.orderId! },
    });

    expect(orderBefore.status).toBe("OPEN");

    const usdtBefore = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    const reservedBefore = usdtBefore.locked;
    expect(reservedBefore.gt(0)).toBe(true);

    // Execute matcher concurrently
    const [match1, match2, match3] = await Promise.allSettled([
      matchOpenLimitOrders(),
      matchOpenLimitOrders(),
      matchOpenLimitOrders(),
    ]);

    // All should complete without throwing
    expect(match1.status).toBe("fulfilled");
    expect(match2.status).toBe("fulfilled");
    expect(match3.status).toBe("fulfilled");

    // Order should be FILLED exactly once
    const orderAfter = await prisma.cryptoOrder.findUniqueOrThrow({
      where: { id: orderResult.orderId! },
    });

    expect(orderAfter.status).toBe("FILLED");
    expect(orderAfter.ledgerGroupId).toBeTruthy();

    // Reserved balance should be consumed
    const usdtAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "USDT",
        },
      },
    });

    expect(usdtAfter.locked.toString()).toBe("0");
    expect(usdtAfter.available.gte(0)).toBe(true);

    // Verify exactly one settlement ledger group
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { groupId: orderAfter.ledgerGroupId! },
    });

    expect(ledgerEntries.length).toBeGreaterThan(0);

    const uniqueGroups = new Set(ledgerEntries.map((e) => e.groupId));
    expect(uniqueGroups.size).toBe(1);

    // Verify BTC credited once
    const btcAfter = await prisma.assetBalance.findUniqueOrThrow({
      where: {
        walletId_assetSymbol: {
          walletId: testWalletId,
          assetSymbol: "BTC",
        },
      },
    });

    expect(btcAfter.available.gt(0)).toBe(true);
    expect(btcAfter.locked.toString()).toBe("0");

    // Verify no duplicate fee posting
    const feeEntries = ledgerEntries.filter(
      (e) => e.referenceType === "CryptoTradeFee"
    );

    expect(feeEntries.length).toBeGreaterThan(0);

    // All fee entries should reference the same group
    const feeGroups = new Set(feeEntries.map((e) => e.groupId));
    expect(feeGroups.size).toBe(1);
  });

  it("should reconcile wallet balances against persisted ledger entries", async () => {
    // Perform multiple operations to generate ledger history
    vi.mocked(getOrderBook).mockResolvedValue({
      symbol: "BTCUSDT",
      status: "live",
      timestamp: new Date(),
      asks: [
        { price: new Decimal("60000"), quantity: new Decimal("1.0") },
      ],
      bids: [
        { price: new Decimal("59900"), quantity: new Decimal("1.0") },
      ],
    });

    // Operation 1: Market order
    await placeOrder({
      userId: testUserId,
      symbol: "BTCUSDT",
      side: "BUY",
      type: "MARKET",
      quantity: "0.01",
      idempotencyKey: `phase6-reconcile-trade-${randomUUID()}`,
    });

    // Operation 2: Conversion
    const convQuote = await createConversionQuote({
      userId: testUserId,
      fromAsset: "USDT",
      toAsset: "BTC",
      fromAmount: "300",
    });

    if (convQuote.success) {
      await executeConversion({
        userId: testUserId,
        quoteId: convQuote.quoteId!,
        idempotencyKey: `phase6-reconcile-conv-${randomUUID()}`,
      });
    }

    // Retrieve all wallet ledger accounts for this user
    const walletLedgerAccounts = await prisma.ledgerAccount.findMany({
      where: { cryptoWalletId: testWalletId },
      select: { id: true, assetSymbol: true },
    });

    expect(walletLedgerAccounts.length).toBeGreaterThan(0);

    // For each asset, calculate net ledger balance
    const ledgerBalancesByAsset = new Map<string, Decimal>();

    for (const account of walletLedgerAccounts) {
      const entries = await prisma.ledgerEntry.findMany({
        where: { ledgerAccountId: account.id },
      });

      let netBalance = new Decimal(0);

      for (const entry of entries) {
        const amount = new Decimal(entry.amount.toString());

        // DEBIT increases asset/expense accounts
        // CREDIT decreases asset/expense accounts
        // For customer wallet (ASSET type), use standard accounting:
        // DEBIT = increase, CREDIT = decrease
        if (entry.direction === "DEBIT") {
          netBalance = netBalance.plus(amount);
        } else {
          netBalance = netBalance.minus(amount);
        }
      }

      ledgerBalancesByAsset.set(account.assetSymbol, netBalance);
    }

    // Retrieve actual wallet balances
    const walletBalances = await prisma.assetBalance.findMany({
      where: { walletId: testWalletId },
    });

    expect(walletBalances.length).toBeGreaterThan(0);

    // Compare ledger-derived balance against AssetBalance.available + locked
    for (const balance of walletBalances) {
      const ledgerBalance = ledgerBalancesByAsset.get(balance.assetSymbol);

      expect(ledgerBalance).toBeDefined();

      const walletTotal = balance.available.plus(balance.locked);

      // Exact equality without floating-point tolerance
      expect(ledgerBalance!.toString()).toBe(walletTotal.toString());

      // Verify non-negative balances
      expect(balance.available.gte(0)).toBe(true);
      expect(balance.locked.gte(0)).toBe(true);
    }

    // Verify ledger entries are balanced per group
    const allEntries = await prisma.ledgerEntry.findMany({
      where: {
        ledgerAccount: { cryptoWalletId: testWalletId },
      },
    });

    const groupIds = [...new Set(allEntries.map((e) => e.groupId))];

    for (const groupId of groupIds) {
      const groupEntries = await prisma.ledgerEntry.findMany({
        where: { groupId },
      });

      const legs: PostingLeg[] = groupEntries.map((entry) => ({
        ledgerAccountId: entry.ledgerAccountId,
        direction: entry.direction,
        assetSymbol: entry.assetSymbol,
        amount: new Decimal(entry.amount.toString()),
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
      }));

      // Each group must balance
      expect(() => assertBalancedPosting(legs)).not.toThrow();
    }
  });
});
