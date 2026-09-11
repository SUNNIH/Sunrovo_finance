import { accountDisplayName, maskAccountNumber } from "@/lib/utilities/format-account";

export interface TransferAccountOption {
  id: string;
  nickname: string | null;
  type: string;
  accountNumber: string;
  currencySymbol: string;
  balanceCache: string;
}

export interface TransferBeneficiaryOption {
  id: string;
  type: "INTERNAL_PLT" | "EXTERNAL_BANK";
  nickname: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  isFavorite: boolean;
}

export type AuthorizedRecipientMatch =
  | { status: "incomplete" }
  | { status: "none" }
  | { status: "own_source" }
  | {
      status: "own_account";
      account: TransferAccountOption;
      label: string;
      maskedNumber: string;
    }
  | {
      status: "beneficiary";
      beneficiary: TransferBeneficiaryOption;
      label: string;
      maskedNumber: string;
    };

export function normalizeAccountNumberInput(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

/**
 * Resolves a typed FHT account number against destinations the user is
 * already authorized to send to (owned accounts and saved beneficiaries).
 * Does not look up unknown third-party accounts.
 */
export function resolveAuthorizedRecipient(
  rawNumber: string,
  sourceAccountId: string | undefined,
  accounts: TransferAccountOption[],
  beneficiaries: TransferBeneficiaryOption[]
): AuthorizedRecipientMatch {
  const accountNumber = normalizeAccountNumberInput(rawNumber);
  if (accountNumber.length < 4) {
    return { status: "incomplete" };
  }

  const ownMatches = accounts.filter((account) => account.accountNumber === accountNumber);
  if (ownMatches.length === 1) {
    const account = ownMatches[0]!;
    if (account.id === sourceAccountId) {
      return { status: "own_source" };
    }
    return {
      status: "own_account",
      account,
      label: accountDisplayName(account.nickname, account.type),
      maskedNumber: maskAccountNumber(account.accountNumber),
    };
  }

  const beneficiaryMatches = beneficiaries.filter(
    (beneficiary) => beneficiary.accountNumber === accountNumber
  );
  if (beneficiaryMatches.length === 1) {
    const beneficiary = beneficiaryMatches[0]!;
    return {
      status: "beneficiary",
      beneficiary,
      label: beneficiary.nickname,
      maskedNumber: maskAccountNumber(beneficiary.accountNumber),
    };
  }

  return { status: "none" };
}
