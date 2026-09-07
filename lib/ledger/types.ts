import type { Decimal } from "decimal.js";

export type LedgerDirection = "DEBIT" | "CREDIT";

/**
 * One leg of an atomic ledger posting. A complete posting is an array of
 * these legs where, for every assetSymbol present, the sum of DEBIT
 * amounts equals the sum of CREDIT amounts.
 */
export interface PostingLeg {
  ledgerAccountId: string;
  direction: LedgerDirection;
  assetSymbol: string;
  amount: Decimal.Value;
  /** e.g. "Transfer", "CryptoOrder", "Conversion", "Deposit", "Withdrawal" */
  referenceType: string;
  referenceId: string;
}

export interface PostLedgerEntriesResult {
  groupId: string;
}
