import "server-only";

import Decimal from "decimal.js";

import { prisma } from "@/lib/db/prisma";

import { getMarketTicker, getTradingInstruments } from "@/lib/market/service";

import type { OrderSide, OrderType, Prisma } from "@prisma/client";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";

import type { PostingLeg } from "@/lib/ledger/types";

import {

  getOrCreatePlatformLedgerAccount,

  cryptoInventoryPoolName,

  tradingSettlementPoolName,

  feeRevenuePoolName,

} from "@/lib/ledger/platform-accounts";

import { ensureCryptoWallet, ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";

import { CRYPTO_TRADING_ENABLED } from "@/lib/feature-flags";

import { createLinkedExitProtection } from "./stop-loss-protection";

type TransactionClient = Prisma.TransactionClient;

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

/**

 * Phase 4: Simulated Cryptocurrency Spot Trading

 *

 * SIMULATED TRADING ONLY — No real Bybit order submission!

 *

 * CORRECTED IMPLEMENTATION:

 * - Uses postLedgerEntries for balanced double-entry accounting

 * - Concurrency-safe balance updates with optimistic locking via updateMany

 * - Proper platform counterparty accounts (inventory, settlement, fee pools)

 * - Validated trading instruments, precision, and minimum order quantities

 * - Idempotency with ownership validation and parameter matching

 * - Atomic order cancellation with status transition guards

 *

 * FEATURE FLAG PROTECTION:

 * - CRYPTO_TRADING_ENABLED must be true to execute financial mutations

 * - When disabled, all order placement and cancellation operations are blocked

 */

interface PlaceOrderParams {

  userId: string;

  symbol: string;

  side: OrderSide;

  type: OrderType;

  quantity?: string; // Base asset quantity (optional if quoteAmount provided for BUY)

  quoteAmount?: string; // Quote asset amount (USDT spending amount for BUY orders)

  limitPrice?: string;

  stopPrice?: string; // Standalone stop or attached BUY Stop Loss
  takeProfitPrice?: string; // Optional attached BUY Take Profit

  idempotencyKey: string;

}

interface PlaceOrderResult {

  success: boolean;

  orderId?: string;

  filledPrice?: string;

  feeAmount?: string;

  error?: string;

}

interface CancelOrderParams {

  userId: string;

  orderId: string;

}

interface CancelOrderResult {

  success: boolean;

  error?: string;

}

export async function placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {

  // Feature flag check: Block financial mutations when trading is disabled

  if (!CRYPTO_TRADING_ENABLED) {

    return {

      success: false,

      error: "Cryptocurrency trading is temporarily disabled. Please check back later.",

    };

  }

  const { userId, symbol, side, type, quantity: quantityStr, quoteAmount: quoteAmountStr, limitPrice: limitPriceStr, stopPrice: stopPriceStr, takeProfitPrice: takeProfitPriceStr, idempotencyKey } = params;

  // TAKE_PROFIT is an internal protective bracket order, not a primary entry type.
  if (type === "TAKE_PROFIT") {
    return { success: false, error: "Attach Take Profit to a Market/Limit BUY, or protect owned holdings separately" };
  }

  // For BUY orders, allow either quantity or quoteAmount

  // For SELL orders, require quantity

  if (!quantityStr && !quoteAmountStr) {

    return { success: false, error: "Either quantity or quote amount must be provided" };

  }

  if (side === "SELL" && !quantityStr) {

    return { success: false, error: "Quantity required for SELL orders" };

  }

  if (side === "BUY" && quantityStr && quoteAmountStr) {

    return { success: false, error: "Provide either quantity or quote amount, not both" };

  }

  // We'll calculate the actual quantity after validating prices

  let quantity: Decimal;

  let quoteAmount: Decimal | null = null;

  let isQuoteAmountMode = false;

  if (quoteAmountStr) {

    quoteAmount = new Decimal(quoteAmountStr);

    if (!quoteAmount.isFinite() || quoteAmount.lte(0)) {

      return { success: false, error: "Quote amount must be a positive finite number" };

    }

    isQuoteAmountMode = true;

    // Quantity will be calculated after we have the price

    quantity = new Decimal(0); // Placeholder

  } else {

    quantity = new Decimal(quantityStr!);

    if (!quantity.isFinite() || quantity.lte(0)) {

      return { success: false, error: "Quantity must be a positive finite number" };

    }

  }

  if (type === "LIMIT" && !limitPriceStr) {

    return { success: false, error: "Limit price required for limit orders" };

  }

  if (type === "STOP_LOSS" && !stopPriceStr) {

    return { success: false, error: "Stop price required for stop-loss orders" };

  }

  // BUY-above-price is a separate stop-entry order feature, not a protective

  // Stop Loss. Until stop-entry reservation/repricing exists, prohibit it.

  if (type === "STOP_LOSS" && side === "BUY") {

    return { success: false, error: "Protective Stop Loss is a SELL trigger. Conditional BUY entries are not supported yet." };

  }

  const limitPrice = limitPriceStr ? new Decimal(limitPriceStr) : null;

  if (limitPrice && (!limitPrice.isFinite() || limitPrice.lte(0))) {

    return { success: false, error: "Limit price must be a positive finite number" };

  }

  const stopPrice = stopPriceStr ? new Decimal(stopPriceStr) : null;

  if (stopPrice && (!stopPrice.isFinite() || stopPrice.lte(0) || stopPrice.decimalPlaces() > 18)) {

    return { success: false, error: "Stop price must be a positive finite number (max 18 decimal places)" };

  }

  const takeProfitPrice = takeProfitPriceStr ? new Decimal(takeProfitPriceStr) : null;

  if (takeProfitPrice && (!takeProfitPrice.isFinite() || takeProfitPrice.lte(0) || takeProfitPrice.decimalPlaces() > 18)) {
    return { success: false, error: "Take Profit must be a positive price with no more than 18 decimal places" };
  }

  // Attached exits belong to an entry BUY, never to a SELL or standalone trigger.
  if (takeProfitPrice && type !== "MARKET" && type !== "LIMIT") {
    return { success: false, error: "Take Profit can only be attached to a Market or Limit BUY" };
  }
  if ((stopPrice || takeProfitPrice) && (type === "MARKET" || type === "LIMIT") && side !== "BUY") {
    return { success: false, error: "Protective exits on new orders are available on BUY only" };
  }
  if (stopPrice && takeProfitPrice && !stopPrice.lt(takeProfitPrice)) {
    return { success: false, error: "Stop Loss must be below Take Profit" };
  }

  const { baseAsset, quoteAsset } = parseTradingPair(symbol);

  if (!baseAsset || !quoteAsset) {

    return { success: false, error: `Invalid trading pair: ${symbol}` };

  }

  try {

    // Validate trading instrument

    const instruments = await getTradingInstruments({ symbol, activeOnly: true });

    const instrument = instruments.find((i) => i.symbol === symbol);

    if (!instrument) {

      return { success: false, error: `Trading pair ${symbol} not supported or inactive` };

    }

    if (stopPrice && stopPrice.decimalPlaces() > instrument.pricePrecision) {
      return { success: false, error: `Stop price precision exceeds ${instrument.pricePrecision} decimal places` };
    }
    if (takeProfitPrice && takeProfitPrice.decimalPlaces() > instrument.pricePrecision) {
      return { success: false, error: `Take Profit precision exceeds ${instrument.pricePrecision} decimal places` };
    }

    // Determine execution price based on order type

    let executionPrice: Decimal | null = null;

    if (type === "MARKET") {

      const ticker = await getMarketTicker(symbol);

      if (ticker.status !== "live") {

        return { success: false, error: "Market data unavailable" };

      }

      executionPrice = ticker.lastPrice;

    }

    if ((stopPrice || takeProfitPrice) && (type === "MARKET" || type === "LIMIT") && side === "BUY") {
      const entryReference = type === "MARKET" ? executionPrice : limitPrice;
      if (!entryReference) {
        return { success: false, error: "Missing BUY entry reference price" };
      }
      if (stopPrice && !stopPrice.lt(entryReference)) {
        return { success: false, error: "Stop Loss must be below the BUY entry price" };
      }
      if (takeProfitPrice && !takeProfitPrice.gt(entryReference)) {
        return { success: false, error: "Take Profit must be above the BUY entry price" };
      }
    }

    // Calculate quantity from quoteAmount if provided

    if (isQuoteAmountMode) {

      const priceForCalculation = type === "MARKET" ? executionPrice! : type === "STOP_LOSS" ? stopPrice : limitPrice;

      if (!priceForCalculation) {

        return { success: false, error: "Price required to calculate quantity from quote amount" };

      }

      // For BUY: quantity = quoteAmount / price (before fees)

      // We need to account for fees being taken from the received amount

      // quoteAmount is the total USDT the user wants to spend

      // requiredAmount (including fees) should not exceed quoteAmount

      const feeRate = new Decimal(type === "LIMIT" ? 0.0005 : 0.001);

      // Calculate quantity such that: quantity * price * (1 + feeRate) <= quoteAmount

      // But fees are taken from received crypto, not added to quote cost

      // So: quantity * price = quoteAmount, and fee is taken from quantity

      // Let's use: quantity = quoteAmount / price (gross quantity before fees)

      quantity = quoteAmount!.div(priceForCalculation);

      // Adjust for precision

      if (quantity.decimalPlaces() > instrument.quantityPrecision) {

        quantity = quantity.toDecimalPlaces(instrument.quantityPrecision, Decimal.ROUND_DOWN);

      }

    }

    if (quantity.decimalPlaces() > instrument.quantityPrecision) {

      return {

        success: false,

        error: `Quantity precision exceeds maximum of ${instrument.quantityPrecision} decimal places`,

      };

    }

    if (limitPrice && limitPrice.decimalPlaces() > instrument.pricePrecision) {

      return {

        success: false,

        error: `Price precision exceeds maximum of ${instrument.pricePrecision} decimal places`,

      };

    }

    if (quantity.lt(instrument.minOrderQuantity)) {

      return {

        success: false,

        error: `Quantity below minimum ${instrument.minOrderQuantity} ${baseAsset}`,

      };

    }

    // Idempotency check

    const existingOrder = await prisma.cryptoOrder.findUnique({

      where: { idempotencyKey },

    });

    if (existingOrder) {

      if (existingOrder.userId !== userId) {

        return { success: false, error: "Idempotency key already used by another user" };

      }

      // Verify request parameters match to prevent mutation with mismatched params

      // When quoteAmount is used, the calculated quantity should match

      const paramsMatch =

        existingOrder.symbol === symbol &&

        existingOrder.side === side &&

        existingOrder.type === type &&

        existingOrder.quantity.eq(quantity) &&

        (type === "MARKET" ||

          (type === "STOP_LOSS" ? !!existingOrder.stopPrice?.eq(stopPrice || 0) : !!existingOrder.limitPrice?.eq(limitPrice || 0)));

      const existingProtection = await prisma.cryptoOrder.findFirst({
        where: { parentOrderId: existingOrder.id, type: { in: ["STOP_LOSS", "TAKE_PROFIT"] } },
      });
      const wantsProtection = type !== "STOP_LOSS" && (stopPrice !== null || takeProfitPrice !== null);
      const protectionMatches = type === "STOP_LOSS" || (
        !wantsProtection
          ? existingProtection === null
          : !!existingProtection &&
            (stopPrice === null ? existingProtection.stopPrice === null : !!existingProtection.stopPrice?.eq(stopPrice)) &&
            (takeProfitPrice === null ? existingProtection.takeProfitPrice === null : !!existingProtection.takeProfitPrice?.eq(takeProfitPrice))
      );

      if (!paramsMatch || !protectionMatches) {

        return {

          success: false,

          error: "Idempotency key reused with different order parameters. Original order preserved.",

        };

      }

      return {

        success: true,

        orderId: existingOrder.id,

        filledPrice: existingOrder.filledPrice?.toString(),

        feeAmount: existingOrder.feeAmount?.toString(),

      };

    }

    // Execute in serializable transaction with P2034 retry protection

    const result = await withTransactionRetry(

      async () => {

        return await prisma.$transaction(

          async (tx) => {

            // Revalidate idempotency on each retry attempt

            const existingRetry = await tx.cryptoOrder.findUnique({

              where: { idempotencyKey },

            });

            if (existingRetry) {

              if (existingRetry.userId !== userId) {

                throw new Error("Idempotency key already used by another user");

              }

              const paramsMatch =

                existingRetry.symbol === symbol &&

                existingRetry.side === side &&

                existingRetry.type === type &&

                existingRetry.quantity.eq(quantity) &&

                (type === "MARKET" ||

                  (type === "STOP_LOSS" ? !!existingRetry.stopPrice?.eq(stopPrice || 0) : !!existingRetry.limitPrice?.eq(limitPrice || 0)));

              const existingProtection = await tx.cryptoOrder.findFirst({
                where: { parentOrderId: existingRetry.id, type: { in: ["STOP_LOSS", "TAKE_PROFIT"] } },
              });
              const wantsProtection = type !== "STOP_LOSS" && (stopPrice !== null || takeProfitPrice !== null);
              const protectionMatches = type === "STOP_LOSS" || (
                !wantsProtection
                  ? existingProtection === null
                  : !!existingProtection &&
                    (stopPrice === null ? existingProtection.stopPrice === null : !!existingProtection.stopPrice?.eq(stopPrice)) &&
                    (takeProfitPrice === null ? existingProtection.takeProfitPrice === null : !!existingProtection.takeProfitPrice?.eq(takeProfitPrice))
              );

              if (!paramsMatch || !protectionMatches) {

                throw new Error(

                  "Idempotency key reused with different order parameters. Original order preserved."

                );

              }

              // Return existing order result without re-settling

              return {

                success: true,

                orderId: existingRetry.id,

                filledPrice: existingRetry.filledPrice?.toString(),

                feeAmount: existingRetry.feeAmount?.toString(),

              };

            }

            const wallet = await ensureCryptoWallet(tx, userId);

            const sourceAsset = side === "BUY" ? quoteAsset : baseAsset;

            const destAsset = side === "BUY" ? baseAsset : quoteAsset;

            let requiredAmount: Decimal;

            let receivedAmount: Decimal;

            let feeAmount: Decimal;

            const feeRate = new Decimal(0.001);

            if (side === "BUY") {

              const priceToUse = type === "MARKET" ? executionPrice! : type === "STOP_LOSS" ? stopPrice! : limitPrice!;

              requiredAmount = quantity.times(priceToUse);

              receivedAmount = quantity;

              feeAmount = receivedAmount.times(feeRate);

              receivedAmount = receivedAmount.minus(feeAmount);

            } else {

              requiredAmount = quantity;

              const priceToUse = type === "MARKET" ? executionPrice! : type === "STOP_LOSS" ? stopPrice! : limitPrice!;

              receivedAmount = quantity.times(priceToUse);

              feeAmount = receivedAmount.times(feeRate);

              receivedAmount = receivedAmount.minus(feeAmount);

            }

            // Revalidate balance on each retry attempt

            const { balance: sourceBalance } = await ensureAssetBalanceAndLedgerAccount(

              tx,

              wallet.id,

              sourceAsset

            );

            if (sourceBalance.available.lt(requiredAmount)) {

              throw new Error(

                `Insufficient ${sourceAsset} balance. Required: ${requiredAmount.toString()}, Available: ${sourceBalance.available.toString()}`

              );

            }

            if (type === "MARKET") {

              return await executeMarketOrder(tx, {

                userId,

                walletId: wallet.id,

                symbol,

                side,

                quantity,

                executionPrice: executionPrice!,

                requiredAmount,

                receivedAmount,

                feeAmount,

                sourceAsset,

                destAsset,

                baseAsset,

                quoteAsset,

                idempotencyKey,

                attachedStopPrice: stopPrice,
                attachedTakeProfitPrice: takeProfitPrice,

              });

            } else if (type === "STOP_LOSS") {

              // Stop-loss orders are placed as OPEN and monitored for triggering

              return await placeStopLossOrder(tx, {

                userId,

                walletId: wallet.id,

                symbol,

                side,

                quantity,

                stopPrice: stopPrice!,

                requiredAmount,

                sourceAsset,

                idempotencyKey,

              });

            } else {

              return await placeLimitOrder(tx, {

                userId,

                walletId: wallet.id,

                symbol,

                side,

                quantity,

                limitPrice: limitPrice!,

                requiredAmount,

                sourceAsset,

                idempotencyKey,

                attachedStopPrice: stopPrice,
                attachedTakeProfitPrice: takeProfitPrice,

              });

            }

          },

          { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 }

        );

      },

      `placeOrder(${symbol}, ${side}, ${type})`

    );

    return result;

  } catch (error) {

    console.error("Error placing order:", error);

    return {

      success: false,

      error: error instanceof Error ? error.message : "Internal error placing order",

    };

  }

}

export async function cancelOrder(params: CancelOrderParams): Promise<CancelOrderResult> {

  // Feature flag check: Block financial mutations when trading is disabled

  if (!CRYPTO_TRADING_ENABLED) {

    return {

      success: false,

      error: "Cryptocurrency trading is temporarily disabled. Please check back later.",

    };

  }

  const { userId, orderId } = params;

  try {

    await withTransactionRetry(

      async () => {

        return await prisma.$transaction(

          async (tx) => {

            // Revalidate order state on each retry attempt

            const order = await tx.cryptoOrder.findUnique({ where: { id: orderId } });

            if (!order) throw new Error("Order not found");

            if (order.userId !== userId) throw new Error("Not authorized");

            if (order.status !== "OPEN") throw new Error(`Cannot cancel ${order.status.toLowerCase()} order`);

            const wallet = await tx.cryptoWallet.findFirst({ where: { userId } });

            if (!wallet) throw new Error("Wallet not found");

            const { baseAsset, quoteAsset } = parseTradingPair(order.symbol);

            if (!baseAsset || !quoteAsset) throw new Error("Invalid trading pair");

            const lockedAsset = order.side === "BUY" ? quoteAsset : baseAsset;

            let lockedAmount: Decimal;

            if (order.type === "LIMIT") {

              lockedAmount = order.side === "BUY" ? order.quantity.times(order.limitPrice!) : order.quantity;

            } else if (order.type === "STOP_LOSS" || order.type === "TAKE_PROFIT") {

              lockedAmount = order.quantity; // Both protections are SELL exits and lock base crypto once

            } else {

              throw new Error(`Cannot cancel ${order.type} order`);

            }

            // Revalidate balance on each retry attempt

            const balance = await tx.assetBalance.findUnique({

              where: { walletId_assetSymbol: { walletId: wallet.id, assetSymbol: lockedAsset } },

            });

            if (!balance || balance.locked.lt(lockedAmount)) {

              throw new Error("Insufficient locked balance");

            }

            // Atomic balance update with concurrency check

            const updated = await tx.assetBalance.updateMany({

              where: {

                walletId: wallet.id,

                assetSymbol: lockedAsset,

                locked: { gte: lockedAmount },

              },

              data: {

                locked: { decrement: lockedAmount },

                available: { increment: lockedAmount },

              },

            });

            if (updated.count === 0) {

              throw new Error("Concurrent cancellation detected or insufficient locked balance");

            }

            // Atomic order status transition

            const cancelled = await tx.cryptoOrder.updateMany({

              where: { id: orderId, status: "OPEN" },

              data: { status: "CANCELLED", cancelledAt: new Date() },

            });

            if (cancelled.count === 0) {

              throw new Error("Order already cancelled or filled");

            }

            // PENDING child protection has not locked funds; retire it

            // atomically with cancellation of its unfilled parent BUY.

            if (order.type === "LIMIT" && order.side === "BUY") {

              await tx.cryptoOrder.updateMany({

                where: {

                  parentOrderId: order.id,

                  type: { in: ["STOP_LOSS", "TAKE_PROFIT"] },

                  status: "PENDING",

                },

                data: { status: "CANCELLED", cancelledAt: new Date() },

              });

            }

            await tx.auditLog.create({

              data: {

                actorUserId: userId,

                action: "CRYPTO_ORDER_CANCELLED",

                targetType: "CRYPTO_ORDER",

                targetId: orderId,

                metadata: {

                  symbol: order.symbol,

                  side: order.side,

                  quantity: order.quantity.toString(),

                  limitPrice: order.limitPrice?.toString(),

                  lockedAsset,

                  releasedAmount: lockedAmount.toString(),

                },

              },

            });

          },

          { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 }

        );

      },

      `cancelOrder(${orderId})`

    );

    return { success: true };

  } catch (error) {

    console.error("Error cancelling order:", error);

    return {

      success: false,

      error: error instanceof Error ? error.message : "Internal error cancelling order",

    };

  }

}

async function executeMarketOrder(

  tx: TransactionClient,

  params: {

    userId: string;

    walletId: string;

    symbol: string;

    side: OrderSide;

    quantity: Decimal;

    executionPrice: Decimal;

    requiredAmount: Decimal;

    receivedAmount: Decimal;

    feeAmount: Decimal;

    sourceAsset: string;

    destAsset: string;

    baseAsset: string;

    quoteAsset: string;

    idempotencyKey: string;

    attachedStopPrice?: Decimal | null;
    attachedTakeProfitPrice?: Decimal | null;

  }

): Promise<PlaceOrderResult> {

  const {

    userId,

    walletId,

    symbol,

    side,

    quantity,

    executionPrice,

    requiredAmount,

    receivedAmount,

    feeAmount,

    sourceAsset,

    destAsset,

    baseAsset,

    quoteAsset,

    idempotencyKey,

    attachedStopPrice,
    attachedTakeProfitPrice,

  } = params;

  // Get ledger accounts

  const { ledgerAccount: sourceLedgerAccount } = await ensureAssetBalanceAndLedgerAccount(tx, walletId, sourceAsset);

  const { ledgerAccount: destLedgerAccount, balance: destBalance } = await ensureAssetBalanceAndLedgerAccount(

    tx,

    walletId,

    destAsset

  );

  // Platform counterparty accounts

  const inventoryPool = await getOrCreatePlatformLedgerAccount(tx, {

    type: "ASSET",

    assetSymbol: baseAsset,

    name: cryptoInventoryPoolName(baseAsset),

  });

  const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {

    type: "ASSET",

    assetSymbol: quoteAsset,

    name: tradingSettlementPoolName(quoteAsset),

  });

  const feePool = await getOrCreatePlatformLedgerAccount(tx, {

    type: "REVENUE",

    assetSymbol: destAsset,

    name: feeRevenuePoolName(destAsset),

  });

  // Build balanced ledger entries

  const legs: PostingLeg[] = [];

  if (side === "BUY") {

    // Base asset (BTC):

    legs.push(

      {

        ledgerAccountId: inventoryPool.id,

        direction: "CREDIT",

        assetSymbol: baseAsset,

        amount: quantity,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      },

      {

        ledgerAccountId: destLedgerAccount.id,

        direction: "DEBIT",

        assetSymbol: baseAsset,

        amount: receivedAmount,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      },

      {

        ledgerAccountId: feePool.id,

        direction: "DEBIT",

        assetSymbol: baseAsset,

        amount: feeAmount,

        referenceType: "CryptoTradeFee",

        referenceId: idempotencyKey,

      }

    );

    // Quote asset (USDT):

    legs.push(

      {

        ledgerAccountId: sourceLedgerAccount.id,

        direction: "CREDIT",

        assetSymbol: quoteAsset,

        amount: requiredAmount,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      },

      {

        ledgerAccountId: settlementPool.id,

        direction: "DEBIT",

        assetSymbol: quoteAsset,

        amount: requiredAmount,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      }

    );

  } else {

    // Base asset (BTC):

    legs.push(

      {

        ledgerAccountId: sourceLedgerAccount.id,

        direction: "CREDIT",

        assetSymbol: baseAsset,

        amount: requiredAmount,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      },

      {

        ledgerAccountId: inventoryPool.id,

        direction: "DEBIT",

        assetSymbol: baseAsset,

        amount: requiredAmount,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      }

    );

    // Quote asset (USDT):

    legs.push(

      {

        ledgerAccountId: settlementPool.id,

        direction: "CREDIT",

        assetSymbol: quoteAsset,

        amount: receivedAmount.plus(feeAmount),

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      },

      {

        ledgerAccountId: destLedgerAccount.id,

        direction: "DEBIT",

        assetSymbol: quoteAsset,

        amount: receivedAmount,

        referenceType: "CryptoTrade",

        referenceId: idempotencyKey,

      },

      {

        ledgerAccountId: feePool.id,

        direction: "DEBIT",

        assetSymbol: quoteAsset,

        amount: feeAmount,

        referenceType: "CryptoTradeFee",

        referenceId: idempotencyKey,

      }

    );

  }

  // Post balanced entries (throws if imbalanced)

  const { groupId } = await postLedgerEntries(tx, legs);

  // Concurrency-safe balance updates

  const sourceUpdated = await tx.assetBalance.updateMany({

    where: { walletId, assetSymbol: sourceAsset, available: { gte: requiredAmount } },

    data: { available: { decrement: requiredAmount } },

  });

  if (sourceUpdated.count === 0) {

    throw new Error(`Concurrent order detected: insufficient ${sourceAsset} available`);

  }

  await tx.assetBalance.update({

    where: { id: destBalance.id },

    data: { available: { increment: receivedAmount } },

  });

  // Create order record

  const order = await tx.cryptoOrder.create({

    data: {

      userId,

      symbol,

      side,

      type: "MARKET",

      quantity,

      limitPrice: null,

      filledPrice: executionPrice,

      feeAmount,

      status: "FILLED",

      idempotencyKey,

      ledgerGroupId: groupId,

      filledAt: new Date(),

    },

  });

  await tx.auditLog.create({

    data: {

      actorUserId: userId,

      action: "CRYPTO_TRADE_EXECUTED",

      targetType: "CRYPTO_ORDER",

      targetId: order.id,

      metadata: {

        symbol,

        side,

        type: "MARKET",

        quantity: quantity.toString(),

        executionPrice: executionPrice.toString(),

        ledgerGroupId: groupId,

      },

    },

  });

  if (side === "BUY" && (attachedStopPrice || attachedTakeProfitPrice)) {

    // This must happen in the settlement transaction: already FILLED BUYs

    // cannot safely use PENDING child protection created afterwards.

    await createLinkedExitProtection(

      tx, order.id, attachedStopPrice ?? null, attachedTakeProfitPrice ?? null, `${idempotencyKey}_protection`,

    );

  }

  return {

    success: true,

    orderId: order.id,

    filledPrice: executionPrice.toString(),

    feeAmount: feeAmount.toString(),

  };

}

async function placeLimitOrder(

  tx: TransactionClient,

  params: {

    userId: string;

    walletId: string;

    symbol: string;

    side: OrderSide;

    quantity: Decimal;

    limitPrice: Decimal;

    requiredAmount: Decimal;

    sourceAsset: string;

    idempotencyKey: string;

    attachedStopPrice?: Decimal | null;
    attachedTakeProfitPrice?: Decimal | null;

  }

): Promise<PlaceOrderResult> {

  const { userId, walletId, symbol, side, quantity, limitPrice, requiredAmount, sourceAsset, idempotencyKey, attachedStopPrice, attachedTakeProfitPrice } = params;

  const { balance: sourceBalance } = await ensureAssetBalanceAndLedgerAccount(tx, walletId, sourceAsset);

  // Concurrency-safe lock

  const updated = await tx.assetBalance.updateMany({

    where: { id: sourceBalance.id, available: { gte: requiredAmount } },

    data: {

      available: { decrement: requiredAmount },

      locked: { increment: requiredAmount },

    },

  });

  if (updated.count === 0) {

    throw new Error(`Concurrent order detected: insufficient ${sourceAsset} available`);

  }

  const order = await tx.cryptoOrder.create({

    data: {

      userId,

      symbol,

      side,

      type: "LIMIT",

      quantity,

      limitPrice,

      filledPrice: null,

      feeAmount: 0,

      status: "OPEN",

      idempotencyKey,

      ledgerGroupId: null,

    },

  });

  if (side === "BUY" && (attachedStopPrice || attachedTakeProfitPrice)) {

    // PENDING protection is committed atomically with its OPEN LIMIT parent.

    await createLinkedExitProtection(

      tx, order.id, attachedStopPrice ?? null, attachedTakeProfitPrice ?? null, `${idempotencyKey}_protection`,

    );

  }

  await tx.auditLog.create({

    data: {

      actorUserId: userId,

      action: "CRYPTO_LIMIT_ORDER_PLACED",

      targetType: "CRYPTO_ORDER",

      targetId: order.id,

      metadata: {

        symbol,

        side,

        type: "LIMIT",

        quantity: quantity.toString(),

        limitPrice: limitPrice.toString(),

        lockedAsset: sourceAsset,

        lockedAmount: requiredAmount.toString(),

      },

    },

  });

  return { success: true, orderId: order.id };

}

async function placeStopLossOrder(

  tx: TransactionClient,

  params: {

    userId: string;

    walletId: string;

    symbol: string;

    side: OrderSide;

    quantity: Decimal;

    stopPrice: Decimal;

    requiredAmount: Decimal;

    sourceAsset: string;

    idempotencyKey: string;

  }

): Promise<PlaceOrderResult> {

  const { userId, walletId, symbol, side, quantity, stopPrice, requiredAmount, sourceAsset, idempotencyKey } = params;

  const { balance: sourceBalance } = await ensureAssetBalanceAndLedgerAccount(tx, walletId, sourceAsset);

  // Concurrency-safe lock (stop-loss locks funds like limit orders)

  const updated = await tx.assetBalance.updateMany({

    where: { id: sourceBalance.id, available: { gte: requiredAmount } },

    data: {

      available: { decrement: requiredAmount },

      locked: { increment: requiredAmount },

    },

  });

  if (updated.count === 0) {

    throw new Error(`Concurrent order detected: insufficient ${sourceAsset} available`);

  }

  const order = await tx.cryptoOrder.create({

    data: {

      userId,

      symbol,

      side,

      type: "STOP_LOSS",

      quantity,

      limitPrice: null,

      stopPrice,

      filledPrice: null,

      feeAmount: 0,

      status: "OPEN",

      idempotencyKey,

      ledgerGroupId: null,

    },

  });

  await tx.auditLog.create({

    data: {

      actorUserId: userId,

      action: "CRYPTO_STOP_LOSS_ORDER_PLACED",

      targetType: "CRYPTO_ORDER",

      targetId: order.id,

      metadata: {

        symbol,

        side,

        type: "STOP_LOSS",

        quantity: quantity.toString(),

        stopPrice: stopPrice.toString(),

        lockedAsset: sourceAsset,

        lockedAmount: requiredAmount.toString(),

      },

    },

  });

  return { success: true, orderId: order.id };

}

function parseTradingPair(symbol: string): { baseAsset: string | null; quoteAsset: string | null } {

  const quoteAssets = ["USDT", "USD", "USDC", "BTC", "ETH"];

  for (const quote of quoteAssets) {

    if (symbol.endsWith(quote)) {

      const base = symbol.slice(0, -quote.length);

      if (base.length > 0) {

        return { baseAsset: base, quoteAsset: quote };

      }

    }

  }

  return { baseAsset: null, quoteAsset: null };

}

export async function getUserOpenOrders(userId: string) {

  return await prisma.cryptoOrder.findMany({

    where: { userId, status: "OPEN" },

    orderBy: { createdAt: "desc" },

  });

}

export async function getUserOrderHistory(userId: string, limit: number = 50) {

  return await prisma.cryptoOrder.findMany({

    where: { userId },

    orderBy: { createdAt: "desc" },

    take: limit,

  });

}
