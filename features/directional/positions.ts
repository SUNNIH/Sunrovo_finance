import "server-only";

/**
 * Sunrovo Finance — synthetic, isolated 1x market LONG/SHORT positions.
 * Bybit supplies public spot prices ONLY. No real exchange orders or borrowing.
 * Collateral is a tagged part of the customer's existing USDT locked balance;
 * the base coin is NEVER debited or credited by this subsystem.
 */
import { prisma } from "@/lib/db/prisma";
import { getMarketTicker, getTradingInstruments } from "@/lib/market/service";
import { ensureAssetBalanceAndLedgerAccount } from "@/features/crypto/wallet-helpers";
import { getOrCreatePlatformLedgerAccount, feeRevenuePoolName } from "@/lib/ledger/platform-accounts";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import type { PostingLeg } from "@/lib/ledger/types";
import type { Prisma, DirectionalCloseReason, DirectionalSide, DirectionalPosition } from "@prisma/client";
import type Decimal from "decimal.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { CRYPTO_TRADING_ENABLED } from "@/lib/feature-flags";
import {
  PreciseDecimal, assertSqlDecimal, calculateRequiredMargin, calculateTradingFee,
  calculateCloseSettlement, calculatePositionValue, findTriggeredExit,
  parsePositiveDecimal, validatePositionBracket,
  type ExitReason,
} from "./position-math";

const FEE_RATE = new PreciseDecimal("0.001"); // 0.1% entry & exit, quote USDT
const MAX_MARK_AGE_MS = 30_000;
const REF = "DirectionalPosition";

type Result = { success: boolean; positionId?: string; filledPrice?: string; error?: string };

export type OpenDirectionalInput = {
  userId: string;
  walletId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: string;
  stopLossPrice?: string | null;
  takeProfitPrice?: string | null;
  idempotencyKey: string;
};

function fail(error: unknown): Result {
  return { success: false, error: error instanceof Error ? error.message : "Trading request failed" };
}

function validKey(key: string) {
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(key)) throw new Error("Invalid idempotency key");
}

async function liveMark(symbol: string) {
  const ticker = await getMarketTicker(symbol);
  if (ticker.status !== "live" || !ticker.lastPrice.isFinite() || ticker.lastPrice.lte(0) ||
      !Number.isFinite(ticker.timestamp.getTime()) ||
      Math.abs(Date.now() - ticker.timestamp.getTime()) > MAX_MARK_AGE_MS) {
    throw new Error("Live market price unavailable or too old; position not executed");
  }
  return parsePositiveDecimal(ticker.lastPrice, "Market price");
}

async function serializableRetry<T>(operation: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await operation(); } catch (error) {
      if (!(error instanceof PrismaClientKnownRequestError) || error.code !== "P2034" || i === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (i + 1)));
    }
  }
  throw new Error("Transaction retry exhausted");
}

/**
 * A public-market quote captured by the trusted server-side position monitor.
 * Keep the exact observed trigger price for settlement: fetching a different
 * quote after a TP/SL was detected can otherwise cause the trigger to vanish.
 * Do not populate this object from an HTTP request or a client action.
 */
export type DirectionalTriggerObservation = {
  symbol: string;
  price: string;
  timestamp: string;
};

function checkedTriggerObservation(observation: DirectionalTriggerObservation, symbol: string) {
  if (observation.symbol !== symbol) throw new Error("Monitor quote does not match the position market");
  const timestamp = Date.parse(observation.timestamp);
  const age = Date.now() - timestamp;
  if (!Number.isFinite(timestamp) || age < -5_000 || age > MAX_MARK_AGE_MS) {
    throw new Error("Monitor quote is no longer fresh; settlement cancelled");
  }
  return parsePositiveDecimal(observation.price, "Observed market price");
}

function nullableEq(actual: { eq: (x: string) => boolean } | null, wanted?: string | null) {
  return wanted == null || wanted === "" ? actual === null : !!actual?.eq(wanted);
}

function sameOpenRequest(position: DirectionalPosition, input: OpenDirectionalInput) {
  return position.userId === input.userId && position.walletId === input.walletId && position.symbol === input.symbol &&
    position.side === input.side && position.quantity.eq(input.quantity) &&
    nullableEq(position.stopLossPrice, input.stopLossPrice) &&
    nullableEq(position.takeProfitPrice, input.takeProfitPrice);
}

function existingResult(position: DirectionalPosition, input: OpenDirectionalInput): Result {
  if (!sameOpenRequest(position, input)) return { success: false, error: "Idempotency key reused for another position" };
  return { success: true, positionId: position.id, filledPrice: position.entryPrice.toString() };
}

function addLeg(legs: PostingLeg[], accountId: string, direction: "DEBIT" | "CREDIT", amount: Decimal, id: string, referenceType = REF) {
  if (amount.isZero()) return;
  assertSqlDecimal(amount, "Ledger amount");
  if (amount.lt(0)) throw new Error("Negative ledger posting amount");
  legs.push({ ledgerAccountId: accountId, direction, amount, assetSymbol: "USDT", referenceType, referenceId: id });
}

/**
 * Local development is enabled by default when no explicit flag exists.
 * An explicit true/false setting overrides that default; production stays off
 * unless DIRECTIONAL_TRADING_ENABLED=true is intentionally configured.
 * The existing global crypto-trading feature flag still applies.
 */
export function isDirectionalTradingEnabled(): boolean {
  const setting = process.env.DIRECTIONAL_TRADING_ENABLED;
  return CRYPTO_TRADING_ENABLED &&
    (setting === "true" || (setting === undefined && process.env.NODE_ENV === "development"));
}

export async function openDirectionalPosition(input: OpenDirectionalInput): Promise<Result> {
  if (!isDirectionalTradingEnabled()) {
    return { success: false, error: "Directional trading is disabled by configuration" };
  }
  try {
    validKey(input.idempotencyKey);
    if (typeof input.walletId !== "string" || !/^[a-zA-Z0-9_-]{8,100}$/.test(input.walletId)) {
      throw new Error("Invalid wallet selection");
    }
    if (input.side !== "LONG" && input.side !== "SHORT") throw new Error("Direction must be LONG or SHORT");
    if (!/^[A-Z0-9]{3,30}$/.test(input.symbol)) throw new Error("Invalid trading pair");
    const quantity = parsePositiveDecimal(input.quantity, "Quantity");
    const stop = input.stopLossPrice || null;
    const take = input.takeProfitPrice || null;
    const existing = await prisma.directionalPosition.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existingResult(existing, input);

    const instrument = (await getTradingInstruments({ symbol: input.symbol })).find((i) => i.symbol === input.symbol && i.status === "active");
    if (!instrument || instrument.quoteAsset !== "USDT") throw new Error("Only active USDT markets support directional positions");
    if (quantity.decimalPlaces() > instrument.quantityPrecision ||
        quantity.lt(instrument.minOrderQuantity) || quantity.gt(instrument.maxOrderQuantity)) {
      throw new Error("Invalid quantity for this instrument's limits or precision");
    }
    const entryPrice = await liveMark(input.symbol);
    const notional = assertSqlDecimal(calculateRequiredMargin({ entryPrice, quantity }), "Margin");
    if (notional.lt(instrument.minOrderValue) || notional.gt(instrument.maxOrderValue)) throw new Error("Notional outside instrument limits");
    const { stopLossPrice, takeProfitPrice } = validatePositionBracket({ direction: input.side, entryPrice, stopLossPrice: stop, takeProfitPrice: take });
    // Conditional prices must also respect this market's quoted increments.
    for (const [name, target] of [["Stop Loss", stopLossPrice], ["Take Profit", takeProfitPrice]] as const) {
      if (target !== null && (target.decimalPlaces() > instrument.pricePrecision ||
          !target.mod(instrument.tickSize).isZero())) {
        throw new Error(`${name} price does not match the market tick size`);
      }
    }
    const entryFee = assertSqlDecimal(calculateTradingFee({ price: entryPrice, quantity, feeRate: FEE_RATE }), "Entry fee");
    const required = assertSqlDecimal(notional.plus(entryFee), "Required USDT");

    return await serializableRetry(() => prisma.$transaction(async (tx) => {
      const retry = await tx.directionalPosition.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (retry) return existingResult(retry, input);
      const wallet = await tx.cryptoWallet.findFirst({ where: { id: input.walletId, userId: input.userId } });
      if (!wallet) throw new Error("Create a spot wallet before opening a directional position");
      const { balance, ledgerAccount } = await ensureAssetBalanceAndLedgerAccount(tx, wallet.id, "USDT");
      if (balance.available.lt(required)) throw new Error(`Insufficient available USDT. Need ${required.toString()}`);
      const reserved = await tx.assetBalance.updateMany({
        where: { id: balance.id, available: { gte: required } },
        data: { available: { decrement: required }, locked: { increment: notional } },
      });
      if (reserved.count !== 1) throw new Error("Available USDT changed; position not opened");
      const position = await tx.directionalPosition.create({ data: {
        userId: input.userId, walletId: wallet.id, symbol: input.symbol,
        side: input.side as DirectionalSide, quantity, entryPrice, margin: notional, entryFee,
        stopLossPrice, takeProfitPrice, idempotencyKey: input.idempotencyKey,
      } });
      const feePool = await getOrCreatePlatformLedgerAccount(tx, {
        type: "REVENUE", assetSymbol: "USDT", name: feeRevenuePoolName("USDT"),
      });
      // Locking margin is an intra-wallet restriction, not a ledger transfer.
      // Only the entry trading fee leaves the user's ledger account.
      const { groupId } = await postLedgerEntries(tx, [
        { ledgerAccountId: ledgerAccount.id, direction: "CREDIT", assetSymbol: "USDT", amount: entryFee, referenceType: REF, referenceId: position.id },
        { ledgerAccountId: feePool.id, direction: "DEBIT", assetSymbol: "USDT", amount: entryFee, referenceType: "DirectionalEntryFee", referenceId: position.id },
      ]);
      await tx.directionalPosition.update({ where: { id: position.id }, data: { openedLedgerGroupId: groupId } });
      await tx.transaction.create({ data: {
        userId: input.userId, type: "FEE", direction: "DEBIT", status: "COMPLETED",
        assetSymbol: "USDT", amount: entryFee, feeAmount: 0,
        referenceType: REF, referenceId: position.id, ledgerGroupId: groupId,
        narration: `1x ${input.side} ${input.symbol} entry fee`, isDemo: true,
      } });
      return { success: true, positionId: position.id, filledPrice: entryPrice.toString() };
    }, { isolationLevel: "Serializable", timeout: 15_000 }));
  } catch (error) {
    // Racy identical requests can collide on the unique key after an earlier commit.
    if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.directionalPosition.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existingResult(existing, input);
    }
    return fail(error);
  }
}

export async function closeDirectionalPosition(input: {
  userId?: string; positionId: string; idempotencyKey: string;
  reason: DirectionalCloseReason; // MANUAL or server-derived TP/SL/LIQUIDATION
  expectedSide?: DirectionalSide;
  expectedTrigger?: ExitReason | "LIQUIDATION";
  /** Server-side monitor observation ONLY. Never accept this from the browser. */
  observedTrigger?: DirectionalTriggerObservation;
}): Promise<Result> {
  // Never strand existing collateral merely because new position openings are disabled.
  try {
    validKey(input.idempotencyKey);
    // Manual closes must be authenticated. Automated closes must be triggered
    // by a trusted monitor observation, not by an arbitrary caller's reason.
    if (input.reason === "MANUAL") {
      if (!input.userId || input.observedTrigger) throw new Error("Manual close requires an authenticated user");
    } else if (input.userId || !input.observedTrigger) {
      throw new Error("Automatic close requires a server-side monitor observation");
    }
    const current = await prisma.directionalPosition.findUnique({ where: { id: input.positionId } });
    if (!current || (input.userId && current.userId !== input.userId)) throw new Error("Position not found");
    if (current.status === "CLOSED") return { success: true, positionId: current.id, filledPrice: current.closePrice?.toString() };
    const exitPrice = input.reason === "MANUAL"
      ? await liveMark(current.symbol)
      : checkedTriggerObservation(input.observedTrigger!, current.symbol);
    return await serializableRetry(() => prisma.$transaction(async (tx) => {
      const position = await tx.directionalPosition.findUnique({ where: { id: input.positionId } });
      if (!position || (input.userId && position.userId !== input.userId)) throw new Error("Position not found");
      if (position.status === "CLOSED") return { success: true, positionId: position.id, filledPrice: position.closePrice?.toString() };
      if (input.expectedSide && position.side !== input.expectedSide) throw new Error("Position direction changed");
      // Re-evaluate the signal against the SAME trusted quote that triggered
      // monitoring. Refetching can drop a real TP/SL signal during price spikes.
      // Manual closes use a freshly retrieved quote; if the position is already
      // insolvent, record its true liquidation reason for the audit trail.
      if (input.observedTrigger) checkedTriggerObservation(input.observedTrigger, position.symbol);
      const valuation = calculatePositionValue({ direction: position.side, entryPrice: position.entryPrice,
        currentPrice: exitPrice, quantity: position.quantity, collateral: position.margin,
        exitFeeRate: FEE_RATE, maintenanceMarginRate: "0.005" });
      const trigger = valuation.liquidatable ? "LIQUIDATION" : findTriggeredExit({
        direction: position.side, entryPrice: position.entryPrice, currentPrice: exitPrice,
        stopLossPrice: position.stopLossPrice, takeProfitPrice: position.takeProfitPrice,
      });
      if (input.reason !== "MANUAL" &&
          (!trigger || input.reason !== trigger || (input.expectedTrigger && trigger !== input.expectedTrigger))) {
        throw new Error("Position trigger was not active at the observed mark");
      }
      const effectiveCloseReason: DirectionalCloseReason =
        input.reason === "MANUAL" && valuation.liquidatable ? "LIQUIDATION" : input.reason;
      const settlement = calculateCloseSettlement({
        direction: position.side, entryPrice: position.entryPrice, exitPrice,
        quantity: position.quantity, margin: position.margin, entryFee: position.entryFee, exitFeeRate: FEE_RATE,
      });
      const updated = await tx.directionalPosition.updateMany({
        where: { id: position.id, status: "OPEN" },
        data: { status: "CLOSED", closePrice: exitPrice, closeReason: effectiveCloseReason,
          grossPnl: settlement.grossPnl, netPnl: settlement.netPnl, exitFee: settlement.exitFee,
          payout: settlement.payout, insuranceLoss: settlement.insuranceLoss,
          closeIdempotencyKey: input.idempotencyKey, closedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error("Position already closed concurrently");
      const { balance, ledgerAccount } = await ensureAssetBalanceAndLedgerAccount(tx, position.walletId, "USDT");
      const released = await tx.assetBalance.updateMany({
        where: { id: balance.id, locked: { gte: position.margin } },
        data: { locked: { decrement: position.margin }, available: { increment: settlement.payout } },
      });
      if (released.count !== 1) throw new Error("Collateral mismatch; closing rolled back");
      const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
        type: "ASSET", assetSymbol: "USDT", name: "Directional Trading Settlement (USDT)",
      });
      const feePool = await getOrCreatePlatformLedgerAccount(tx, {
        type: "REVENUE", assetSymbol: "USDT", name: feeRevenuePoolName("USDT"),
      });
      const riskPool = settlement.insuranceLoss.gt(0)
        ? await getOrCreatePlatformLedgerAccount(tx, {
            type: "ASSET", assetSymbol: "USDT", name: "Directional Insurance Reserve (USDT)",
          }) : null;
      const legs: PostingLeg[] = [];
      // Positive gross P&L is funded by the demo counterparty; negative is paid to it.
      const gross = settlement.grossPnl;
      addLeg(legs, settlementPool.id, gross.gt(0) ? "CREDIT" : "DEBIT", gross.abs(), position.id);
      const walletChange = settlement.payout.minus(position.margin);
      addLeg(legs, ledgerAccount.id, walletChange.gt(0) ? "DEBIT" : "CREDIT", walletChange.abs(), position.id);
      addLeg(legs, feePool.id, "DEBIT", settlement.exitFee, position.id, "DirectionalExitFee");
      if (riskPool) addLeg(legs, riskPool.id, "CREDIT", settlement.insuranceLoss, position.id, "DirectionalInsuranceLoss");
      let ledgerGroupId: string | null = null;
      if (legs.length > 0) {
        if (legs.length < 2) throw new Error("Unbalanced directional settlement");
        ledgerGroupId = (await postLedgerEntries(tx, legs)).groupId;
      }
      await tx.directionalPosition.update({ where: { id: position.id }, data: { closedLedgerGroupId: ledgerGroupId } });
      if (!walletChange.isZero()) {
        await tx.transaction.create({ data: {
          userId: position.userId, type: "TRADE", direction: walletChange.gt(0) ? "CREDIT" : "DEBIT", status: "COMPLETED",
          assetSymbol: "USDT", amount: walletChange.abs(), feeAmount: settlement.exitFee,
          referenceType: "DirectionalPositionClose", referenceId: position.id, ledgerGroupId,
          narration: `${position.side} ${position.symbol} closed: ${effectiveCloseReason}`, isDemo: true,
        } });
      }
      return { success: true, positionId: position.id, filledPrice: exitPrice.toString() };
    }, { isolationLevel: "Serializable", timeout: 15_000 }));
  } catch (error) { return fail(error); }
}

export function serializeDirectionalPosition(p: DirectionalPosition) {
  return {
    id: p.id, symbol: p.symbol, quoteAsset: p.quoteAsset, side: p.side, status: p.status,
    quantity: p.quantity.toString(), entryPrice: p.entryPrice.toString(), margin: p.margin.toString(),
    entryFee: p.entryFee.toString(), stopLossPrice: p.stopLossPrice?.toString() ?? null,
    takeProfitPrice: p.takeProfitPrice?.toString() ?? null, closePrice: p.closePrice?.toString() ?? null,
    closeReason: p.closeReason, grossPnl: p.grossPnl?.toString() ?? null, netPnl: p.netPnl?.toString() ?? null,
    exitFee: p.exitFee?.toString() ?? null, payout: p.payout?.toString() ?? null,
    insuranceLoss: p.insuranceLoss?.toString() ?? null,
    openedAt: p.openedAt.toISOString(), closedAt: p.closedAt?.toISOString() ?? null,
  };
}
