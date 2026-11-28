/**
 * Sunrovo Finance — simulated directional-position calculations.
 *
 * This module is intentionally separate from the spot CryptoOrder engine.
 * LONG and SHORT here represent synthetic, collateralised demo positions;
 * a SHORT is NOT a sale of cryptocurrency from the customer's spot wallet.
 *
 * This file performs calculations only. It does not open positions, settle
 * assets, reserve collateral, post to the ledger, or execute OCO orders.
 * Those actions require their own transactional, idempotent services.
 */

import Decimal from "decimal.js";

// Keep enough significant digits for multiplying NUMERIC(36,18) inputs.
// Do not change global Decimal settings used by the existing spot engine.
export const PreciseDecimal = Decimal.clone({ precision: 72, rounding: Decimal.ROUND_HALF_UP });

export type PositionDirection = "LONG" | "SHORT";
export type ExitReason = "TAKE_PROFIT" | "STOP_LOSS";

export type DecimalInput = Decimal.Value;

export type BracketInput = {
  direction: PositionDirection;
  entryPrice: DecimalInput;
  stopLossPrice?: DecimalInput | null;
  takeProfitPrice?: DecimalInput | null;
};

export type Bracket = {
  stopLossPrice: Decimal | null;
  takeProfitPrice: Decimal | null;
};

export type PositionValueInput = {
  direction: PositionDirection;
  entryPrice: DecimalInput;
  currentPrice: DecimalInput;
  quantity: DecimalInput;
  /** Quote asset collateral already reserved for this position. */
  collateral: DecimalInput;
  /** E.g. 0.001 for 0.1%. */
  exitFeeRate: DecimalInput;
  /** E.g. 0.005 for 0.5% maintenance margin. */
  maintenanceMarginRate: DecimalInput;
};

export type PositionValue = {
  entryNotional: Decimal;
  currentNotional: Decimal;
  collateral: Decimal;
  unrealizedPnl: Decimal;
  estimatedExitFee: Decimal;
  equity: Decimal;
  maintenanceMargin: Decimal;
  liquidatable: boolean;
};

const SCALE = 18;

/**
 * User-provided quantities, prices and rates must fit the database's
 * NUMERIC(36,18) fractional precision, before any derived calculations.
 */
function decimal(value: DecimalInput, name: string, allowZero: boolean): Decimal {
  let result: Decimal;
  try {
    result = new PreciseDecimal(value);
  } catch {
    throw new Error(`${name} must be a valid decimal`);
  }

  if (
    !result.isFinite() ||
    result.isNegative() ||
    (!allowZero && result.isZero()) ||
    result.decimalPlaces() > SCALE
  ) {
    throw new Error(`${name} must be ${allowZero ? "non-negative" : "positive"} with at most 18 decimal places`);
  }
  return result;
}

function optionalPrice(value: DecimalInput | null | undefined, name: string): Decimal | null {
  return value === null || value === undefined
    ? null
    : decimal(value, name, false);
}

function directionFactor(direction: PositionDirection): Decimal {
  if (direction === "LONG") return new PreciseDecimal(1);
  if (direction === "SHORT") return new PreciseDecimal(-1);
  throw new Error("Position direction must be LONG or SHORT");
}

/**
 * A LONG takes profit above entry and stops below entry; a SHORT reverses
 * those comparisons. At least one protection can be required by the caller.
 */
export function validatePositionBracket(input: BracketInput): Bracket {
  const entry = decimal(input.entryPrice, "Entry price", false);
  const stop = optionalPrice(input.stopLossPrice, "Stop Loss price");
  const take = optionalPrice(input.takeProfitPrice, "Take Profit price");
  directionFactor(input.direction);

  if (input.direction === "LONG") {
    if (stop !== null && !stop.lt(entry)) {
      throw new Error("LONG Stop Loss must be below the entry price");
    }
    if (take !== null && !take.gt(entry)) {
      throw new Error("LONG Take Profit must be above the entry price");
    }
  } else {
    if (stop !== null && !stop.gt(entry)) {
      throw new Error("SHORT Stop Loss must be above the entry price");
    }
    if (take !== null && !take.lt(entry)) {
      throw new Error("SHORT Take Profit must be below the entry price");
    }
  }

  return { stopLossPrice: stop, takeProfitPrice: take };
}

/** Returns which exit is triggered, if any. No database state is changed. */
export function findTriggeredExit(
  input: BracketInput & { currentPrice: DecimalInput },
): ExitReason | null {
  const { stopLossPrice, takeProfitPrice } = validatePositionBracket(input);
  const current = decimal(input.currentPrice, "Current price", false);

  if (input.direction === "LONG") {
    if (stopLossPrice !== null && current.lte(stopLossPrice)) return "STOP_LOSS";
    if (takeProfitPrice !== null && current.gte(takeProfitPrice)) return "TAKE_PROFIT";
  } else {
    if (stopLossPrice !== null && current.gte(stopLossPrice)) return "STOP_LOSS";
    if (takeProfitPrice !== null && current.lte(takeProfitPrice)) return "TAKE_PROFIT";
  }

  return null;
}

/**
 * Gross unrealized or realized P&L in the quote asset, before trading fees.
 * The price difference is never converted to a JavaScript number.
 */
export function calculateGrossPnl(input: {
  direction: PositionDirection;
  entryPrice: DecimalInput;
  exitPrice: DecimalInput;
  quantity: DecimalInput;
}): Decimal {
  const entry = decimal(input.entryPrice, "Entry price", false);
  const exit = decimal(input.exitPrice, "Exit price", false);
  const quantity = decimal(input.quantity, "Quantity", false);

  return exit.minus(entry)
    .mul(quantity)
    .mul(directionFactor(input.direction))
    .toDecimalPlaces(SCALE, Decimal.ROUND_HALF_UP);
}

/**
 * Debits (including collateral requirements and fees) round UP to 18 dp,
 * so rounding cannot under-reserve or undercharge amounts.
 */
export function calculateRequiredMargin(input: {
  entryPrice: DecimalInput;
  quantity: DecimalInput;
  leverage?: DecimalInput;
}): Decimal {
  const price = decimal(input.entryPrice, "Entry price", false);
  const quantity = decimal(input.quantity, "Quantity", false);
  const leverage = decimal(input.leverage ?? 1, "Leverage", false);
  if (!leverage.eq(1)) {
    throw new Error("Only isolated 1x positions are currently supported");
  }
  return price.mul(quantity).toDecimalPlaces(SCALE, Decimal.ROUND_UP);
}

export function calculateTradingFee(input: {
  price: DecimalInput;
  quantity: DecimalInput;
  feeRate: DecimalInput;
}): Decimal {
  const price = decimal(input.price, "Price", false);
  const quantity = decimal(input.quantity, "Quantity", false);
  const rate = decimal(input.feeRate, "Fee rate", true);
  if (rate.gte(1)) throw new Error("Fee rate must be less than one");
  return price.mul(quantity).mul(rate).toDecimalPlaces(SCALE, Decimal.ROUND_UP);
}

/**
 * Snapshot for display and liquidation decisions, not a settlement instruction.
 * Short losses can exceed collateral if the market gaps; the close service
 * caps user losses at reserved collateral and posts any deficit to an internal
 * demo insurance account. The user's wallet must never become negative.
 */
export function calculatePositionValue(input: PositionValueInput): PositionValue {
  const entry = decimal(input.entryPrice, "Entry price", false);
  const current = decimal(input.currentPrice, "Current price", false);
  const quantity = decimal(input.quantity, "Quantity", false);
  const collateral = decimal(input.collateral, "Collateral", true);
  const maintenanceRate = decimal(input.maintenanceMarginRate, "Maintenance rate", true);
  if (maintenanceRate.gte(1)) {
    throw new Error("Maintenance rate must be less than one");
  }

  const entryNotional = entry.mul(quantity).toDecimalPlaces(SCALE, Decimal.ROUND_UP);
  const currentNotional = current.mul(quantity).toDecimalPlaces(SCALE, Decimal.ROUND_UP);
  const unrealizedPnl = calculateGrossPnl({
    direction: input.direction,
    entryPrice: entry,
    exitPrice: current,
    quantity,
  });
  const estimatedExitFee = calculateTradingFee({
    price: current,
    quantity,
    feeRate: input.exitFeeRate,
  });
  const equity = collateral.plus(unrealizedPnl).minus(estimatedExitFee)
    .toDecimalPlaces(SCALE, Decimal.ROUND_HALF_UP);
  const maintenanceMargin = current.mul(quantity).mul(maintenanceRate)
    .toDecimalPlaces(SCALE, Decimal.ROUND_UP);

  return {
    entryNotional,
    currentNotional,
    collateral,
    unrealizedPnl,
    estimatedExitFee,
    equity,
    maintenanceMargin,
    liquidatable: equity.lte(maintenanceMargin),
  };
}

/** Protect every derived amount before persisting to NUMERIC(36,18). */
export function assertSqlDecimal(amount: Decimal, label: string): Decimal {
  if (!amount.isFinite() || amount.decimalPlaces() > SCALE || amount.abs().gte(new PreciseDecimal("1000000000000000000"))) {
    throw new Error(`${label} exceeds database decimal limits`);
  }
  return amount;
}

/** Validate user-supplied finite positive numeric strings, without JS floats. */
export function parsePositiveDecimal(input: DecimalInput, label: string): Decimal {
  return assertSqlDecimal(decimal(input, label, false), label);
}

/** Cash-constrained isolated collateral settlement in quote currency. */
export function calculateCloseSettlement(input: {
  direction: PositionDirection;
  entryPrice: DecimalInput;
  exitPrice: DecimalInput;
  quantity: DecimalInput;
  margin: DecimalInput;
  entryFee: DecimalInput;
  exitFeeRate: DecimalInput;
}) {
  const margin = decimal(input.margin, "Margin", false);
  const entryFee = decimal(input.entryFee, "Entry fee", true);
  const grossPnl = calculateGrossPnl(input);
  const requestedExitFee = calculateTradingFee({
    price: input.exitPrice, quantity: input.quantity, feeRate: input.exitFeeRate,
  });
  const collateralWithPnl = margin.plus(grossPnl);
  // Fees can only be collected from equity actually available at close.
  const exitFee = PreciseDecimal.min(requestedExitFee, PreciseDecimal.max(0, collateralWithPnl));
  const payout = PreciseDecimal.max(0, collateralWithPnl.minus(exitFee));
  // A gap beyond isolated collateral is explicitly borne by the demo insurance pool.
  const insuranceLoss = PreciseDecimal.max(0, collateralWithPnl.negated());
  const netPnl = payout.minus(margin).minus(entryFee);
  for (const [name, amount] of Object.entries({ grossPnl, exitFee, payout, insuranceLoss, netPnl })) {
    assertSqlDecimal(amount, name);
  }
  return { grossPnl, exitFee, payout, insuranceLoss, netPnl };
}
