/** Masks all but the last 4 digits, e.g. "1234567890" -> "•••• 7890". */
export function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `•••• ${last4}`;
}

export const BANK_ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CURRENT: "Current Account",
  SAVINGS: "Savings Account",
  FOREIGN_CURRENCY: "Foreign Currency Account",
  FIXED_DEPOSIT: "Fixed Deposit",
};

export function accountDisplayName(
  nickname: string | null | undefined,
  accountType: string
): string {
  const cleanNickname = nickname?.trim();

  if (cleanNickname) {
    return cleanNickname;
  }

  return BANK_ACCOUNT_TYPE_LABELS[accountType] ?? accountType;
}