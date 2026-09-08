import "server-only";
import { prisma } from "@/lib/db/prisma";
import { maskAccountNumber, BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";
import { normalizeAccountNumberInput } from "@/lib/utilities/transfer-recipient";

export interface SafeRecipientLookupResult {
  status: "own_source" | "own_account" | "beneficiary" | "internal_account" | "not_found";
  accountId?: string;
  beneficiaryId?: string;
  displayName?: string;
  accountType?: string;
  currencySymbol?: string;
  maskedAccountNumber?: string;
  bankName?: string | null;
  isInternalPlt?: boolean;
}

/**
 * Sanitizer function that extracts ONLY safe public recipient verification data.
 * Guarantees that sensitive fields (email, phone, address, DOB, balanceCache, userId, transaction history)
 * are NEVER returned to the client.
 */
export function sanitizeRecipientData(params: {
  accountId: string;
  accountNumber: string;
  type: string;
  currencySymbol: string;
  fullName?: string | null;
  nickname?: string | null;
  bankName?: string | null;
  isInternalPlt?: boolean;
}): Omit<SafeRecipientLookupResult, "status"> {
  const accountType = BANK_ACCOUNT_TYPE_LABELS[params.type] ?? params.type;
  const displayName = params.fullName?.trim() || params.nickname?.trim() || "PLT Customer";

  return {
    accountId: params.accountId,
    displayName,
    accountType,
    currencySymbol: params.currencySymbol,
    maskedAccountNumber: maskAccountNumber(params.accountNumber),
    bankName: params.bankName ?? null,
    isInternalPlt: params.isInternalPlt ?? true,
  };
}

/**
 * Server-side lookup of a recipient PLT account number for an authenticated user.
 */
export async function lookupRecipientAccount(
  currentUserId: string,
  rawAccountNumber: string,
  sourceAccountId?: string
): Promise<SafeRecipientLookupResult> {
  const normalized = normalizeAccountNumberInput(rawAccountNumber);
  if (normalized.length < 4 || normalized.length > 34) {
    return { status: "not_found" };
  }

  // 1. Check if the account belongs to the authenticated sender
  const ownAccount = await prisma.bankAccount.findFirst({
    where: { userId: currentUserId, accountNumber: normalized },
  });

  if (ownAccount) {
    if (sourceAccountId && ownAccount.id === sourceAccountId) {
      return { status: "own_source" };
    }
    const safeData = sanitizeRecipientData({
      accountId: ownAccount.id,
      accountNumber: ownAccount.accountNumber,
      type: ownAccount.type,
      currencySymbol: ownAccount.currencySymbol,
      nickname: ownAccount.nickname,
      fullName: "Your Account",
      isInternalPlt: true,
    });
    return {
      status: "own_account",
      ...safeData,
    };
  }

  // 2. Check if it's already a saved beneficiary of the sender
  const beneficiary = await prisma.beneficiary.findFirst({
    where: { userId: currentUserId, accountNumber: normalized },
  });

  if (beneficiary) {
    let destAccount = null;
    if (beneficiary.type === "INTERNAL_PLT") {
      destAccount = await prisma.bankAccount.findUnique({
        where: { accountNumber: normalized },
      });
    }
    const safeData = sanitizeRecipientData({
      accountId: destAccount?.id ?? beneficiary.id,
      accountNumber: beneficiary.accountNumber,
      type: destAccount?.type ?? "CURRENT",
      currencySymbol: destAccount?.currencySymbol ?? "USD",
      nickname: beneficiary.nickname,
      fullName: beneficiary.accountName,
      bankName: beneficiary.bankName,
      isInternalPlt: beneficiary.type === "INTERNAL_PLT",
    });
    return {
      status: "beneficiary",
      beneficiaryId: beneficiary.id,
      ...safeData,
    };
  }

  // 3. Look up any valid, active internal PLT bank account
  const internalAccount = await prisma.bankAccount.findUnique({
    where: { accountNumber: normalized },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (internalAccount) {
    const safeData = sanitizeRecipientData({
      accountId: internalAccount.id,
      accountNumber: internalAccount.accountNumber,
      type: internalAccount.type,
      currencySymbol: internalAccount.currencySymbol,
      fullName: internalAccount.user.profile?.fullName,
      nickname: internalAccount.nickname,
      isInternalPlt: true,
    });
    return {
      status: "internal_account",
      ...safeData,
    };
  }

  // 4. Return generic not_found status
  return { status: "not_found" };
}
