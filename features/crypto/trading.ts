import "server-only";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { getSupportedPair } from "@/lib/bybit/instruments";
import { getTicker } from "@/lib/bybit/client";
import { computeMarketBuyFill, computeMarketSellFill, limitBuyShouldFill, limitSellShouldFill } from "./trading-pricing";
import { ensureAssetBalanceAndLedgerAccount } from "./wallet-helpers";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import { getOrCreatePlatformLedgerAccount, cryptoInventoryPoolName, tradingSettlementPoolName, feeRevenuePoolName } from "@/lib/ledger/platform-accounts";
import { withIdempotentFallback } from "@/lib/ledger/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import type { PostingLeg } from "@/lib/ledger/types";
import type { MarketOrderInput, LimitOrderInput } from "@/lib/validation/crypto";
import { AuthError } from "@/features/authentication/errors";

/**
 * A simulated exchange, not a real market: the platform is always the
 * counterparty (product rule: "Build an internal spot-trading simulator
 * before considering third-party order execution"). Every fill posts
 * balanced ledger entries against platform-owned "Crypto Trading
 * Settlement" (quote asset) and "Crypto Inventory" (base asset)
 * accounts — see ARCHITECTURE.md for the full leg breakdown.
 */

async function requireOrderableWallet(userId: string) {
  const wallet = await prisma.cryptoWallet.findFirst({ where: { userId } });
  if (!wallet) throw new AuthError("WALLET_NOT_FOUND", "No crypto wallet found for this account.", 404);
  return wallet;
}

export async function placeMarketOrder(
  userId: string,
  input: MarketOrderInput,
  idempotencyKey: string
) {
  const pair = getSupportedPair(input.symbol);
  if (!pair) throw new AuthError("UNSUPPORTED_SYMBOL", `${input.symbol} is not a supported trading pair.`, 422);

  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existingOrder = await prisma.cryptoOrder.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existingOrder) return existingOrder;

  const wallet = await requireOrderableWallet(userId);
  const ticker = await getTicker(pair.symbol);

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        const { balance: quoteBalance, ledgerAccount: quoteLedger } = await ensureAssetBalanceAndLedgerAccount(
          tx,
          wallet.id,
          pair.quoteAsset
        );
        const { balance: baseBalance, ledgerAccount: baseLedger } = await ensureAssetBalanceAndLedgerAccount(
          tx,
          wallet.id,
          pair.baseAsset
        );

        const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "EQUITY",
          assetSymbol: pair.quoteAsset,
          name: tradingSettlementPoolName(pair.quoteAsset),
        });
        const inventoryPool = await getOrCreatePlatformLedgerAccount(tx, {
          type: "EQUITY",
          assetSymbol: pair.baseAsset,
          name: cryptoInventoryPoolName(pair.baseAsset),
        });

        const legs: PostingLeg[] = [];
        let filledPrice: string;
        let feeAmount: string;
        let debitedQuoteAmount = "0";

        if (input.side === "BUY") {
          const fill = computeMarketBuyFill(input.quantity, ticker.bestAsk, pair.quantityPrecision, pair.pricePrecision);
          filledPrice = fill.fillPrice;
          feeAmount = fill.feeAmount;
          debitedQuoteAmount = fill.notional;

          if (new Decimal(quoteBalance.available.toString()).lt(fill.notional)) {
            throw new AuthError("INSUFFICIENT_FUNDS", `Insufficient ${pair.quoteAsset} balance for this order.`, 422);
          }
          if (new Decimal(fill.notional).lt(pair.minOrderValue)) {
            throw new AuthError(
              "ORDER_TOO_SMALL",
              `Minimum order value is ${pair.minOrderValue} ${pair.quoteAsset}.`,
              422
            );
          }

          const feePool = await getOrCreatePlatformLedgerAccount(tx, {
            type: "REVENUE",
            assetSymbol: pair.baseAsset,
            name: feeRevenuePoolName(pair.baseAsset),
          });

          legs.push(
            { ledgerAccountId: quoteLedger.id, direction: "DEBIT", assetSymbol: pair.quoteAsset, amount: fill.notional, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: settlementPool.id, direction: "CREDIT", assetSymbol: pair.quoteAsset, amount: fill.notional, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: inventoryPool.id, direction: "DEBIT", assetSymbol: pair.baseAsset, amount: input.quantity, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: baseLedger.id, direction: "CREDIT", assetSymbol: pair.baseAsset, amount: fill.netBaseQuantity, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: pair.baseAsset, amount: fill.feeAmount, referenceType: "CryptoOrder", referenceId: "pending" }
          );

          await tx.assetBalance.update({
            where: { id: quoteBalance.id },
            data: { available: { decrement: fill.notional } },
          });
          await tx.assetBalance.update({
            where: { id: baseBalance.id },
            data: { available: { increment: fill.netBaseQuantity } },
          });
        } else {
          const fill = computeMarketSellFill(input.quantity, ticker.bestBid, pair.pricePrecision);
          filledPrice = fill.fillPrice;
          feeAmount = fill.feeAmount;

          if (new Decimal(baseBalance.available.toString()).lt(input.quantity)) {
            throw new AuthError("INSUFFICIENT_FUNDS", `Insufficient ${pair.baseAsset} balance for this order.`, 422);
          }
          if (new Decimal(fill.notional).lt(pair.minOrderValue)) {
            throw new AuthError(
              "ORDER_TOO_SMALL",
              `Minimum order value is ${pair.minOrderValue} ${pair.quoteAsset}.`,
              422
            );
          }

          const feePool = await getOrCreatePlatformLedgerAccount(tx, {
            type: "REVENUE",
            assetSymbol: pair.quoteAsset,
            name: feeRevenuePoolName(pair.quoteAsset),
          });

          legs.push(
            { ledgerAccountId: baseLedger.id, direction: "DEBIT", assetSymbol: pair.baseAsset, amount: input.quantity, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: inventoryPool.id, direction: "CREDIT", assetSymbol: pair.baseAsset, amount: input.quantity, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: settlementPool.id, direction: "DEBIT", assetSymbol: pair.quoteAsset, amount: fill.notional, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: quoteLedger.id, direction: "CREDIT", assetSymbol: pair.quoteAsset, amount: fill.netQuoteAmount, referenceType: "CryptoOrder", referenceId: "pending" },
            { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: pair.quoteAsset, amount: fill.feeAmount, referenceType: "CryptoOrder", referenceId: "pending" }
          );

          await tx.assetBalance.update({
            where: { id: baseBalance.id },
            data: { available: { decrement: input.quantity } },
          });
          await tx.assetBalance.update({
            where: { id: quoteBalance.id },
            data: { available: { increment: fill.netQuoteAmount } },
          });
        }

        const order = await tx.cryptoOrder.create({
          data: {
            userId,
            symbol: pair.symbol,
            side: input.side,
            type: "MARKET",
            quantity: input.quantity,
            filledPrice,
            feeAmount,
            status: "FILLED",
            idempotencyKey: namespacedKey,
            filledAt: new Date(),
          },
        });

        // Now that the order exists, point every leg's referenceId at it
        // and post them atomically together.
        const finalLegs = legs.map((leg) => ({ ...leg, referenceId: order.id }));
        const { groupId } = await postLedgerEntries(tx, finalLegs);
        await tx.cryptoOrder.update({ where: { id: order.id }, data: { ledgerGroupId: groupId } });

        await tx.transaction.create({
          data: {
            userId,
            type: "TRADE",
            direction: input.side === "BUY" ? "DEBIT" : "CREDIT",
            status: "COMPLETED",
            assetSymbol: input.side === "BUY" ? pair.quoteAsset : pair.baseAsset,
            amount: input.side === "BUY" ? debitedQuoteAmount : input.quantity,
            feeAmount,
            counterparty: `${pair.symbol} ${input.side} (market)`,
            narration: `Simulated market ${input.side.toLowerCase()} of ${input.quantity} ${pair.baseAsset}`,
            referenceType: "CryptoOrder",
            referenceId: order.id,
            ledgerGroupId: groupId,
            isDemo: true,
          },
        });

        return order;
      }),
    () => prisma.cryptoOrder.findUnique({ where: { idempotencyKey: namespacedKey } })
  );

  if (!result) throw new Error("Order could not be created or recovered after a duplicate-key conflict.");

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "crypto.market_order",
    targetType: "CryptoOrder",
    targetId: result.id,
    metadata: { symbol: pair.symbol, side: input.side },
  });

  return result;
}

export async function placeLimitOrder(userId: string, input: LimitOrderInput, idempotencyKey: string) {
  const pair = getSupportedPair(input.symbol);
  if (!pair) throw new AuthError("UNSUPPORTED_SYMBOL", `${input.symbol} is not a supported trading pair.`, 422);

  const namespacedKey = `${userId}:${idempotencyKey}`;
  const existing = await prisma.cryptoOrder.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

  const wallet = await requireOrderableWallet(userId);

  // Reserve funds by moving them into `locked` so a limit order can't be
  // placed against balance that's simultaneously spent elsewhere, and so
  // the reservation is visible in the wallet UI (locked vs. available).
  const order = await prisma.$transaction(async (tx) => {
    if (input.side === "BUY") {
      const { balance } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, pair.quoteAsset);
      const reserveAmount = new Decimal(input.quantity).mul(input.limitPrice).toFixed(pair.pricePrecision);
      if (new Decimal(balance.available.toString()).lt(reserveAmount)) {
        throw new AuthError("INSUFFICIENT_FUNDS", `Insufficient ${pair.quoteAsset} balance to reserve for this order.`, 422);
      }
      await tx.assetBalance.update({
        where: { id: balance.id },
        data: { available: { decrement: reserveAmount }, locked: { increment: reserveAmount } },
      });
    } else {
      const { balance } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, pair.baseAsset);
      if (new Decimal(balance.available.toString()).lt(input.quantity)) {
        throw new AuthError("INSUFFICIENT_FUNDS", `Insufficient ${pair.baseAsset} balance to reserve for this order.`, 422);
      }
      await tx.assetBalance.update({
        where: { id: balance.id },
        data: { available: { decrement: input.quantity }, locked: { increment: input.quantity } },
      });
    }

    return tx.cryptoOrder.create({
      data: {
        userId,
        symbol: pair.symbol,
        side: input.side,
        type: "LIMIT",
        quantity: input.quantity,
        limitPrice: input.limitPrice,
        status: "OPEN",
        idempotencyKey: namespacedKey,
      },
    });
  });

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "crypto.limit_order_placed",
    targetType: "CryptoOrder",
    targetId: order.id,
    metadata: { symbol: pair.symbol, side: input.side },
  });

  return order;
}

export async function cancelOrder(userId: string, orderId: string) {
  const order = await prisma.cryptoOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId) {
    throw new AuthError("ORDER_NOT_FOUND", "Order not found.", 404);
  }
  if (order.status !== "OPEN") {
    throw new AuthError("ORDER_NOT_CANCELLABLE", "Only open orders can be cancelled.", 422);
  }

  const pair = getSupportedPair(order.symbol)!;
  const wallet = await requireOrderableWallet(userId);

  await prisma.$transaction(async (tx) => {
    if (order.side === "BUY") {
      const { balance } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, pair.quoteAsset);
      const reserved = new Decimal(order.quantity.toString()).mul(order.limitPrice!.toString()).toFixed(pair.pricePrecision);
      await tx.assetBalance.update({
        where: { id: balance.id },
        data: { available: { increment: reserved }, locked: { decrement: reserved } },
      });
    } else {
      const { balance } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, pair.baseAsset);
      await tx.assetBalance.update({
        where: { id: balance.id },
        data: { available: { increment: order.quantity.toString() }, locked: { decrement: order.quantity.toString() } },
      });
    }

    await tx.cryptoOrder.update({ where: { id: order.id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  });

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "crypto.limit_order_cancelled",
    targetType: "CryptoOrder",
    targetId: order.id,
  });
}

/**
 * Lazily evaluates a user's open limit orders against the current market
 * price and fills any that qualify. There is no persistent background
 * worker (Next.js's serverless-friendly deployment model has no
 * always-on process to run one) — this is called opportunistically from
 * pages that show orders (`/trade`, `/wallets`), which is a reasonable
 * MVP trade-off: a limit order fills the next time the user (or anyone
 * loading their own account) checks, not the instant the market crosses
 * it. Documented as a known limitation, not a hidden gap.
 */
export async function evaluateAndFillOpenOrders(userId: string): Promise<void> {
  const openOrders = await prisma.cryptoOrder.findMany({ where: { userId, status: "OPEN", type: "LIMIT" } });
  if (openOrders.length === 0) return;

  for (const order of openOrders) {
    const pair = getSupportedPair(order.symbol);
    if (!pair || !order.limitPrice) continue;

    const ticker = await getTicker(pair.symbol);
    const shouldFill =
      order.side === "BUY"
        ? limitBuyShouldFill(order.limitPrice.toString(), ticker.bestAsk)
        : limitSellShouldFill(order.limitPrice.toString(), ticker.bestBid);

    if (!shouldFill) continue;

    await fillOpenLimitOrder(userId, order.id);
  }
}

async function fillOpenLimitOrder(userId: string, orderId: string): Promise<void> {
  const wallet = await requireOrderableWallet(userId);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const order = await tx.cryptoOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "OPEN" || !order.limitPrice) return;

    const pair = getSupportedPair(order.symbol);
    if (!pair) return;

    const { balance: quoteBalance, ledgerAccount: quoteLedger } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, pair.quoteAsset);
    const { balance: baseBalance, ledgerAccount: baseLedger } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, pair.baseAsset);
    const settlementPool = await getOrCreatePlatformLedgerAccount(tx, { type: "EQUITY", assetSymbol: pair.quoteAsset, name: tradingSettlementPoolName(pair.quoteAsset) });
    const inventoryPool = await getOrCreatePlatformLedgerAccount(tx, { type: "EQUITY", assetSymbol: pair.baseAsset, name: cryptoInventoryPoolName(pair.baseAsset) });

    const quantity = order.quantity.toString();
    const limitPrice = order.limitPrice.toString();
    const legs: PostingLeg[] = [];

    if (order.side === "BUY") {
      const reserved = new Decimal(quantity).mul(limitPrice).toFixed(pair.pricePrecision);
      const fee = new Decimal(quantity).mul("0.001").toFixed(pair.quantityPrecision);
      const netQuantity = new Decimal(quantity).sub(fee).toFixed(pair.quantityPrecision);
      const feePool = await getOrCreatePlatformLedgerAccount(tx, { type: "REVENUE", assetSymbol: pair.baseAsset, name: feeRevenuePoolName(pair.baseAsset) });

      legs.push(
        { ledgerAccountId: quoteLedger.id, direction: "DEBIT", assetSymbol: pair.quoteAsset, amount: reserved, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: settlementPool.id, direction: "CREDIT", assetSymbol: pair.quoteAsset, amount: reserved, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: inventoryPool.id, direction: "DEBIT", assetSymbol: pair.baseAsset, amount: quantity, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: baseLedger.id, direction: "CREDIT", assetSymbol: pair.baseAsset, amount: netQuantity, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: pair.baseAsset, amount: fee, referenceType: "CryptoOrder", referenceId: order.id }
      );

      await tx.assetBalance.update({ where: { id: quoteBalance.id }, data: { locked: { decrement: reserved } } });
      await tx.assetBalance.update({ where: { id: baseBalance.id }, data: { available: { increment: netQuantity } } });
      await tx.cryptoOrder.update({ where: { id: order.id }, data: { status: "FILLED", filledPrice: limitPrice, feeAmount: fee, filledAt: new Date() } });
    } else {
      const notional = new Decimal(quantity).mul(limitPrice).toFixed(pair.pricePrecision);
      const fee = new Decimal(notional).mul("0.001").toFixed(pair.pricePrecision);
      const netNotional = new Decimal(notional).sub(fee).toFixed(pair.pricePrecision);
      const feePool = await getOrCreatePlatformLedgerAccount(tx, { type: "REVENUE", assetSymbol: pair.quoteAsset, name: feeRevenuePoolName(pair.quoteAsset) });

      legs.push(
        { ledgerAccountId: baseLedger.id, direction: "DEBIT", assetSymbol: pair.baseAsset, amount: quantity, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: inventoryPool.id, direction: "CREDIT", assetSymbol: pair.baseAsset, amount: quantity, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: settlementPool.id, direction: "DEBIT", assetSymbol: pair.quoteAsset, amount: notional, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: quoteLedger.id, direction: "CREDIT", assetSymbol: pair.quoteAsset, amount: netNotional, referenceType: "CryptoOrder", referenceId: order.id },
        { ledgerAccountId: feePool.id, direction: "CREDIT", assetSymbol: pair.quoteAsset, amount: fee, referenceType: "CryptoOrder", referenceId: order.id }
      );

      await tx.assetBalance.update({ where: { id: baseBalance.id }, data: { locked: { decrement: quantity } } });
      await tx.assetBalance.update({ where: { id: quoteBalance.id }, data: { available: { increment: netNotional } } });
      await tx.cryptoOrder.update({ where: { id: order.id }, data: { status: "FILLED", filledPrice: limitPrice, feeAmount: fee, filledAt: new Date() } });
    }

    const { groupId } = await postLedgerEntries(tx, legs);
    await tx.cryptoOrder.update({ where: { id: order.id }, data: { ledgerGroupId: groupId } });

    await tx.transaction.create({
      data: {
        userId,
        type: "TRADE",
        direction: order.side === "BUY" ? "DEBIT" : "CREDIT",
        status: "COMPLETED",
        assetSymbol: order.side === "BUY" ? pair.quoteAsset : pair.baseAsset,
        amount: order.side === "BUY" ? new Decimal(quantity).mul(limitPrice).toFixed(pair.pricePrecision) : quantity,
        counterparty: `${pair.symbol} ${order.side} (limit)`,
        narration: `Simulated limit ${order.side.toLowerCase()} of ${quantity} ${pair.baseAsset} filled`,
        referenceType: "CryptoOrder",
        referenceId: order.id,
        ledgerGroupId: groupId,
        isDemo: true,
      },
    });
  });
}

export async function listOrders(userId: string, status?: "OPEN" | "FILLED" | "CANCELLED") {
  return prisma.cryptoOrder.findMany({
    where: { userId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}
