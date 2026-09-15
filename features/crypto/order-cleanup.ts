import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getHistoricalTradingPair } from "./trading-pairs";
import { ensureAssetBalanceAndLedgerAccount } from "./wallet-helpers";
import { writeAuditLog } from "@/lib/audit/log";

/**
 * Phase 5: Safe OPEN Order Cleanup
 * 
 * Retires all OPEN crypto orders before trading backend removal.
 * Releases exact locked balances back to available.
 * Idempotent and concurrency-safe.
 */

export interface OrderCleanupResult {
  orderId: string;
  symbol: string;
  side: string;
  quantity: string;
  assetReleased: string;
  amountReleased: string;
  status: "cancelled" | "already_closed" | "error";
  error?: string;
}

/**
 * Cancel a single OPEN order and release its locked funds.
 * 
 * Idempotent: can be called multiple times safely.
 * Concurrency-safe: uses optimistic locking via status check in transaction.
 */
export async function cancelOpenOrder(orderId: string): Promise<OrderCleanupResult> {
  const order = await prisma.cryptoOrder.findUnique({ where: { id: orderId } });
  
  if (!order) {
    return {
      orderId,
      symbol: "UNKNOWN",
      side: "UNKNOWN",
      quantity: "0",
      assetReleased: "UNKNOWN",
      amountReleased: "0",
      status: "error",
      error: "Order not found",
    };
  }

  // Idempotency: If already closed, return success
  if (order.status !== "OPEN") {
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity.toString(),
      assetReleased: "N/A",
      amountReleased: "0",
      status: "already_closed",
    };
  }

  const pair = getHistoricalTradingPair(order.symbol);
  if (!pair) {
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity.toString(),
      assetReleased: "UNKNOWN",
      amountReleased: "0",
      status: "error",
      error: `Unknown historical trading pair: ${order.symbol}`,
    };
  }

  try {
    const wallet = await prisma.cryptoWallet.findFirst({ 
      where: { userId: order.userId } 
    });
    
    if (!wallet) {
      return {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        quantity: order.quantity.toString(),
        assetReleased: "UNKNOWN",
        amountReleased: "0",
        status: "error",
        error: "Wallet not found",
      };
    }

    let assetReleased: string = "";
    let amountReleased: string = "";

    await prisma.$transaction(async (tx) => {
      // Concurrency safety: Atomic conditional update (claim the order)
      // Only one transaction can successfully set status from OPEN to CANCELLED
      const updateResult = await tx.cryptoOrder.updateMany({
        where: {
          id: orderId,
          status: "OPEN", // Condition: must still be OPEN
        },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
        },
      });

      // If no rows affected, another transaction already claimed/processed this order
      if (updateResult.count === 0) {
        throw new Error("Order already processed by another transaction");
      }

      if (order.side === "BUY") {
        // BUY order locks quote asset (e.g., USDT for BTCUSDT)
        const { balance } = await ensureAssetBalanceAndLedgerAccount(
          tx,
          wallet.id,
          pair.quoteAsset
        );
        
        const reserved = new Decimal(order.quantity.toString())
          .mul(order.limitPrice!.toString())
          .toFixed(pair.pricePrecision);
        
        assetReleased = pair.quoteAsset;
        amountReleased = reserved;

        // Validate locked balance is sufficient
        if (new Decimal(balance.locked.toString()).lt(reserved)) {
          throw new Error(
            `Inconsistent state: locked ${balance.locked} < required ${reserved} ${pair.quoteAsset}`
          );
        }

        // Release: locked -> available
        await tx.assetBalance.update({
          where: { id: balance.id },
          data: {
            available: { increment: reserved },
            locked: { decrement: reserved },
          },
        });
      } else {
        // SELL order locks base asset (e.g., BTC for BTCUSDT)
        const { balance } = await ensureAssetBalanceAndLedgerAccount(
          tx,
          wallet.id,
          pair.baseAsset
        );
        
        const quantity = order.quantity.toString();
        assetReleased = pair.baseAsset;
        amountReleased = quantity;

        // Validate locked balance is sufficient
        if (new Decimal(balance.locked.toString()).lt(quantity)) {
          throw new Error(
            `Inconsistent state: locked ${balance.locked} < required ${quantity} ${pair.baseAsset}`
          );
        }

        // Release: locked -> available
        await tx.assetBalance.update({
          where: { id: balance.id },
          data: {
            available: { increment: quantity },
            locked: { decrement: quantity },
          },
        });
      }

      // Order already marked CANCELLED by atomic update above
      // No additional update needed here
    });

    // Audit log outside transaction (best-effort)
    await writeAuditLog({
      actorUserId: order.userId,
      actorRole: "ADMIN", // System-initiated cleanup treated as admin action
      action: "crypto.order_cleanup",
      targetType: "CryptoOrder",
      targetId: order.id,
      metadata: {
        symbol: order.symbol,
        side: order.side,
        assetReleased,
        amountReleased,
        reason: "Trading retirement - Phase 5 cleanup",
      },
    });

    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity.toString(),
      assetReleased,
      amountReleased,
      status: "cancelled",
    };
  } catch (error) {
    return {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity.toString(),
      assetReleased: "ERROR",
      amountReleased: "0",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Cancel all OPEN orders for a specific user.
 * Returns results for each order processed.
 */
export async function cancelAllUserOpenOrders(
  userId: string
): Promise<OrderCleanupResult[]> {
  const openOrders = await prisma.cryptoOrder.findMany({
    where: { userId, status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });

  const results: OrderCleanupResult[] = [];

  for (const order of openOrders) {
    const result = await cancelOpenOrder(order.id);
    results.push(result);
  }

  return results;
}

/**
 * Cancel ALL OPEN orders in the system (admin operation).
 * Use with caution - meant for Phase 5 trading retirement.
 */
export async function cancelAllOpenOrders(): Promise<{
  total: number;
  cancelled: number;
  alreadyClosed: number;
  errors: number;
  results: OrderCleanupResult[];
}> {
  const openOrders = await prisma.cryptoOrder.findMany({
    where: { status: "OPEN" },
    orderBy: { createdAt: "asc" },
  });

  const results: OrderCleanupResult[] = [];
  let cancelled = 0;
  let alreadyClosed = 0;
  let errors = 0;

  console.log(`\nProcessing ${openOrders.length} OPEN orders...`);

  for (const order of openOrders) {
    const result = await cancelOpenOrder(order.id);
    results.push(result);

    if (result.status === "cancelled") cancelled++;
    else if (result.status === "already_closed") alreadyClosed++;
    else if (result.status === "error") errors++;

    console.log(
      `  ${result.status.toUpperCase()}: ${result.symbol} ${result.side} ${result.quantity} - Released ${result.amountReleased} ${result.assetReleased}`
    );
  }

  return {
    total: openOrders.length,
    cancelled,
    alreadyClosed,
    errors,
    results,
  };
}

/**
 * Verify no locked balances remain after cleanup.
 * Returns any balances that still have locked amounts.
 */
export async function verifyNoLockedBalances(): Promise<{
  clean: boolean;
  lockedBalances: Array<{
    userId: string;
    assetSymbol: string;
    available: string;
    locked: string;
  }>;
}> {
  const lockedBalances = await prisma.assetBalance.findMany({
    where: { locked: { gt: 0 } },
    include: {
      wallet: {
        select: { userId: true },
      },
    },
  });

  return {
    clean: lockedBalances.length === 0,
    lockedBalances: lockedBalances.map((b) => ({
      userId: b.wallet.userId,
      assetSymbol: b.assetSymbol,
      available: b.available.toString(),
      locked: b.locked.toString(),
    })),
  };
}
