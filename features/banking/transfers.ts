import "server-only";
import { prisma } from "@/lib/db/prisma";
import { Money } from "@/lib/money/money";
import { getAssetPrecision } from "@/lib/money/format";
import { postLedgerEntries } from "@/lib/ledger/postLedgerEntries";
import type { PostingLeg } from "@/lib/ledger/types";
import { getOrCreatePlatformLedgerAccount, externalSettlementPoolName, feeRevenuePoolName } from "@/lib/ledger/platform-accounts";
import { verifyTransactionPin } from "@/lib/auth/transaction-pin";
import { withIdempotentFallback } from "@/lib/ledger/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import type { RequestMeta } from "@/lib/auth/session";
import type { TransferInput } from "@/lib/validation/banking";
import { computeTransferFee } from "./transfer-pricing";
import { getOwnedAccountOrThrow } from "./accounts";
import { AuthError } from "@/features/authentication/errors";

interface ResolvedDestination {
  kind: "own_account" | "internal_beneficiary" | "external_beneficiary";
  label: string;
  beneficiaryId?: string;
  destinationBankAccount?: { id: string; userId: string; nickname: string | null };
}

async function resolveDestination(
  userId: string,
  sourceAccount: { id: string; currencySymbol: string },
  destination: TransferInput["destination"]
): Promise<ResolvedDestination> {
  if (destination.kind === "own_account") {
    const dest = await getOwnedAccountOrThrow(userId, destination.destinationAccountId);
    if (dest.id === sourceAccount.id) {
      throw new AuthError("SAME_ACCOUNT", "Choose a different destination account.", 422);
    }
    if (dest.currencySymbol !== sourceAccount.currencySymbol) {
      throw new AuthError("CURRENCY_MISMATCH", "Transfers between your own accounts must use the same currency.", 422);
    }
    return {
      kind: "own_account",
      label: dest.nickname ?? "Your account",
      destinationBankAccount: { id: dest.id, userId: dest.userId, nickname: dest.nickname },
    };
  }

  const beneficiary = await prisma.beneficiary.findUnique({ where: { id: destination.beneficiaryId } });
  if (!beneficiary || beneficiary.userId !== userId) {
    throw new AuthError("BENEFICIARY_NOT_FOUND", "Beneficiary not found.", 404);
  }

  if (beneficiary.type === "INTERNAL_PLT") {
    const dest = await prisma.bankAccount.findUnique({ where: { accountNumber: beneficiary.accountNumber } });
    if (!dest) {
      throw new AuthError("ACCOUNT_NOT_FOUND", "The destination PLT account could not be found.", 404);
    }
    if (dest.currencySymbol !== sourceAccount.currencySymbol) {
      throw new AuthError("CURRENCY_MISMATCH", "This beneficiary's account uses a different currency.", 422);
    }
    return {
      kind: "internal_beneficiary",
      label: beneficiary.nickname,
      beneficiaryId: beneficiary.id,
      destinationBankAccount: { id: dest.id, userId: dest.userId, nickname: dest.nickname },
    };
  }

  return { kind: "external_beneficiary", label: beneficiary.nickname, beneficiaryId: beneficiary.id };
}

export function computeFee(resolved: ResolvedDestination, currency: string): Money {
  return computeTransferFee(resolved.kind, currency);
}

export interface TransferPreview {
  destinationLabel: string;
  currency: string;
  amount: string;
  fee: string;
  totalDebit: string;
  resultingBalance: string;
  sufficientFunds: boolean;
}

export async function previewTransfer(
  userId: string,
  input: Pick<TransferInput, "sourceAccountId" | "destination" | "amount">
): Promise<TransferPreview> {
  const sourceAccount = await getOwnedAccountOrThrow(userId, input.sourceAccountId);
  const resolved = await resolveDestination(userId, sourceAccount, input.destination);
  const precision = getAssetPrecision(sourceAccount.currencySymbol);

  const amountMoney = Money.fromString(input.amount, sourceAccount.currencySymbol);
  const fee = computeFee(resolved, sourceAccount.currencySymbol);
  const totalDebit = amountMoney.add(fee);
  const currentBalance = Money.fromDecimalLike(sourceAccount.balanceCache.toString(), sourceAccount.currencySymbol);
  const resultingBalance = currentBalance.subtract(totalDebit);

  return {
    destinationLabel: resolved.label,
    currency: sourceAccount.currencySymbol,
    amount: amountMoney.toFixed(precision),
    fee: fee.toFixed(precision),
    totalDebit: totalDebit.toFixed(precision),
    resultingBalance: resultingBalance.toFixed(precision),
    sufficientFunds: !resultingBalance.isNegative(),
  };
}

export async function createTransfer(
  userId: string,
  input: TransferInput,
  idempotencyKey: string,
  meta: RequestMeta
) {
  // Namespace the client-supplied key per user so one user can never
  // collide with (or replay) another user's idempotency key.
  const namespacedKey = `${userId}:${idempotencyKey}`;

  const existing = await prisma.transfer.findUnique({ where: { idempotencyKey: namespacedKey } });
  if (existing) return existing;

  const [user, security] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.securitySetting.findUnique({ where: { userId } }),
  ]);
  if (!user || !security?.transactionPinHash) {
    throw new AuthError("PIN_NOT_SET", "Set a transaction PIN in Security before making a transfer.", 400);
  }
  if (!(await verifyTransactionPin(security.transactionPinHash, input.transactionPin))) {
    throw new AuthError("INVALID_PIN", "That transaction PIN is incorrect.", 401);
  }

  const sourceAccount = await getOwnedAccountOrThrow(userId, input.sourceAccountId);
  const resolved = await resolveDestination(userId, sourceAccount, input.destination);
  const currency = sourceAccount.currencySymbol;
  const precision = getAssetPrecision(currency);

  const amountMoney = Money.fromString(input.amount, currency);
  const fee = computeFee(resolved, currency);
  const totalDebit = amountMoney.add(fee);
  const currentBalance = Money.fromDecimalLike(sourceAccount.balanceCache.toString(), currency);

  if (currentBalance.isLessThan(totalDebit)) {
    throw new AuthError(
      "INSUFFICIENT_FUNDS",
      "Your available balance is lower than the amount required for this transaction.",
      422
    );
  }

  const result = await withIdempotentFallback(
    () =>
      prisma.$transaction(async (tx) => {
        const transfer = await tx.transfer.create({
          data: {
            userId,
            sourceAccountId: sourceAccount.id,
            beneficiaryId: resolved.beneficiaryId,
            currencySymbol: currency,
            amount: amountMoney.toFixed(precision),
            feeAmount: fee.toFixed(precision),
            narration: input.narration,
            status: "COMPLETED",
            idempotencyKey: namespacedKey,
          },
        });

        const sourceLedgerAccount = await tx.ledgerAccount.findUnique({
          where: { bankAccountId: sourceAccount.id },
        });
        if (!sourceLedgerAccount) {
          throw new Error(`Source account ${sourceAccount.id} has no ledger account`);
        }

        const legs: PostingLeg[] = [
          {
            ledgerAccountId: sourceLedgerAccount.id,
            direction: "DEBIT" as const,
            assetSymbol: currency,
            amount: amountMoney.toDecimalString(),
            referenceType: "Transfer",
            referenceId: transfer.id,
          },
        ];

        if (resolved.kind !== "external_beneficiary") {
          const destLedgerAccount = await tx.ledgerAccount.findUnique({
            where: { bankAccountId: resolved.destinationBankAccount!.id },
          });
          if (!destLedgerAccount) {
            throw new Error(`Destination account ${resolved.destinationBankAccount!.id} has no ledger account`);
          }
          legs.push({
            ledgerAccountId: destLedgerAccount.id,
            direction: "CREDIT" as const,
            assetSymbol: currency,
            amount: amountMoney.toDecimalString(),
            referenceType: "Transfer",
            referenceId: transfer.id,
          });
        } else {
          const settlementPool = await getOrCreatePlatformLedgerAccount(tx, {
            type: "EQUITY",
            assetSymbol: currency,
            name: externalSettlementPoolName(currency),
          });
          legs.push({
            ledgerAccountId: settlementPool.id,
            direction: "CREDIT" as const,
            assetSymbol: currency,
            amount: amountMoney.toDecimalString(),
            referenceType: "Transfer",
            referenceId: transfer.id,
          });
        }

        if (!fee.isZero()) {
          const feePool = await getOrCreatePlatformLedgerAccount(tx, {
            type: "REVENUE",
            assetSymbol: currency,
            name: feeRevenuePoolName(currency),
          });
          legs.push(
            {
              ledgerAccountId: sourceLedgerAccount.id,
              direction: "DEBIT" as const,
              assetSymbol: currency,
              amount: fee.toDecimalString(),
              referenceType: "Transfer",
              referenceId: transfer.id,
            },
            {
              ledgerAccountId: feePool.id,
              direction: "CREDIT" as const,
              assetSymbol: currency,
              amount: fee.toDecimalString(),
              referenceType: "Transfer",
              referenceId: transfer.id,
            }
          );
        }

        const { groupId } = await postLedgerEntries(tx, legs);

        const debited = await tx.bankAccount.updateMany({
          where: { id: sourceAccount.id, balanceCache: { gte: totalDebit.toFixed(precision) } },
          data: { balanceCache: { decrement: totalDebit.toFixed(precision) } },
        });
        if (debited.count !== 1) {
          throw new AuthError(
            "INSUFFICIENT_FUNDS",
            "Your available balance is lower than the amount required for this transaction.",
            422
          );
        }

        const isSelfTransfer = resolved.destinationBankAccount?.userId === userId;
        if (resolved.kind !== "external_beneficiary") {
          await tx.bankAccount.update({
            where: { id: resolved.destinationBankAccount!.id },
            data: { balanceCache: { increment: amountMoney.toFixed(precision) } },
          });
        }

        await tx.transfer.update({ where: { id: transfer.id }, data: { ledgerGroupId: groupId } });

        await tx.transaction.create({
          data: {
            userId,
            type: "TRANSFER",
            direction: "DEBIT",
            status: "COMPLETED",
            assetSymbol: currency,
            amount: amountMoney.toFixed(precision),
            feeAmount: fee.toFixed(precision),
            counterparty: resolved.label,
            narration: input.narration,
            referenceType: "Transfer",
            referenceId: transfer.id,
            ledgerGroupId: groupId,
            isDemo: true,
            transferId: transfer.id,
          },
        });

        if (resolved.kind !== "external_beneficiary" && !isSelfTransfer) {
          await tx.transaction.create({
            data: {
              userId: resolved.destinationBankAccount!.userId,
              type: "TRANSFER",
              direction: "CREDIT",
              status: "COMPLETED",
              assetSymbol: currency,
              amount: amountMoney.toFixed(precision),
              counterparty: sourceAccount.nickname ?? "PLT transfer",
              narration: input.narration,
              referenceType: "Transfer",
              referenceId: transfer.id,
              ledgerGroupId: groupId,
              isDemo: true,
              transferId: transfer.id,
            },
          });

          await tx.notification.create({
            data: {
              userId: resolved.destinationBankAccount!.userId,
              type: "TRANSACTION",
              title: "Money received",
              body: `You received ${amountMoney.toFixed(precision)} ${currency} via a PLT transfer.`,
            },
          });
        } else if (resolved.kind !== "external_beneficiary" && isSelfTransfer) {
          await tx.transaction.create({
            data: {
              userId,
              type: "TRANSFER",
              direction: "CREDIT",
              status: "COMPLETED",
              assetSymbol: currency,
              amount: amountMoney.toFixed(precision),
              counterparty: sourceAccount.nickname ?? "Your account",
              narration: input.narration,
              referenceType: "Transfer",
              referenceId: transfer.id,
              ledgerGroupId: groupId,
              isDemo: true,
              transferId: transfer.id,
            },
          });
        }

        return transfer;
      }),
    () => prisma.transfer.findUnique({ where: { idempotencyKey: namespacedKey } })
  );

  if (!result) {
    throw new Error("Transfer could not be created or recovered after a duplicate-key conflict.");
  }

  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: "transfer.create",
    targetType: "Transfer",
    targetId: result.id,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { destinationKind: resolved.kind, currency },
  });

  return result;
}
