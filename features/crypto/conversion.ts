import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { getOrderBook } from "@/lib/market/service";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import {
  calculateConversionPrice,
} from "@/features/crypto/conversion-pricing";
import type { Prisma } from "@prisma/client";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import type { PostingLeg } from "@/lib/ledger/types";
import {
  getOrCreatePlatformLedgerAccount,
  cryptoInventoryPoolName,
  tradingSettlementPoolName,
  feeRevenuePoolName,
} from "@/lib/ledger/platform-accounts";
import { ensureCryptoWallet, ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";
import { CRYPTO_CONVERSION_ENABLED } from "@/lib/feature-flags";

type TransactionClient = Prisma.TransactionClient;

/**
 * Phase 5: Cryptocurrency Conversion
 * 
 * SIMULATED CONVERSION ONLY — No real exchange submission!
 * 
 * IMPLEMENTATION FEATURES:
 * - Two-step quote + execute flow with expiration
 * - Uses postLedgerEntries for balanced double-entry accounting
 * - Concurrency-safe balance updates with optimistic locking
 * - Platform counterparty accounts (inventory, settlement, fee pools)
 * - Validated market prices and supported asset pairs
 * - Idempotency with ownership validation
 * - Atomic execution with status transitions
 * 
 * FEATURE FLAG PROTECTION:
 * - CRYPTO_CONVERSION_ENABLED must be true to execute financial mutations
 * - When disabled, all quote and execute operations are blocked
 */

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
 * - Idempotency keys prevent duplicate settlements across retries
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
        
        console.warn(
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

interface CreateQuoteParams {
  userId: string;
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
}

interface CreateQuoteResult {
  success: boolean;
  quoteId?: string;
  fromAsset?: string;
  toAsset?: string;
  fromAmount?: string;
  toAmount?: string;
  rate?: string;
  feeAmount?: string;
  expiresAt?: Date;
  error?: string;
}

interface ExecuteConversionParams {
  userId: string;
  quoteId: string;
  idempotencyKey: string;
}

interface ExecuteConversionResult {
  success: boolean;
  conversionId?: string;
  error?: string;
}

const QUOTE_EXPIRATION_SECONDS = 30;
/**
 * Maximum permitted change between the quoted
 * destination amount and the freshly calculated
 * destination amount.
 *
 * 0.005 = 0.5%
 *
 * This applies to both favorable and adverse
 * price movements.
 *
 * A conversion outside this range must be
 * requoted before execution.
 */
const MAX_EXECUTION_PRICE_DEVIATION = new Decimal("0.005");

/**
 * Supported conversion pairs.
 * Uses normalized ticker symbols to get market rates.
 * Format: "FROMTO" -> ticker symbol for rate lookup
 */
const SUPPORTED_PAIRS: Record<string, string> = {
  "BTCUSDT": "BTCUSDT",   // BTC → USDT
  "USDTBTC": "BTCUSDT",   // USDT → BTC (inverse)
  "ETHUSDT": "ETHUSDT",   // ETH → USDT
  "USDTETH": "ETHUSDT",   // USDT → ETH (inverse)
  "SOLUSDT": "SOLUSDT",   // SOL → USDT
  "USDTSOL": "SOLUSDT",   // USDT → SOL (inverse)
  "XRPUSDT": "XRPUSDT",   // XRP → USDT
  "USDTXRP": "XRPUSDT",   // USDT → XRP (inverse)
  
};

/**
 * Create a conversion quote with current market rate.
 * Quote is valid for QUOTE_EXPIRATION_SECONDS.
 */
export async function createConversionQuote(params: CreateQuoteParams): Promise<CreateQuoteResult> {
  // Feature flag check
  if (!CRYPTO_CONVERSION_ENABLED) {
    return {
      success: false,
      error: "Cryptocurrency conversion is temporarily disabled. Please check back later.",
    };
  }

  const { userId, fromAsset, toAsset, fromAmount: fromAmountStr } = params;

  // Validate amount
  const fromAmount = new Decimal(fromAmountStr);
  if (!fromAmount.isFinite() || fromAmount.lte(0)) {
    return { success: false, error: "Amount must be a positive finite number" };
  }

  // Validate same-asset conversion
  if (fromAsset === toAsset) {
    return { success: false, error: "Cannot convert an asset to itself" };
  }

  // Check if pair is supported
  const pairKey = `${fromAsset}${toAsset}`;
  const tickerSymbol = SUPPORTED_PAIRS[pairKey];

  if (!tickerSymbol) {
    return {
      success: false,
      error: `Conversion pair ${fromAsset}/${toAsset} is not currently supported`,
    };
  }

  try {
    // Fetch Bybit's spot order book for executable pricing.
const orderBook = await getOrderBook(tickerSymbol, 50);

// Determine the correct side of the market.
// BTC → USDT sells BTC against bids.
// USDT → BTC buys BTC against asks.
const direction =
  fromAsset === "USDT"
    ? "USDT_TO_BASE"
    : "BASE_TO_USDT";

// Calculate the conversion using available market depth.
// This validates freshness, liquidity, and financial precision.
const pricing = calculateConversionPrice(
  orderBook,
  tickerSymbol,
  direction,
  fromAmount
);

const rate = pricing.rate;
const feeAmount = pricing.feeAmount;
const toAmountNet = pricing.netAmount;

    // Create quote record
    const expiresAt = new Date(Date.now() + QUOTE_EXPIRATION_SECONDS * 1000);

    const quote = await prisma.conversionQuote.create({
      data: {
        userId,
        fromAsset,
        toAsset,
        fromAmount,
        toAmount: toAmountNet,
        rate,
        feeAmount,
        expiresAt,
      },
    });

    return {
      success: true,
      quoteId: quote.id,
      fromAsset: quote.fromAsset,
      toAsset: quote.toAsset,
      fromAmount: quote.fromAmount.toString(),
      toAmount: quote.toAmount.toString(),
      rate: quote.rate.toString(),
      feeAmount: quote.feeAmount.toString(),
      expiresAt: quote.expiresAt,
    };
  } catch (error) {
    console.error("Error creating conversion quote:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error creating quote",
    };
  }
}

/**
 * Execute a conversion using a valid quote.
 * Performs balanced ledger posting and atomic wallet updates.
 */
export async function executeConversion(params: ExecuteConversionParams): Promise<ExecuteConversionResult> {
  // Feature flag check
  if (!CRYPTO_CONVERSION_ENABLED) {
    return {
      success: false,
      error: "Cryptocurrency conversion is temporarily disabled. Please check back later.",
    };
  }

  const { userId, quoteId, idempotencyKey } = params;

  try {
    // Check whether this idempotency key has already been used.
const existing = await prisma.conversion.findUnique({
  where: { idempotencyKey },
});

if (existing) {
  if (existing.userId !== userId) {
    return {
      success: false,
      error: "Idempotency key already used by another user",
    };
  }

  if (existing.quoteId !== quoteId) {
    return {
      success: false,
      error:
        "Idempotency key reused with different quote. " +
        "Original conversion preserved.",
    };
  }

  if (existing.status !== "COMPLETED") {
    return {
      success: false,
      error: "Original conversion has not completed",
    };
  }

  return {
    success: true,
    conversionId: existing.id,
  };
}

/**
 * A quote represents exactly one conversion.
 *
 * Even if a request arrives with a different
 * idempotency key, the same quote must not
 * create a second conversion.
 */
const existingForQuote = await prisma.conversion.findUnique({
  where: { quoteId },
});

if (existingForQuote) {
  if (existingForQuote.userId !== userId) {
    return {
      success: false,
      error: "Not authorized to use this quote",
    };
  }

  if (existingForQuote.status !== "COMPLETED") {
    return {
      success: false,
      error: "Original conversion has not completed",
    };
  }

  // This quote has already settled.
  // Return the original result without posting again.
  return {
    success: true,
    conversionId: existingForQuote.id,
  };
}

    
    /**
 * PRE-EXECUTION MARKET VALIDATION
 *
 * Fetch market data BEFORE opening the database
 * transaction to avoid holding a financial transaction
 * open during an external Bybit request.
 *
 * The quote is checked again inside the transaction
 * because its state may change concurrently.
 */

// Read the quote before requesting market data.
const preflightQuote = await prisma.conversionQuote.findUnique({
  where: {
    id: quoteId,
  },
});

if (!preflightQuote) {
  return {
    success: false,
    error: "Quote not found",
  };
}

// Never allow a user to execute someone else's quote.
if (preflightQuote.userId !== userId) {
  return {
    success: false,
    error: "Not authorized to use this quote",
  };
}

// Prevent unnecessary market requests for used quotes.
if (preflightQuote.consumedAt) {
  return {
    success: false,
    error: "Quote has already been used",
  };
}

// Check expiration before accessing Bybit.
if (preflightQuote.expiresAt.getTime() <= Date.now()) {
  return {
    success: false,
    error: "Quote has expired. Please request a new quote.",
  };
}

// Resolve the original supported trading pair.
const pairKey =
  `${preflightQuote.fromAsset}${preflightQuote.toAsset}`;

const tickerSymbol = SUPPORTED_PAIRS[pairKey];

if (!tickerSymbol) {
  return {
    success: false,
    error: "Conversion pair is no longer supported",
  };
}

// Fetch current public Bybit order-book data.
// No real exchange order is submitted.
const executionOrderBook = await getOrderBook(
  tickerSymbol,
  50
);

    // Execute in serializable transaction with P2034 retry protection
    const result = await withTransactionRetry(
      async () => {
        return await prisma.$transaction(
          async (tx) => {
            // Revalidate idempotency on each retry attempt
            const existingRetry = await tx.conversion.findUnique({
              where: { idempotencyKey },
            });

            if (existingRetry) {
              if (existingRetry.userId !== userId) {
                throw new Error("Idempotency key already used by another user");
              }

              if (existingRetry.quoteId !== quoteId) {
                throw new Error(
                  "Idempotency key reused with different quote. Original conversion preserved."
                );
              }

              if (existingRetry.status !== "COMPLETED") {
                throw new Error("Original conversion has not completed");
              }

              // Return existing conversion result without re-settling
              return {
                success: true,
                conversionId: existingRetry.id,
              };
            }

            // Revalidate quote-level idempotency on each retry attempt
            const existingForQuoteRetry = await tx.conversion.findUnique({
              where: { quoteId },
            });

            if (existingForQuoteRetry) {
              if (existingForQuoteRetry.userId !== userId) {
                throw new Error("Not authorized to use this quote");
              }

              if (existingForQuoteRetry.status !== "COMPLETED") {
                throw new Error("Original conversion has not completed");
              }

              // This quote has already settled.
              // Return the original result without posting again.
              return {
                success: true,
                conversionId: existingForQuoteRetry.id,
              };
            }

            // Revalidate quote state on each retry attempt
            const quote = await tx.conversionQuote.findUnique({
              where: { id: quoteId },
            });

            if (!quote) {
              throw new Error("Quote not found");
            }

            if (quote.userId !== userId) {
              throw new Error("Not authorized to use this quote");
            }

            if (quote.consumedAt) {
              throw new Error("Quote has already been used");
            }

            const now = new Date();

            if (quote.expiresAt.getTime() <= now.getTime()) {
              throw new Error("Quote has expired. Please request a new quote.");
            }

/**
 * REVALIDATE THE ORIGINAL QUOTE
 *
 * The database quote is authoritative for what
 * the user agreed to receive.
 *
 * However, execution is permitted only when
 * the current simulated market value is within
 * the configured tolerance.
 */

// Confirm that the pair has not changed.
const currentPairKey =
  `${quote.fromAsset}${quote.toAsset}`;

const currentTickerSymbol =
  SUPPORTED_PAIRS[currentPairKey];

if (
  !currentTickerSymbol ||
  currentTickerSymbol !== tickerSymbol
) {
  throw new Error(
    "Conversion pair changed or is no longer supported"
  );
}

// Determine the correct order-book direction.
const executionDirection =
  quote.fromAsset === "USDT"
    ? "USDT_TO_BASE"
    : "BASE_TO_USDT";

// Recalculate using the CURRENT available liquidity.
// The pricing helper also rejects stale data,
// malformed order books, and insufficient depth.
const currentPricing = calculateConversionPrice(
  executionOrderBook,
  currentTickerSymbol,
  executionDirection,
  quote.fromAmount,
  Date.now()
);

// The destination amount originally accepted
// by the user, AFTER fees.
const quotedNetAmount = quote.toAmount;

// The destination amount currently supported
// by the order book, AFTER fees.
const currentNetAmount = currentPricing.netAmount;

if (
  !quotedNetAmount.isFinite() ||
  quotedNetAmount.lte(0)
) {
  throw new Error(
    "Invalid stored conversion quote"
  );
}

/**
 * Calculate relative market movement.
 *
 * Example:
 *
 * Quoted net: 5,994 USDT
 * Current net: 5,940 USDT
 *
 * Deviation:
 * |5940 - 5994| / 5994
 *
 * If deviation exceeds 0.5%, reject.
 */
const priceDeviation = currentNetAmount
  .minus(quotedNetAmount)
  .abs()
  .div(quotedNetAmount);

if (
  priceDeviation.gt(MAX_EXECUTION_PRICE_DEVIATION)
) {
  throw new Error(
    "Market price moved beyond the 0.5% tolerance. " +
    "Please request a new conversion quote."
  );
}
/**
 * ATOMIC QUOTE CONSUMPTION
 *
 * Claim the quote only if:
 *
 * 1. It belongs to the authenticated user.
 * 2. It has not already been consumed.
 * 3. It has not expired.
 *
 * This operation runs inside the same
 * Serializable transaction as settlement.
 *
 * If any later financial operation fails,
 * PostgreSQL rolls this update back too.
 */
const quoteClaim = await tx.conversionQuote.updateMany({
  where: {
    id: quoteId,
    userId,
    consumedAt: null,
    expiresAt: {
      gt: now,
    },
  },

  data: {
    consumedAt: now,
  },
});

if (quoteClaim.count !== 1) {
  throw new Error(
    "Quote has already been used or expired. " +
    "Please request a new conversion quote."
  );
}
/**
 * IMPORTANT:
 *
 * Continue using the ORIGINAL stored quote
 * for settlement.
 *
 * Do not overwrite:
 *
 * quote.fromAmount
 * quote.toAmount
 * quote.feeAmount
 * quote.rate
 *
 * We are validating the quoted transaction,
 * not silently replacing it with a new one.
 */

// Get wallet.
const wallet = await ensureCryptoWallet(tx, userId);

        // Ensure balances and ledger accounts exist
        const { balance: fromBalance, ledgerAccount: fromLedgerAccount } =
          await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, quote.fromAsset);

        const { ledgerAccount: toLedgerAccount } =
          await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, quote.toAsset);

        // Check sufficient balance
        if (fromBalance.available.lt(quote.fromAmount)) {
          throw new Error(
            `Insufficient ${quote.fromAsset} balance. Required: ${quote.fromAmount.toString()}, Available: ${fromBalance.available.toString()}`
          );
        }

        // Get platform accounts
        const fromInventoryPool = await getOrCreatePlatformLedgerAccount(tx, {
          name: cryptoInventoryPoolName(quote.fromAsset),
          type: "ASSET",
          assetSymbol: quote.fromAsset,
        });

        const toInventoryPool = await getOrCreatePlatformLedgerAccount(tx, {
          name: cryptoInventoryPoolName(quote.toAsset),
          type: "ASSET",
          assetSymbol: quote.toAsset,
        });

        const feePool = await getOrCreatePlatformLedgerAccount(tx, {
          name: feeRevenuePoolName(quote.toAsset),
          type: "REVENUE",
          assetSymbol: quote.toAsset,
        });

        // Build balanced ledger entries
        const legs: PostingLeg[] = [];

        // User gives up fromAsset
        legs.push(
          {
            ledgerAccountId: fromLedgerAccount.id,
            direction: "CREDIT",
            assetSymbol: quote.fromAsset,
            amount: quote.fromAmount,
            referenceType: "Conversion",
            referenceId: idempotencyKey,
          },
          {
            ledgerAccountId: fromInventoryPool.id,
            direction: "DEBIT",
            assetSymbol: quote.fromAsset,
            amount: quote.fromAmount,
            referenceType: "Conversion",
            referenceId: idempotencyKey,
          }
        );

        // User receives toAsset (net of fee)
        // Platform inventory releases: toAmount (net) + feeAmount
        const toAmountGross = quote.toAmount.plus(quote.feeAmount);

        legs.push(
          {
            ledgerAccountId: toInventoryPool.id,
            direction: "CREDIT",
            assetSymbol: quote.toAsset,
            amount: toAmountGross,
            referenceType: "Conversion",
            referenceId: idempotencyKey,
          },
          {
            ledgerAccountId: toLedgerAccount.id,
            direction: "DEBIT",
            assetSymbol: quote.toAsset,
            amount: quote.toAmount,
            referenceType: "Conversion",
            referenceId: idempotencyKey,
          },
          {
            ledgerAccountId: feePool.id,
            direction: "DEBIT",
            assetSymbol: quote.toAsset,
            amount: quote.feeAmount,
            referenceType: "ConversionFee",
            referenceId: idempotencyKey,
          }
        );

        // Post balanced entries (throws if imbalanced)
        const { groupId } = await postLedgerEntries(tx, legs);

        // Concurrency-safe balance updates
        const fromUpdated = await tx.assetBalance.updateMany({
          where: {
            id: fromBalance.id,
            available: { gte: quote.fromAmount },
          },
          data: {
            available: { decrement: quote.fromAmount },
          },
        });

        if (fromUpdated.count === 0) {
          throw new Error(`Concurrent conversion detected: insufficient ${quote.fromAsset} available`);
        }

        await tx.assetBalance.update({
          where: {
            walletId_assetSymbol: {
              walletId: wallet.id,
              assetSymbol: quote.toAsset,
            },
          },
          data: {
            available: { increment: quote.toAmount },
          },
        });

        

        // Create conversion record
        const conversion = await tx.conversion.create({
          data: {
            userId,
            quoteId,
            fromAsset: quote.fromAsset,
            toAsset: quote.toAsset,
            fromAmount: quote.fromAmount,
            toAmount: quote.toAmount,
            feeAmount: quote.feeAmount,
            idempotencyKey,
            ledgerGroupId: groupId,
            status: "COMPLETED",
          },
        });

        // Create transaction record
        await tx.transaction.create({
          data: {
            userId,
            type: "CONVERSION",
            direction: "DEBIT",
            assetSymbol: quote.fromAsset,
            amount: quote.fromAmount,
            status: "COMPLETED",
            counterparty: `Convert to ${quote.toAsset}`,
            narration: `Converted ${quote.fromAmount.toString()} ${quote.fromAsset} to ${quote.toAmount.toString()} ${quote.toAsset}`,
            referenceType: "Conversion",
            referenceId: conversion.id,
            ledgerGroupId: groupId,
          },
        });

        // Audit log
        await tx.auditLog.create({
          data: {
            actorUserId: userId,
            action: "CRYPTO_CONVERSION_EXECUTED",
            targetType: "CONVERSION",
            targetId: conversion.id,
            metadata: {
              fromAsset: quote.fromAsset,
              toAsset: quote.toAsset,
              fromAmount: quote.fromAmount.toString(),
              toAmount: quote.toAmount.toString(),
              feeAmount: quote.feeAmount.toString(),
              rate: quote.rate.toString(),
              ledgerGroupId: groupId,
            },
          },
        });

        return { success: true, conversionId: conversion.id };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 }
    );
  },
  `executeConversion(${quoteId})`
);

return result;
  } catch (error) {
    console.error("Error executing conversion:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Internal error executing conversion",
    };
  }
}
