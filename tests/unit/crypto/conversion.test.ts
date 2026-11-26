import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";
import type { ConversionQuote, Prisma } from "@prisma/client";

import {
  createConversionQuote,
  executeConversion,
} from "@/features/crypto/conversion";

import type { OrderBook } from "@/lib/market/types";

/**
 * Phase 5: Cryptocurrency Conversion Tests
 *
 * Tests:
 * - Conversion quote generation
 * - Order-book pricing
 * - Direct and inverse conversions
 * - Fee calculations
 * - Quote expiration
 * - Idempotency
 * - Balance validation
 * - Authorization
 * - Ledger balancing
 *
 * These are mocked unit tests.
 * Real PostgreSQL integration tests remain outstanding.
 */

// Enable conversion functionality ONLY inside this test.
vi.mock("@/lib/feature-flags", () => ({
  CRYPTO_CONVERSION_ENABLED: true,
  CRYPTO_TRADING_ENABLED: false,
}));

// Mock Bybit market service.
vi.mock("@/lib/market/service", () => ({
  getOrderBook: vi.fn(),
}));

// Mock Prisma database.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    conversionQuote: {
  create: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
},

    conversion: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },

    cryptoWallet: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },

    assetBalance: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },

    ledgerAccount: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },

    transaction: {
      create: vi.fn(),
    },

    auditLog: {
      create: vi.fn(),
    },

    $transaction: vi.fn(
      (callback: (tx: unknown) => unknown) =>
        callback(prismaMockTransaction)
    ),
  },
}));

// Mock double-entry ledger posting.
vi.mock("@/lib/ledger/postLedgerEntries", () => ({
  postLedgerEntries: vi.fn().mockResolvedValue({
    groupId: "test-ledger-group",
  }),
}));

// Mock wallet helpers.
vi.mock("@/features/crypto/wallet-helpers", () => ({
  ensureCryptoWallet: vi.fn(),
  ensureAssetBalanceAndLedgerAccount: vi.fn(),
}));

// Mock platform ledger accounts.
vi.mock("@/lib/ledger/platform-accounts", () => ({
  getOrCreatePlatformLedgerAccount: vi.fn(),

  cryptoInventoryPoolName: (asset: string) =>
    `Crypto Inventory (${asset})`,

  tradingSettlementPoolName: (asset: string) =>
    `Trading Settlement (${asset})`,

  feeRevenuePoolName: (asset: string) =>
    `Fee Revenue (${asset})`,
}));

import { prisma } from "@/lib/db/prisma";

import { getOrderBook } from "@/lib/market/service";

import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";

import {
  ensureCryptoWallet,
  ensureAssetBalanceAndLedgerAccount,
} from "@/features/crypto/wallet-helpers";

import {
  getOrCreatePlatformLedgerAccount,
} from "@/lib/ledger/platform-accounts";

/**
 * Mock transaction client.
 *
 * The transaction callback executes after module initialization.
 */
const prismaMockTransaction: Prisma.TransactionClient = prisma;

/**
 * Create a sample Bybit order book.
 *
 * BTC bid: 60,000 USDT
 * BTC ask: 60,100 USDT
 *
 * Different bid and ask prices help detect
 * incorrect conversion direction.
 */
function makeOrderBook(
  status: OrderBook["status"] = "live"
): OrderBook {
  return {
    symbol: "BTCUSDT",

    status,

    timestamp: new Date(),

    bids: [
      {
        price: new Decimal("60000"),
        quantity: new Decimal("2"),
      },
    ],

    asks: [
      {
        price: new Decimal("60100"),
        quantity: new Decimal("2"),
      },
    ],
  };
}

/**
 * Mock Prisma quote creation.
 *
 * IMPORTANT:
 *
 * Prisma's create() method returns a PrismaPromise.
 *
 * Our test implementation returns a regular Promise.
 * Casting the mock implementation avoids incorrectly
 * requiring PrismaPromise-specific methods.
 *
 * The cast applies ONLY to the mocked implementation.
 */
function mockQuoteCreation(id: string): void {
  vi.mocked(prisma.conversionQuote.create).mockImplementation(
    (async (args: Prisma.ConversionQuoteCreateArgs) => {
      return {
        id,
        ...args.data,
        createdAt: new Date(),
        consumedAt: null,
      };
    }) as unknown as typeof prisma.conversionQuote.create
  );
}

/**
 * Create an existing conversion quote for
 * transaction execution tests.
 */
function makeStoredQuote(
  overrides: Partial<ConversionQuote> = {}
) {
  return {
    id: "quote_123",

    userId: "user_123",

    fromAsset: "BTC",

    toAsset: "USDT",

    fromAmount: new Decimal("0.1"),

    toAmount: new Decimal("5994"),

    rate: new Decimal("60000"),

    feeAmount: new Decimal("6"),

    expiresAt: new Date(Date.now() + 30000),

    createdAt: new Date(),

    consumedAt: null,

    ...overrides,
  };
}

describe("Phase 5: Cryptocurrency Conversion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) =>
      callback(prismaMockTransaction)
    );
    vi.mocked(postLedgerEntries).mockResolvedValue({ groupId: "test-ledger-group" });
  });

  /**
   * ==========================================
   * CONVERSION QUOTE TESTS
   * ==========================================
   */

  describe("createConversionQuote", () => {
    it(
      "should create quote for direct pair (BTC→USDT) using bids",
      async () => {
        vi.mocked(getOrderBook).mockResolvedValue(
          makeOrderBook()
        );

        mockQuoteCreation("quote_123");

        const result = await createConversionQuote({
          userId: "user_123",
          fromAsset: "BTC",
          toAsset: "USDT",
          fromAmount: "0.1",
        });

        expect(result.success).toBe(true);

        expect(result.quoteId).toBe("quote_123");

        expect(result.rate).toBe("60000");

        expect(result.toAmount).toBe("5994");

        expect(result.feeAmount).toBe("6");

        expect(getOrderBook).toHaveBeenCalledWith(
          "BTCUSDT",
          50
        );

        /**
         * Calculation:
         *
         * 0.1 BTC × 60,000 = 6,000 USDT
         *
         * Fee:
         * 6,000 × 0.001 = 6 USDT
         *
         * Net:
         * 6,000 - 6 = 5,994 USDT
         */

        const data =
          vi.mocked(prisma.conversionQuote.create)
            .mock.calls[0]?.[0].data;

        expect(data).toBeDefined();

        expect(
          data?.rate?.toString()
        ).toBe("60000");

        expect(
          data?.feeAmount?.toString()
        ).toBe("6");

        expect(
          data?.toAmount?.toString()
        ).toBe("5994");
      }
    );

    it(
      "should create quote for inverse pair (USDT→BTC) using asks",
      async () => {
        vi.mocked(getOrderBook).mockResolvedValue(
          makeOrderBook()
        );

        mockQuoteCreation("quote_456");

        /**
         * BTC ask price = 60,100 USDT
         *
         * 6,010 USDT buys exactly 0.1 BTC.
         *
         * Fee = 0.0001 BTC.
         *
         * Net = 0.0999 BTC.
         */

        const result = await createConversionQuote({
          userId: "user_123",
          fromAsset: "USDT",
          toAsset: "BTC",
          fromAmount: "6010",
        });

        expect(result.success).toBe(true);

        expect(result.quoteId).toBe("quote_456");

        expect(result.toAmount).toBe("0.0999");

        expect(result.feeAmount).toBe("0.0001");

        expect(getOrderBook).toHaveBeenCalledWith(
          "BTCUSDT",
          50
        );

        const data =
          vi.mocked(prisma.conversionQuote.create)
            .mock.calls[0]?.[0].data;

        expect(data).toBeDefined();

        expect(
          data?.fromAmount?.toString()
        ).toBe("6010");

        expect(
          data?.feeAmount?.toString()
        ).toBe("0.0001");

        expect(
          data?.toAmount?.toString()
        ).toBe("0.0999");
      }
    );

    it("should reject same-asset conversion", async () => {
      const result = await createConversionQuote({
        userId: "user_123",
        fromAsset: "BTC",
        toAsset: "BTC",
        fromAmount: "1.0",
      });

      expect(result.success).toBe(false);

      expect(result.error).toContain(
        "Cannot convert an asset to itself"
      );

      expect(getOrderBook).not.toHaveBeenCalled();
    });

    it("should reject unsupported pair", async () => {
      const result = await createConversionQuote({
        userId: "user_123",
        fromAsset: "BTC",
        toAsset: "ETH",
        fromAmount: "1.0",
      });

      expect(result.success).toBe(false);

      expect(result.error).toContain(
        "not currently supported"
      );

      expect(getOrderBook).not.toHaveBeenCalled();
    });

    it(
      "should reject when market data is unavailable",
      async () => {
        vi.mocked(getOrderBook).mockResolvedValue(
          makeOrderBook("unavailable")
        );

        const result = await createConversionQuote({
          userId: "user_123",
          fromAsset: "BTC",
          toAsset: "USDT",
          fromAmount: "0.1",
        });

        expect(result.success).toBe(false);

        expect(result.error).toContain(
          "Market data unavailable"
        );

        expect(
          prisma.conversionQuote.create
        ).not.toHaveBeenCalled();
      }
    );

    it("should validate positive amount", async () => {
      const result = await createConversionQuote({
        userId: "user_123",
        fromAsset: "BTC",
        toAsset: "USDT",
        fromAmount: "-0.1",
      });

      expect(result.success).toBe(false);

      expect(result.error).toContain(
        "positive finite number"
      );

      expect(getOrderBook).not.toHaveBeenCalled();
    });
  });

  /**
   * ==========================================
   * CONVERSION EXECUTION TESTS
   * ==========================================
   */

  describe("executeConversion", () => {
    beforeEach(() => {
      /**
 * By default, the quote is successfully
 * claimed by exactly one execution.
 */
vi.mocked(
  prisma.conversionQuote.updateMany
).mockResolvedValue({
  count: 1,
});
      /**
 * Default market data for execution tests.
 *
 * An unchanged BTCUSDT order book should allow
 * a valid quote to execute.
 */
vi.mocked(getOrderBook).mockResolvedValue(
  makeOrderBook()
);
      /**
       * Mock authenticated user's wallet.
       */
      vi.mocked(ensureCryptoWallet).mockResolvedValue({
        id: "wallet_123",
        userId: "user_123",
        label: "Spot Wallet",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      /**
       * Source BTC balance.
       */
      const fromBalance = {
        id: "balance_btc",

        walletId: "wallet_123",

        assetSymbol: "BTC",

        available: new Decimal("1"),

        locked: new Decimal("0"),
      };

      /**
       * Destination USDT balance.
       */
      const toBalance = {
        id: "balance_usdt",

        walletId: "wallet_123",

        assetSymbol: "USDT",

        available: new Decimal("0"),

        locked: new Decimal("0"),
      };

      /**
       * Mock source and destination
       * balance/ledger account creation.
       */
      vi.mocked(
        ensureAssetBalanceAndLedgerAccount
      )
        .mockResolvedValueOnce({
          balance: { ...fromBalance, updatedAt: new Date() },
          ledgerAccount: {
            id: "ledger_btc",
            type: "ASSET",
            assetSymbol: "BTC",
            name: "Spot Wallet - BTC",
            bankAccountId: null,
            cryptoWalletId: "wallet_123",
            createdAt: new Date(),
          },
        })
        .mockResolvedValueOnce({
          balance: { ...toBalance, updatedAt: new Date() },
          ledgerAccount: {
            id: "ledger_usdt",
            type: "ASSET",
            assetSymbol: "USDT",
            name: "Spot Wallet - USDT",
            bankAccountId: null,
            cryptoWalletId: "wallet_123",
            createdAt: new Date(),
          },
        });

      /**
       * Mock platform ledger accounts.
       */
      vi.mocked(
        getOrCreatePlatformLedgerAccount, { partial: true }
      ).mockResolvedValue({
        id: "platform_account",
      });

      /**
       * Mock successful atomic balance deduction.
       */
      vi.mocked(
        prisma.assetBalance.updateMany
      ).mockResolvedValue({
        count: 1,
      });

      /**
       * Mock destination balance credit.
       */
      vi.mocked(
        prisma.assetBalance.update, { partial: true }
      ).mockResolvedValue({});

      /**
       * Mock quote consumption.
       */
      vi.mocked(
        prisma.conversionQuote.update, { partial: true }
      ).mockResolvedValue({});

      /**
       * Mock conversion record.
       */
      vi.mocked(
        prisma.conversion.create, { partial: true }
      ).mockResolvedValue({
        id: "conv_123",
      });

      /**
       * Mock transaction history.
       */
      vi.mocked(
        prisma.transaction.create, { partial: true }
      ).mockResolvedValue({});

      /**
       * Mock audit logging.
       */
      vi.mocked(
        prisma.auditLog.create, { partial: true }
      ).mockResolvedValue({});

      /**
       * Default:
       * No existing conversion.
       */
      vi.mocked(
        prisma.conversion.findUnique, { partial: true }
      ).mockResolvedValue(null);

      /**
       * Default:
       * Valid unconsumed quote.
       */
      vi.mocked(
        prisma.conversionQuote.findUnique, { partial: true }
      ).mockResolvedValue(
        makeStoredQuote()
      );
    });
    it(
  "should allocate conversion proceeds and fees correctly",
  async () => {
    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(true);

    expect(postLedgerEntries).toHaveBeenCalledTimes(1);

    const legs =
      vi.mocked(postLedgerEntries).mock.calls[0]?.[1];

    expect(legs).toBeDefined();

    const usdtLegs = legs!.filter(
      (leg) => leg.assetSymbol === "USDT"
    );

    // Customer receives only the net amount.
    const customerCredit = usdtLegs.find(
      (leg) => leg.ledgerAccountId === "ledger_usdt"
    );

    expect(customerCredit?.direction).toBe("DEBIT");

    expect(
      customerCredit?.amount.toString()
    ).toBe("5994");

    // Fee is allocated to the platform fee pool.
    const feeEntry = usdtLegs.find(
      (leg) => leg.referenceType === "ConversionFee"
    );

    expect(feeEntry?.direction).toBe("DEBIT");

    expect(
      feeEntry?.amount.toString()
    ).toBe("6");

    // Gross amount leaves platform inventory.
    const inventoryOutflow = usdtLegs.find(
      (leg) => leg.direction === "CREDIT"
    );

    expect(
      inventoryOutflow?.amount.toString()
    ).toBe("6000");

    // Verify exact destination-asset balancing.
    const totalDebits = usdtLegs
      .filter((leg) => leg.direction === "DEBIT")
      .reduce(
        (sum, leg) => sum.plus(leg.amount),
        new Decimal(0)
      );

    const totalCredits = usdtLegs
      .filter((leg) => leg.direction === "CREDIT")
      .reduce(
        (sum, leg) => sum.plus(leg.amount),
        new Decimal(0)
      );

    expect(totalDebits.toString()).toBe("6000");
    expect(totalCredits.toString()).toBe("6000");
  }
);
    it(
  "should prevent execution when atomic quote consumption fails",
  async () => {
    /**
     * Simulate a quote already claimed by
     * another execution.
     */
    vi.mocked(
      prisma.conversionQuote.updateMany
    ).mockResolvedValue({
      count: 0,
    });

    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(false);

    expect(result.error).toContain(
      "Quote has already been used or expired"
    );

    /**
     * No financial operations should run
     * after the quote claim fails.
     */
    expect(
      postLedgerEntries
    ).not.toHaveBeenCalled();

    expect(
      prisma.assetBalance.updateMany
    ).not.toHaveBeenCalled();

    expect(
      prisma.conversion.create
    ).not.toHaveBeenCalled();

    expect(
      prisma.transaction.create
    ).not.toHaveBeenCalled();
  }
);

    it("should execute valid conversion", async () => {
      const result = await executeConversion({
        userId: "user_123",
        quoteId: "quote_123",
        idempotencyKey: "idem_123",
      });

      expect(result.success).toBe(true);

      expect(result.conversionId).toBe("conv_123");

      expect(
        postLedgerEntries
      ).toHaveBeenCalledTimes(1);

      expect(
        prisma.assetBalance.updateMany
      ).toHaveBeenCalledTimes(1);

      expect(
        prisma.conversion.create
      ).toHaveBeenCalledTimes(1);

      /**
       * Read the ledger legs posted by the service.
       */
      const legs =
        vi.mocked(postLedgerEntries)
          .mock.calls[0]![1];

      /**
       * Verify independent balancing for each asset.
       *
       * BTC:
       * Total debits must equal total credits.
       *
       * USDT:
       * Total debits must equal total credits.
       */
      for (const asset of ["BTC", "USDT"]) {
        const assetLegs = legs.filter(
          (leg) => leg.assetSymbol === asset
        );

        const debits = assetLegs
          .filter(
            (leg) => leg.direction === "DEBIT"
          )
          .reduce(
            (sum, leg) => sum.plus(leg.amount),
            new Decimal(0)
          );

        const credits = assetLegs
          .filter(
            (leg) => leg.direction === "CREDIT"
          )
          .reduce(
            (sum, leg) => sum.plus(leg.amount),
            new Decimal(0)
          );

        expect(
          assetLegs.length
        ).toBeGreaterThan(0);

        expect(
          debits.toString()
        ).toBe(credits.toString());
      }
    });
it(
  "should accept a quote when market movement is within tolerance",
  async () => {
    const book = makeOrderBook();

    // Original quote used 60,000 USDT per BTC.
    // Current bid is 59,850: a 0.25% decline.
    book.bids = [
      {
        price: new Decimal("59850"),
        quantity: new Decimal("2"),
      },
    ];

    vi.mocked(getOrderBook).mockResolvedValue(book);

    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(true);

    expect(result.conversionId).toBe("conv_123");

    expect(postLedgerEntries).toHaveBeenCalledTimes(1);

    // Confirm that execution preserved
    // the ORIGINAL quoted destination amount.
    const savedConversion =
      vi.mocked(prisma.conversion.create, { partial: true })
        .mock.calls[0]?.[0].data;

    expect(
      savedConversion?.toAmount.toString()
    ).toBe("5994");
  }
);
it(
  "should reject conversion when market price moves beyond tolerance",
  async () => {
    const book = makeOrderBook();

    // Original bid: 60,000.
    // New bid: 59,000.
    // Movement exceeds 0.5%.
    book.bids = [
      {
        price: new Decimal("59000"),
        quantity: new Decimal("2"),
      },
    ];

    vi.mocked(getOrderBook).mockResolvedValue(book);

    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(false);

    expect(result.error).toContain(
      "Market price moved beyond"
    );

    // Financial settlement must not begin.
    expect(postLedgerEntries).not.toHaveBeenCalled();

    expect(
      prisma.assetBalance.updateMany
    ).not.toHaveBeenCalled();

    expect(
      prisma.conversion.create
    ).not.toHaveBeenCalled();
  }
);
it(
  "should reject execution when market data is stale",
  async () => {
    const book = makeOrderBook();

    book.timestamp = new Date(
      Date.now() - 30_000
    );

    vi.mocked(getOrderBook).mockResolvedValue(book);

    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(false);

    expect(result.error).toContain(
      "Market data is too old"
    );

    expect(postLedgerEntries).not.toHaveBeenCalled();

    expect(
      prisma.assetBalance.updateMany
    ).not.toHaveBeenCalled();

    expect(
      prisma.conversion.create
    ).not.toHaveBeenCalled();
  }
);
it(
  "should reject USDT to BTC when the ask price rises excessively",
  async () => {
    // An original quote:
    // 6,010 USDT -> 0.0999 BTC after fees,
    // at a 60,100 ask.
    vi.mocked(
      prisma.conversionQuote.findUnique, { partial: true }
    ).mockResolvedValue({
      ...makeStoredQuote(),

      fromAsset: "USDT",
      toAsset: "BTC",

      fromAmount: new Decimal("6010"),
      toAmount: new Decimal("0.0999"),
      feeAmount: new Decimal("0.0001"),
    });

    const book = makeOrderBook();

    // BTC has become more expensive to buy.
    book.asks = [
      {
        price: new Decimal("62000"),
        quantity: new Decimal("2"),
      },
    ];

    vi.mocked(getOrderBook).mockResolvedValue(book);

    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(false);

    expect(result.error).toContain(
      "Market price moved beyond"
    );

    expect(postLedgerEntries).not.toHaveBeenCalled();

    expect(
      prisma.assetBalance.updateMany
    ).not.toHaveBeenCalled();
  }
);
    it("should enforce idempotency", async () => {
      /**
       * Conversion already exists for this key.
       */
      vi.mocked(
        prisma.conversion.findUnique, { partial: true }
      ).mockResolvedValue({
        id: "conv_123",

        userId: "user_123",

        quoteId: "quote_123",

        fromAsset: "BTC",

        toAsset: "USDT",

        fromAmount: new Decimal("0.1"),

        toAmount: new Decimal("5994"),

        feeAmount: new Decimal("6"),

        idempotencyKey: "idem_123",

        ledgerGroupId: "group_123",

        status: "COMPLETED",

        createdAt: new Date(),
      });

      const result = await executeConversion({
        userId: "user_123",
        quoteId: "quote_123",
        idempotencyKey: "idem_123",
      });

      expect(result.success).toBe(true);

      expect(result.conversionId).toBe("conv_123");

      /**
       * No duplicate conversion or ledger posting.
       */
      expect(
        prisma.conversion.create
      ).not.toHaveBeenCalled();

      expect(
        postLedgerEntries
      ).not.toHaveBeenCalled();
    });

    it("should reject expired quote", async () => {
      vi.mocked(
        prisma.conversionQuote.findUnique, { partial: true }
      ).mockResolvedValue(
        makeStoredQuote({
          expiresAt: new Date(
            Date.now() - 1000
          ),
        })
      );

      const result = await executeConversion({
        userId: "user_123",
        quoteId: "quote_123",
        idempotencyKey: "idem_123",
      });

      expect(result.success).toBe(false);

      expect(result.error).toContain("expired");

      expect(
        postLedgerEntries
      ).not.toHaveBeenCalled();
    });

    it("should reject already consumed quote", async () => {
      vi.mocked(
        prisma.conversionQuote.findUnique, { partial: true }
      ).mockResolvedValue(
        makeStoredQuote({
          consumedAt: new Date(),
        })
      );

      const result = await executeConversion({
        userId: "user_123",
        quoteId: "quote_123",
        idempotencyKey: "idem_123",
      });

      expect(result.success).toBe(false);

      expect(result.error).toContain(
        "already been used"
      );

      expect(
        postLedgerEntries
      ).not.toHaveBeenCalled();
    });

    it("should reject insufficient balance", async () => {
  /**
   * The customer has only 1 BTC available.
   *
   * The conversion requires 10 BTC.
   *
   * Give the mocked market sufficient liquidity
   * so the test specifically reaches the wallet
   * balance validation.
   */

  const book = makeOrderBook();

  // Provide 20 BTC of market liquidity.
  // This is enough to cover the requested 10 BTC.
  book.bids = [
    {
      price: new Decimal("60000"),
      quantity: new Decimal("20"),
    },
  ];

  vi.mocked(getOrderBook).mockResolvedValue(book);

  // The quote requires 10 BTC.
  vi.mocked(
    prisma.conversionQuote.findUnique, { partial: true }
  ).mockResolvedValue(
    makeStoredQuote({
      fromAmount: new Decimal("10"),
      toAmount: new Decimal("599400"),
      feeAmount: new Decimal("600"),
    })
  );

  const result = await executeConversion({
    userId: "user_123",
    quoteId: "quote_123",
    idempotencyKey: "idem_123",
  });

  // Conversion must fail.
  expect(result.success).toBe(false);

  // The failure must be caused by insufficient
  // wallet balance, not insufficient market liquidity.
  expect(result.error).toContain(
    "Insufficient BTC balance"
  );

  // No financial settlement should occur.
  expect(postLedgerEntries).not.toHaveBeenCalled();

  expect(
    prisma.assetBalance.updateMany
  ).not.toHaveBeenCalled();

  expect(
    prisma.conversion.create
  ).not.toHaveBeenCalled();
});
    it("should reject wrong user accessing quote", async () => {
      /**
       * Quote belongs to a different user.
       */
      vi.mocked(
        prisma.conversionQuote.findUnique, { partial: true }
      ).mockResolvedValue(
        makeStoredQuote({
          userId: "user_456",
        })
      );

      const result = await executeConversion({
        userId: "user_123",
        quoteId: "quote_123",
        idempotencyKey: "idem_123",
      });

      expect(result.success).toBe(false);

      expect(result.error).toContain(
        "Not authorized"
      );

      expect(
        postLedgerEntries
      ).not.toHaveBeenCalled();
    });
  });
});
