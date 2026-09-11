const SYSTEM_TRANSACTION_TEXT: Record<string, string> = {
  "Demo funding": "Account credit",
  "Simulated fiat deposit": "Account credit",
  "Simulated on-chain deposit": "Crypto deposit",
  "Simulated withdrawal": "Withdrawal",
  "Simulated withdrawal approved by review": "Withdrawal approved",
};

/**
 * Converts only known system-generated environment labels for presentation.
 * It never mutates persisted transaction counterparty or narration values.
 */
export function transactionTextForDisplay(value: string | null): string | null {
  if (value === null) return null;

  if (SYSTEM_TRANSACTION_TEXT[value]) {
    return SYSTEM_TRANSACTION_TEXT[value];
  }

  if (/^Simulated deposit via .+$/.test(value)) return "Crypto deposit";
  if (/^Simulated market (buy|sell) of .+$/.test(value)) return "Market trade";
  if (/^Simulated limit (buy|sell) of .+ filled$/.test(value)) return "Limit trade";

  return value;
}
