import "server-only";

import Decimal from "decimal.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CRYPTO_TRADING_ENABLED } from "@/lib/feature-flags";

type TransactionClient = Prisma.TransactionClient;

type ProtectionParams = {
  userId: string;
  symbol: string;
  quantity: string;
  stopPrice?: string;
  takeProfitPrice?: string;
  parentOrderId?: string;
  idempotencyKey: string;
};

type ProtectionResult = {
  success: boolean;
  protectionId?: string;
  error?: string;
};

function positivePrice(value: string | Decimal | null | undefined, name: string): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  let result: Decimal;
  try {
    result = new Decimal(value);
  } catch {
    throw new Error(`Invalid ${name}`);
  }
  if (!result.isFinite() || result.lte(0) || result.decimalPlaces() > 18) {
    throw new Error(`Invalid ${name}`);
  }
  return result;
}

function matchesPrice(existing: Decimal | null, requested: Decimal | null): boolean {
  return existing === null ? requested === null : requested !== null && existing.eq(requested);
}

function getBaseAsset(symbol: string): string {
  const match = symbol.match(/^([A-Z0-9]+)USDT$/);
  if (!match) throw new Error("Protective exits currently require a USDT trading pair");
  return match[1]!;
}

function validatePair(stopPrice: Decimal | null, takeProfitPrice: Decimal | null) {
  if (!stopPrice && !takeProfitPrice) {
    throw new Error("Choose at least one protection: Stop Loss or Take Profit");
  }
  if (stopPrice && takeProfitPrice && !stopPrice.lt(takeProfitPrice)) {
    throw new Error("Stop Loss must be below Take Profit");
  }
}

/**
 * One protective SELL row stores BOTH optional triggers. One row locks funds
 * only once, and OPEN -> FILLED can happen only once: OCO by construction.
 * Must be called inside the parent BUY's serializable transaction.
 */
export async function createLinkedExitProtection(
  tx: TransactionClient,
  parentOrderId: string,
  stopPriceInput: Decimal | null,
  takeProfitPriceInput: Decimal | null,
  idempotencyKey: string,
): Promise<string> {
  const stopPrice = positivePrice(stopPriceInput, "Stop Loss");
  const takeProfitPrice = positivePrice(takeProfitPriceInput, "Take Profit");
  validatePair(stopPrice, takeProfitPrice);

  const parent = await tx.cryptoOrder.findUnique({ where: { id: parentOrderId } });
  if (!parent || parent.side !== "BUY" || !["MARKET", "LIMIT"].includes(parent.type)) {
    throw new Error("Protective exits must belong to a BUY order");
  }
  if (parent.status !== "OPEN" && parent.status !== "FILLED") {
    throw new Error("Parent BUY cannot be protected in its current state");
  }

  const existing = await tx.cryptoOrder.findMany({
    where: { parentOrderId, type: { in: ["STOP_LOSS", "TAKE_PROFIT"] } },
  });
  if (existing.length > 1) throw new Error("More than one protective bracket on this BUY");
  if (existing.length === 1) {
    const bracket = existing[0]!;
    if (
      bracket.idempotencyKey !== idempotencyKey ||
      !matchesPrice(bracket.stopPrice, stopPrice) ||
      !matchesPrice(bracket.takeProfitPrice, takeProfitPrice)
    ) {
      throw new Error("This BUY already has different protection");
    }
    return bracket.id;
  }

  let quantity = parent.quantity;
  let status: "PENDING" | "OPEN" = "PENDING";
  if (parent.status === "FILLED") {
    quantity = parent.quantity.minus(parent.feeAmount);
    if (!quantity.isFinite() || !quantity.gt(0)) {
      throw new Error("Filled BUY has no protectable crypto after fees");
    }
    const wallet = await tx.cryptoWallet.findFirst({ where: { userId: parent.userId } });
    if (!wallet) throw new Error("Crypto wallet not found");
    const reserved = await tx.assetBalance.updateMany({
      where: {
        walletId: wallet.id,
        assetSymbol: getBaseAsset(parent.symbol),
        available: { gte: quantity },
      },
      data: {
        available: { decrement: quantity },
        locked: { increment: quantity },
      },
    });
    if (reserved.count !== 1) throw new Error("Unable to reserve purchased crypto for protection");
    status = "OPEN";
  }

  const bracket = await tx.cryptoOrder.create({
    data: {
      userId: parent.userId,
      symbol: parent.symbol,
      side: "SELL",
      type: stopPrice ? "STOP_LOSS" : "TAKE_PROFIT",
      quantity,
      stopPrice,
      takeProfitPrice,
      limitPrice: null,
      filledPrice: null,
      feeAmount: 0,
      status,
      parentOrderId,
      idempotencyKey,
    },
  });
  return bracket.id;
}

/**
 * The limit matcher already calls this function in the BUY fill transaction.
 * It activates either a SL-only, TP-only, or combined bracket exactly once.
 */
export async function activatePendingProtection(
  tx: TransactionClient,
  parentOrderId: string,
): Promise<void> {
  const pending = await tx.cryptoOrder.findMany({
    where: {
      parentOrderId,
      status: "PENDING",
      type: { in: ["STOP_LOSS", "TAKE_PROFIT"] },
    },
  });
  if (pending.length === 0) return;
  if (pending.length !== 1) throw new Error("Multiple pending protections on one BUY");

  const parent = await tx.cryptoOrder.findUnique({ where: { id: parentOrderId } });
  if (!parent || parent.status !== "FILLED" || parent.side !== "BUY") {
    throw new Error("Cannot activate protection until the BUY fills");
  }

  const quantity = parent.quantity.minus(parent.feeAmount);
  if (!quantity.isFinite() || !quantity.gt(0)) {
    throw new Error("Filled BUY has no protectable crypto after fees");
  }

  const wallet = await tx.cryptoWallet.findFirst({ where: { userId: parent.userId } });
  if (!wallet) throw new Error("Crypto wallet not found");

  const reserved = await tx.assetBalance.updateMany({
    where: {
      walletId: wallet.id,
      assetSymbol: getBaseAsset(parent.symbol),
      available: { gte: quantity },
    },
    data: {
      available: { decrement: quantity },
      locked: { increment: quantity },
    },
  });
  if (reserved.count !== 1) throw new Error("Unable to reserve crypto for protection");

  const activated = await tx.cryptoOrder.updateMany({
    where: { id: pending[0]!.id, status: "PENDING" },
    data: { status: "OPEN", quantity },
  });
  if (activated.count !== 1) throw new Error("Protection activation conflict");
}

/**
 * Server-side protection for holdings already owned, or a separately linked BUY.
 * The front-end trade form attaches protection through placeOrder instead.
 */
export async function createExitProtection(params: ProtectionParams): Promise<ProtectionResult> {
  if (!CRYPTO_TRADING_ENABLED) {
    return { success: false, error: "Trading is temporarily disabled" };
  }
  try {
    const quantity = positivePrice(params.quantity, "quantity");
    const stopPrice = positivePrice(params.stopPrice, "Stop Loss");
    const takeProfitPrice = positivePrice(params.takeProfitPrice, "Take Profit");
    validatePair(stopPrice, takeProfitPrice);
    if (!quantity) throw new Error("Quantity required");

    const protectionId = await prisma.$transaction(async (tx) => {
      const existing = await tx.cryptoOrder.findUnique({
        where: { idempotencyKey: params.idempotencyKey },
      });
      if (existing) {
        if (
          existing.userId !== params.userId || existing.symbol !== params.symbol ||
          existing.side !== "SELL" ||
          !["STOP_LOSS", "TAKE_PROFIT"].includes(existing.type) ||
          !matchesPrice(existing.stopPrice, stopPrice) ||
          !matchesPrice(existing.takeProfitPrice, takeProfitPrice) ||
          existing.parentOrderId !== (params.parentOrderId ?? null) ||
          (!params.parentOrderId && !existing.quantity.eq(quantity))
        ) throw new Error("Idempotency key reused for different protection");
        return existing.id;
      }

      if (params.parentOrderId) {
        const parent = await tx.cryptoOrder.findUnique({ where: { id: params.parentOrderId } });
        if (!parent || parent.userId !== params.userId || parent.symbol !== params.symbol) {
          throw new Error("Parent BUY order not found");
        }
        return createLinkedExitProtection(
          tx, parent.id, stopPrice, takeProfitPrice, params.idempotencyKey,
        );
      }

      const wallet = await tx.cryptoWallet.findFirst({ where: { userId: params.userId } });
      if (!wallet) throw new Error("Crypto wallet not found");
      const reserved = await tx.assetBalance.updateMany({
        where: {
          walletId: wallet.id,
          assetSymbol: getBaseAsset(params.symbol),
          available: { gte: quantity },
        },
        data: {
          available: { decrement: quantity },
          locked: { increment: quantity },
        },
      });
      if (reserved.count !== 1) throw new Error("Insufficient available crypto");

      const bracket = await tx.cryptoOrder.create({
        data: {
          userId: params.userId,
          symbol: params.symbol,
          side: "SELL",
          type: stopPrice ? "STOP_LOSS" : "TAKE_PROFIT",
          quantity,
          stopPrice,
          takeProfitPrice,
          status: "OPEN",
          feeAmount: 0,
          parentOrderId: null,
          idempotencyKey: params.idempotencyKey,
        },
      });
      return bracket.id;
    }, { isolationLevel: "Serializable" });

    return { success: true, protectionId };
  } catch (error) {
    console.error("Failed to create exit protection:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create protection",
    };
  }
}

// Backwards-compatible export for existing server-side callers.
export const createStopLossProtection = createExitProtection;
