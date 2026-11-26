import "server-only";

import Decimal from "decimal.js";

import { prisma } from "@/lib/db/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import {
  getOrderBook,
  getTradingInstruments,
} from "@/lib/market/service";

import type {
  OrderBook,
  TradingInstrument,
} from "@/lib/market/types";

import { CRYPTO_TRADING_ENABLED } from "@/lib/feature-flags";

import {
  ensureAssetBalanceAndLedgerAccount,
} from "./wallet-helpers";

import {
  postLedgerEntries,
} from "@/lib/ledger/postLedgerEntries";

import type {
  PostingLeg,
} from "@/lib/ledger/types";

import {
  getOrCreatePlatformLedgerAccount,
  cryptoInventoryPoolName,
  tradingSettlementPoolName,
  feeRevenuePoolName,
} from "@/lib/ledger/platform-accounts";

import {
  calculateFullLimitFill,
  isFreshOrderBook,
} from "./limit-order-pricing";

const MAKER_FEE_RATE = new Decimal("0.0005");

const MAX_ORDERS_PER_RUN = 200;

type MatchSummary = {
  disabled: boolean;
  scanned: number;
  filled: number;
  skipped: number;
  failed: number;
};

/**
 * P2034 TRANSACTION RETRY CONFIGURATION
 * 
 * Serializable isolation prevents phantom reads and write skew,
 * but concurrent transactions can conflict. When Prisma detects
 * a serialization conflict, it throws P2034.
 * 
 * This helper retries the entire transaction with exponential backoff.
 * 
 * SAFETY GUARANTEES:
 * - Only retries P2034 (serialization conflicts), never business logic errors
 * - Caller must revalidate all database state on each attempt
 * - Atomic order claims prevent duplicate settlements across retries
 * - Bounded attempts prevent infinite loops
 */
const MAX_TRANSACTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 50;

async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      // Only retry P2034 serialization conflicts
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < MAX_TRANSACTION_RETRIES - 1
      ) {
        // Exponential backoff with jitter
        const delay =
          BASE_RETRY_DELAY_MS * Math.pow(2, attempt) +
          Math.random() * BASE_RETRY_DELAY_MS;
        
        console.debug(
          `P2034 conflict in ${context}, retry ${attempt + 1}/${MAX_TRANSACTION_RETRIES - 1} after ${Math.round(delay)}ms`
        );
        
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      
      // Re-throw non-retriable errors or exhausted retries
      throw error;
    }
  }
  
  // TypeScript exhaustiveness check (unreachable)
  throw new Error(`Transaction retry loop exhausted unexpectedly: ${context}`);
}

/**
 * Attempt to fill one eligible simulated limit order.
 *
 * All financial mutations occur inside one serializable
 * database transaction.
 *
 * The guarded OPEN -> FILLED transition prevents an order
 * from being filled twice.
 */
async function tryFillOrder(
  orderId: string,
  instrument: TradingInstrument,
  book: OrderBook
): Promise<boolean> {
  return withTransactionRetry(
    async () => {
      return await prisma.$transaction(
        async (tx) => {
          // Server-side financial safety flag.
          if (
            !CRYPTO_TRADING_ENABLED ||
            !isFreshOrderBook(book, instrument.symbol)
          ) {
            return false;
          }

          // Revalidate order state on each retry attempt
          const order = await tx.cryptoOrder.findUnique({
            where: {
          id: orderId,
        },
      });

      if (
        !order ||
        order.status !== "OPEN" ||
        order.type !== "LIMIT" ||
        !order.limitPrice
      ) {
        return false;
      }

      if (
        order.symbol !== instrument.symbol ||
        instrument.status !== "active"
      ) {
        return false;
      }

      if (
        !order.quantity.isFinite() ||
        order.quantity.lte(0)
      ) {
        return false;
      }

      if (
        !order.limitPrice.isFinite() ||
        order.limitPrice.lte(0)
      ) {
        return false;
      }

      // Determine whether sufficient market liquidity exists
      // at prices no worse than the limit.
      const fill = calculateFullLimitFill(
        order.side,
        order.quantity,
        order.limitPrice,
        book
      );

      if (!fill) {
        return false;
      }

      const {
        baseAsset,
        quoteAsset,
      } = instrument;

      const sourceAsset =
        order.side === "BUY"
          ? quoteAsset
          : baseAsset;

      const destinationAsset =
        order.side === "BUY"
          ? baseAsset
          : quoteAsset;

      // Funds reserved when the limit order was created.
      const reserved =
        order.side === "BUY"
          ? order.quantity.times(order.limitPrice)
          : order.quantity;

      // Amount actually consumed.
      const spent =
        order.side === "BUY"
          ? fill.grossQuote
          : order.quantity;

      // Asset received before fees.
      const grossReceived =
        order.side === "BUY"
          ? order.quantity
          : fill.grossQuote;

      // Simulated maker fee: 0.05%.
      const fee = grossReceived
        .times(MAKER_FEE_RATE)
        .toDecimalPlaces(18, Decimal.ROUND_DOWN);

      const netReceived = grossReceived.minus(fee);

      // Any unused BUY reservation is returned to available.
      const refund = reserved.minus(spent);

      // Validate settlement amounts before mutating balances.
      if (
        !reserved.isFinite() ||
        reserved.lte(0) ||
        reserved.decimalPlaces() > 18 ||
        !spent.isFinite() ||
        spent.lte(0) ||
        spent.decimalPlaces() > 18 ||
        !netReceived.isFinite() ||
        netReceived.lte(0) ||
        netReceived.decimalPlaces() > 18 ||
        refund.lt(0) ||
        refund.decimalPlaces() > 18
      ) {
        throw new Error(
          "Invalid trading amounts or decimal precision"
        );
      }

      // Claim the OPEN order atomically.
      // Any later failure rolls this change back.
      const claim = await tx.cryptoOrder.updateMany({
        where: {
          id: order.id,
          status: "OPEN",
          type: "LIMIT",
        },
        data: {
          status: "FILLED",
          filledPrice: fill.averagePrice,
          feeAmount: fee,
          filledAt: new Date(),
        },
      });

      if (claim.count !== 1) {
        return false;
      }

      // Resolve the order owner's existing wallet.
      const wallet = await tx.cryptoWallet.findFirst({
        where: {
          userId: order.userId,
        },
      });

      if (!wallet) {
        throw new Error(
          "Wallet missing for open order"
        );
      }

      const {
        balance: sourceBalance,
        ledgerAccount: sourceAccount,
      } = await ensureAssetBalanceAndLedgerAccount(
        tx,
        wallet.id,
        sourceAsset
      );

      const {
        balance: destinationBalance,
        ledgerAccount: destinationAccount,
      } = await ensureAssetBalanceAndLedgerAccount(
        tx,
        wallet.id,
        destinationAsset
      );

      // Consume the reserved balance.
      // Refund any unspent amount.
      const unlocked = await tx.assetBalance.updateMany({
        where: {
          id: sourceBalance.id,
          locked: {
            gte: reserved,
          },
        },
        data: {
          locked: {
            decrement: reserved,
          },
          ...(refund.gt(0)
            ? {
                available: {
                  increment: refund,
                },
              }
            : {}),
        },
      });

      if (unlocked.count !== 1) {
        throw new Error(
          "Insufficient locked funds for order"
        );
      }

      // Credit the asset purchased or received.
      await tx.assetBalance.update({
        where: {
          id: destinationBalance.id,
        },
        data: {
          available: {
            increment: netReceived,
          },
        },
      });

      // Existing simulated counterparty accounts.
      const inventoryAccount =
        await getOrCreatePlatformLedgerAccount(tx, {
          type: "ASSET",
          assetSymbol: baseAsset,
          name: cryptoInventoryPoolName(baseAsset),
        });

      const settlementAccount =
        await getOrCreatePlatformLedgerAccount(tx, {
          type: "ASSET",
          assetSymbol: quoteAsset,
          name: tradingSettlementPoolName(quoteAsset),
        });

      const feeAccount =
        fee.gt(0)
          ? await getOrCreatePlatformLedgerAccount(tx, {
              type: "REVENUE",
              assetSymbol: destinationAsset,
              name: feeRevenuePoolName(destinationAsset),
            })
          : null;

      const ref = {
        referenceType: "CryptoTrade",
        referenceId: order.id,
      };

      const feeRef = {
        referenceType: "CryptoTradeFee",
        referenceId: order.id,
      };

      // Build ledger entries balanced separately by asset.
      const legs: PostingLeg[] =
        order.side === "BUY"
          ? [
              // Base asset movement.
              {
                ledgerAccountId: inventoryAccount.id,
                direction: "CREDIT",
                assetSymbol: baseAsset,
                amount: order.quantity,
                ...ref,
              },
              {
                ledgerAccountId: destinationAccount.id,
                direction: "DEBIT",
                assetSymbol: baseAsset,
                amount: netReceived,
                ...ref,
              },

              // Quote asset settlement.
              {
                ledgerAccountId: sourceAccount.id,
                direction: "CREDIT",
                assetSymbol: quoteAsset,
                amount: spent,
                ...ref,
              },
              {
                ledgerAccountId: settlementAccount.id,
                direction: "DEBIT",
                assetSymbol: quoteAsset,
                amount: spent,
                ...ref,
              },
            ]
          : [
              // Base asset movement.
              {
                ledgerAccountId: sourceAccount.id,
                direction: "CREDIT",
                assetSymbol: baseAsset,
                amount: spent,
                ...ref,
              },
              {
                ledgerAccountId: inventoryAccount.id,
                direction: "DEBIT",
                assetSymbol: baseAsset,
                amount: spent,
                ...ref,
              },

              // Quote asset settlement.
              {
                ledgerAccountId: settlementAccount.id,
                direction: "CREDIT",
                assetSymbol: quoteAsset,
                amount: fill.grossQuote,
                ...ref,
              },
              {
                ledgerAccountId: destinationAccount.id,
                direction: "DEBIT",
                assetSymbol: quoteAsset,
                amount: netReceived,
                ...ref,
              },
            ];

      // Record the simulated trading fee.
      // This follows the current market-order ledger convention.
      if (fee.gt(0) && feeAccount) {
        legs.push({
          ledgerAccountId: feeAccount.id,
          direction: "DEBIT",
          assetSymbol: destinationAsset,
          amount: fee,
          ...feeRef,
        });
      }

      // Existing ledger utility validates per-asset balancing.
      const {
        groupId,
      } = await postLedgerEntries(tx, legs);

      // Associate the settled order with its ledger group.
      await tx.cryptoOrder.update({
        where: {
          id: order.id,
        },
        data: {
          ledgerGroupId: groupId,
        },
      });

      // Audit trail.
      await tx.auditLog.create({
        data: {
          actorUserId: order.userId,
          action: "CRYPTO_LIMIT_ORDER_FILLED",
          targetType: "CRYPTO_ORDER",
          targetId: order.id,
          metadata: {
            symbol: order.symbol,
            side: order.side,
            quantity: order.quantity.toString(),
            limitPrice: order.limitPrice.toString(),
            filledPrice: fill.averagePrice.toString(),
            grossQuote: fill.grossQuote.toString(),
            feeAsset: destinationAsset,
            feeAmount: fee.toString(),
            refundedAmount: refund.toString(),
            ledgerGroupId: groupId,
          },
        },
      });

      // Activate any pending stop-loss protection after BUY fills
      if (order.side === "BUY") {
        const { activatePendingProtection } = await import("./stop-loss-protection");
        await activatePendingProtection(tx, order.id);
      }

      // Abort if the market snapshot becomes stale
      // while settlement is still in progress.
      if (!isFreshOrderBook(book, instrument.symbol)) {
        throw new Error(
          "Order book snapshot expired during settlement"
        );
      }

      return true;
    },
    {
      isolationLevel: "Serializable",
      maxWait: 10_000,
      timeout: 30_000,
    }
  );
},
`tryFillOrder(${orderId})`
);
}

/**
 * Match OPEN limit orders against fresh Bybit data.
 *
 * Intended for invocation by a trusted server-side scheduler.
 * Does not rely on the browser or TradingView.
 */
export async function matchOpenLimitOrders(): Promise<MatchSummary> {
  const result: MatchSummary = {
    disabled: !CRYPTO_TRADING_ENABLED,
    scanned: 0,
    filled: 0,
    skipped: 0,
    failed: 0,
  };

  if (!CRYPTO_TRADING_ENABLED) {
    return result;
  }

  const where = {
    status: "OPEN" as const,
    type: "LIMIT" as const,
  };

  const openCount = await prisma.cryptoOrder.count({
    where,
  });

  // Process a bounded number of orders per run.
  const skip =
    openCount > MAX_ORDERS_PER_RUN
      ? (
          Math.floor(Date.now() / 10_000) *
          MAX_ORDERS_PER_RUN
        ) % openCount
      : 0;

  const orders = await prisma.cryptoOrder.findMany({
    where,
    select: {
      id: true,
      symbol: true,
    },
    orderBy: [
      {
        createdAt: "asc",
      },
      {
        id: "asc",
      },
    ],
    skip,
    take: MAX_ORDERS_PER_RUN,
  });

  // Obtain one snapshot per instrument.
  const symbols = [
    ...new Set(orders.map((order) => order.symbol)),
  ];

  const books = new Map<string, OrderBook>();

  const instruments = new Map<
    string,
    TradingInstrument
  >();

  for (const symbol of symbols) {
    try {
      const [book, available] = await Promise.all([
        getOrderBook(symbol, 50),
        getTradingInstruments({
          symbol,
          activeOnly: true,
        }),
      ]);

      const instrument = available.find(
        (item) => item.symbol === symbol
      );

      if (
        instrument &&
        isFreshOrderBook(book, symbol)
      ) {
        books.set(symbol, book);
        instruments.set(symbol, instrument);
      }
    } catch (error) {
      console.warn(
        "Skipping limit-order symbol due to market data failure:",
        symbol,
        error
      );
    }
  }

  for (const order of orders) {
    result.scanned += 1;

    const book = books.get(order.symbol);

    const instrument = instruments.get(order.symbol);

    if (
      !book ||
      !instrument ||
      !isFreshOrderBook(book, order.symbol)
    ) {
      result.skipped += 1;
      continue;
    }

    try {
      const filled = await tryFillOrder(
        order.id,
        instrument,
        book
      );

      if (filled) {
        result.filled += 1;
      } else {
        result.skipped += 1;
      }
    } catch (error) {
      // P2034 conflicts are expected during concurrent matching
      // and are already retried internally by tryFillOrder.
      // If we see P2034 here, retries were exhausted.
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2034"
      ) {
        result.skipped += 1;
        console.debug(
          "Limit order skipped after P2034 retry exhaustion:",
          order.id
        );
      } else {
        // Permanent failures (validation, authorization, etc.)
        result.failed += 1;
        console.error(
          "Simulated limit order fill failed:",
          order.id,
          error
        );
      }
    }
  }

  return result;
}