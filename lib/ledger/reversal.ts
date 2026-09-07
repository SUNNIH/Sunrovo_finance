import type { PostingLeg } from "./types";

export interface OriginalLedgerLeg {
  ledgerAccountId: string;
  direction: "DEBIT" | "CREDIT";
  assetSymbol: string;
  amount: string;
}

/**
 * Builds a separate, balanced inverse of a persisted posting. Callers retain
 * the original group unchanged and use their own reference for the reversal.
 */
export function invertLedgerPosting(
  legs: readonly OriginalLedgerLeg[],
  referenceType: string,
  referenceId: string
): PostingLeg[] {
  return legs.map((leg) => ({
    ledgerAccountId: leg.ledgerAccountId,
    direction: leg.direction === "DEBIT" ? "CREDIT" : "DEBIT",
    assetSymbol: leg.assetSymbol,
    amount: leg.amount,
    referenceType,
    referenceId,
  }));
}
