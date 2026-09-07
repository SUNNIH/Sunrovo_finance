import Decimal from "decimal.js";

export interface WithdrawalAmounts {
  amount: string;
  fee: string;
  totalDebit: string;
}

/**
 * Canonicalises a withdrawal before it is persisted or posted. Rejecting
 * excess precision is safer than silently rounding a customer's request.
 */
export function calculateWithdrawalAmounts(
  requestedAmount: string,
  feeRate: Decimal.Value,
  precision: number
): WithdrawalAmounts {
  const amount = new Decimal(requestedAmount);
  if (!amount.isFinite() || !amount.gt(0)) throw new Error("Withdrawal amount must be positive.");
  if (amount.decimalPlaces() > precision) throw new Error(`Amount supports at most ${precision} decimal places.`);

  const canonicalAmount = amount.toFixed(precision);
  const fee = amount.mul(feeRate).toFixed(precision, Decimal.ROUND_HALF_UP);
  return {
    amount: canonicalAmount,
    fee,
    totalDebit: amount.add(fee).toFixed(precision, Decimal.ROUND_HALF_UP),
  };
}

/**
 * Reproduces the cache debit used by the pre-hardening withdrawal flow as
 * well as the canonical current flow. This restores a rejected withdrawal
 * exactly, including legacy rows that contain excess amount precision.
 */
export function calculateWithdrawalRefund(amount: Decimal.Value, fee: Decimal.Value, precision: number): string {
  return new Decimal(amount).add(fee).toFixed(precision, Decimal.ROUND_HALF_UP);
}
