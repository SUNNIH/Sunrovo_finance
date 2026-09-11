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

const LEGACY_DEFAULT_NICKNAME_DISPLAY: Record<string, string> = {
  "PLT Current Account": "FHT Current Account",
  "PLT Savings Account": "FHT Savings Account",
};

/**
 * Formats only the two historical system-provisioned bank nicknames for
 * display. The stored nickname remains unchanged and all other custom
 * nicknames are preserved.
 */
export function accountNicknameForDisplay(
  nickname: string | null | undefined
): string | undefined {
  if (!nickname) return undefined;

  return LEGACY_DEFAULT_NICKNAME_DISPLAY[nickname] ?? (nickname.trim() || undefined);
}

export function accountDisplayName(
  nickname: string | null | undefined,
  accountType: string
): string {
  const cleanNickname = accountNicknameForDisplay(nickname);

  if (cleanNickname) {
    return cleanNickname;
  }

  return BANK_ACCOUNT_TYPE_LABELS[accountType] ?? accountType;
}
