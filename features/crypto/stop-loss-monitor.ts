import "server-only";

import Decimal from "decimal.js";

import { prisma } from "@/lib/db/prisma";

import { getMarketTicker, getTradingInstruments } from "@/lib/market/service";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";

import type { PostingLeg } from "@/lib/ledger/types";

import {

  getOrCreatePlatformLedgerAccount,

  cryptoInventoryPoolName,

  tradingSettlementPoolName,

  feeRevenuePoolName,

} from "@/lib/ledger/platform-accounts";

import { ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";

import { CRYPTO_TRADING_ENABLED } from "@/lib/feature-flags";



/**
 * Simulated Spot Stop Loss / Take Profit monitor.
 *
 * A protective bracket is one SELL order with up to two price triggers. Its
 * cryptocurrency is reserved once, and the first triggered exit fills the
 * entire bracket in a serializable transaction (OCO semantics).
 */

const TAKER_FEE_RATE = new Decimal("0.001");
const MAX_TRANSACTION_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 50;

async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  for (let attempt = 0; attempt < MAX_TRANSACTION_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < MAX_TRANSACTION_RETRIES - 1
      ) {
        const delay = BASE_RETRY_DELAY_MS * 2 ** attempt + Math.random() * BASE_RETRY_DELAY_MS;
        console.warn(`P2034 conflict in ${context}, retry ${attempt + 1} after ${Math.round(delay)}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Transaction retry loop exhausted unexpectedly: ${context}`);
}

interface TriggerResult {
  orderId: string;
  success: boolean;
  error?: string;
}

/** Trigger one protective SELL, never a BUY, at the observed market price. */
async function triggerStopLossOrder(
  orderId: string,
  currentPrice: Decimal,
): Promise<TriggerResult> {
  return withTransactionRetry(
    async () => prisma.$transaction(
      async (tx) => {
        if (!CRYPTO_TRADING_ENABLED) {
          return { orderId, success: false, error: "Trading disabled" };
        }

        const order = await tx.cryptoOrder.findUnique({ where: { id: orderId } });
        if (
          !order || order.status !== "OPEN" || order.side !== "SELL" ||
          (order.type !== "STOP_LOSS" && order.type !== "TAKE_PROFIT") ||
          (!order.stopPrice && !order.takeProfitPrice)
        ) {
          return { orderId, success: false, error: "Order not eligible" };
        }

        // One database order represents both exit conditions. Once it is FILLED,
        // neither condition can execute again.
        const triggerKind: "STOP_LOSS" | "TAKE_PROFIT" | null =
          order.stopPrice && currentPrice.lte(order.stopPrice)
            ? "STOP_LOSS"
            : order.takeProfitPrice && currentPrice.gte(order.takeProfitPrice)
              ? "TAKE_PROFIT"
              : null;
        if (!triggerKind) {
          return { orderId, success: false, error: "Price condition not met" };
        }
        if (!currentPrice.isFinite() || currentPrice.lte(0)) {
          return { orderId, success: false, error: "Invalid market price" };
        }

        const instrument = (await getTradingInstruments()).find((item) => item.symbol === order.symbol);
        if (!instrument) {
          return { orderId, success: false, error: "Unknown instrument" };
        }

        const baseAsset = instrument.baseAsset;
        const quoteAsset = instrument.quoteAsset;
        const quantity = new Decimal(order.quantity.toString());
        if (!quantity.isFinite() || quantity.lte(0)) {
          return { orderId, success: false, error: "Invalid order quantity" };
        }

        // Ledger and balance cache columns are NUMERIC(36,18). Round the
        // simulated quote settlement and fee to avoid exceeding 18 decimals.
        const notional = quantity.mul(currentPrice).toDecimalPlaces(18, Decimal.ROUND_DOWN);
        const feeAmount = notional.mul(TAKER_FEE_RATE).toDecimalPlaces(18, Decimal.ROUND_DOWN);
        const receivedAmount = notional.minus(feeAmount);
        if (notional.lte(0) || receivedAmount.lte(0)) {
          return { orderId, success: false, error: "Order is too small to settle" };
        }

        const wallet = await tx.cryptoWallet.findFirst({ where: { userId: order.userId } });
        if (!wallet) {
          return { orderId, success: false, error: "Crypto wallet not found" };
        }

        const { ledgerAccount: userBaseLedgerAccount } =
          await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, baseAsset);
        const { balance: userQuoteBalance, ledgerAccount: userQuoteLedgerAccount } =
          await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, quoteAsset);

        // Reserve was taken from AVAILABLE when the protection became OPEN.
        // Atomically consume exactly that reserved base quantity.
        const consumed = await tx.assetBalance.updateMany({
          where: {
            walletId: wallet.id,
            assetSymbol: baseAsset,
            locked: { gte: quantity },
          },
          data: { locked: { decrement: quantity } },
        });
        if (consumed.count !== 1) {
          return { orderId, success: false, error: "Insufficient locked crypto balance" };
        }

        // Claim before posting any ledger legs; a concurrent trigger cannot
        // settle the same bracket twice. Any later error rolls back the claim.
        const claimed = await tx.cryptoOrder.updateMany({
          where: { id: orderId, status: "OPEN", side: "SELL" },
          data: {
            status: "FILLED",
            filledPrice: currentPrice,
            feeAmount,
            filledAt: new Date(),
            exitTrigger: triggerKind,
          },
        });
        if (claimed.count !== 1) {
          throw new Error("Protective exit already claimed by another transaction");
        }

        const inventoryAccountBase = await getOrCreatePlatformLedgerAccount(tx, {
          type: "ASSET",
          assetSymbol: baseAsset,
          name: cryptoInventoryPoolName(baseAsset),
        });
        const settlementAccount = await getOrCreatePlatformLedgerAccount(tx, {
          type: "ASSET",
          assetSymbol: quoteAsset,
          name: tradingSettlementPoolName(quoteAsset),
        });
        const feeAccount = await getOrCreatePlatformLedgerAccount(tx, {
          type: "REVENUE",
          assetSymbol: quoteAsset,
          name: feeRevenuePoolName(quoteAsset),
        });

        // Exact same SELL accounting directions as simulated MARKET SELL:
        // base user CREDIT / platform inventory DEBIT;
        // quote settlement CREDIT / user+fee DEBIT.
        const legs: PostingLeg[] = [
          {
            ledgerAccountId: userBaseLedgerAccount.id,
            direction: "CREDIT",
            assetSymbol: baseAsset,
            amount: quantity,
            referenceType: "CryptoOrder",
            referenceId: orderId,
          },
          {
            ledgerAccountId: inventoryAccountBase.id,
            direction: "DEBIT",
            assetSymbol: baseAsset,
            amount: quantity,
            referenceType: "CryptoOrder",
            referenceId: orderId,
          },
          {
            ledgerAccountId: settlementAccount.id,
            direction: "CREDIT",
            assetSymbol: quoteAsset,
            amount: notional,
            referenceType: "CryptoOrder",
            referenceId: orderId,
          },
          {
            ledgerAccountId: userQuoteLedgerAccount.id,
            direction: "DEBIT",
            assetSymbol: quoteAsset,
            amount: receivedAmount,
            referenceType: "CryptoOrder",
            referenceId: orderId,
          },
          {
            ledgerAccountId: feeAccount.id,
            direction: "DEBIT",
            assetSymbol: quoteAsset,
            amount: feeAmount,
            referenceType: "CryptoOrder",
            referenceId: orderId,
          },
        ];
        const { groupId } = await postLedgerEntries(tx, legs);

        await tx.assetBalance.update({
          where: { id: userQuoteBalance.id },
          data: { available: { increment: receivedAmount } },
        });
        await tx.cryptoOrder.update({
          where: { id: orderId },
          data: { ledgerGroupId: groupId },
        });
        return { orderId, success: true };
      },
      { isolationLevel: "Serializable", maxWait: 10000, timeout: 30000 },
    ),
    `triggerStopLoss:${orderId}`,
  );
}

/** Check open protection brackets against live ticker prices. */
export async function checkAndTriggerStopLossOrders(): Promise<{

  checked: number;

  triggered: number;

  failed: number;

}> {

  if (!CRYPTO_TRADING_ENABLED) {

    return { checked: 0, triggered: 0, failed: 0 };

  }

  // Monitor active protective brackets (SL-only, TP-only, or combined OCO).
  const openStopOrders = await prisma.cryptoOrder.findMany({
    where: {
      status: "OPEN",
      side: "SELL",
      type: { in: ["STOP_LOSS", "TAKE_PROFIT"] },
      OR: [
        { stopPrice: { not: null } },
        { takeProfitPrice: { not: null } },
      ],
    },

    orderBy: {

      createdAt: "asc",

    },

    take: 100, // Process in batches

  });

  if (openStopOrders.length === 0) {

    return { checked: 0, triggered: 0, failed: 0 };

  }

  // Group by symbol to minimize ticker calls

  const ordersBySymbol = new Map<string, typeof openStopOrders>();

  for (const order of openStopOrders) {

    const existing = ordersBySymbol.get(order.symbol) || [];

    existing.push(order);

    ordersBySymbol.set(order.symbol, existing);

  }

  let triggered = 0;

  let failed = 0;

  // Process each symbol

  for (const [symbol, orders] of ordersBySymbol.entries()) {

    try {

          // Check market data quality before triggering

          const ticker = await getMarketTicker(symbol);

          if (ticker.status !== "live") {

            // Skip stale markets without preventing other pairs from triggering.

            continue;

          }

          const currentPrice = new Decimal(ticker.lastPrice.toString());

      // Check each order for this symbol

      for (const order of orders) {

        // Use the actual trigger price for both protections.
        const shouldTrigger =
          (!!order.stopPrice && currentPrice.lte(order.stopPrice)) ||
          (!!order.takeProfitPrice && currentPrice.gte(order.takeProfitPrice));

        if (shouldTrigger) {

          const result = await triggerStopLossOrder(order.id, currentPrice);

          if (result.success) {

            triggered++;

            console.log(`✓ Triggered protective exit ${order.id} at ${currentPrice}`);

          } else {

            failed++;

            console.warn(`✗ Failed to trigger ${order.id}: ${result.error}`);

          }

        }

      }

    } catch (error) {

      console.error(`Error checking stop orders for ${symbol}:`, error);

      failed += orders.length;

    }

  }

  return {

    checked: openStopOrders.length,

    triggered,

    failed,

  };

}
