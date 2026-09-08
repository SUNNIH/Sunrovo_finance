import { z } from "zod";
import Decimal from "decimal.js";

function isPositiveDecimalString(value: string): boolean {
  try {
    return new Decimal(value).gt(0);
  } catch {
    return false;
  }
}

export const amountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine(isPositiveDecimalString, "Enter an amount greater than zero");

export const transferSchema = z.object({
  sourceAccountId: z.string().min(1, "Select a source account"),
  destination: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("own_account"), destinationAccountId: z.string().min(1) }),
    z.object({ kind: z.literal("beneficiary"), beneficiaryId: z.string().min(1) }),
    z.object({ kind: z.literal("internal_account"), destinationAccountId: z.string().min(1) }),
  ]),
  amount: amountSchema,
  narration: z.string().trim().max(140).optional(),
  transactionPin: z.string().regex(/^\d{4,6}$/, "Enter your 4-6 digit transaction PIN"),
});
export type TransferInput = z.infer<typeof transferSchema>;

export const transferPreviewSchema = transferSchema.omit({ transactionPin: true, narration: true });
export type TransferPreviewInput = z.infer<typeof transferPreviewSchema>;

export const recipientLookupSchema = z.object({
  accountNumber: z.string().trim().min(4, "Enter an account number with at least 4 digits").max(34),
  sourceAccountId: z.string().optional(),
});
export type RecipientLookupInput = z.infer<typeof recipientLookupSchema>;

export const BENEFICIARY_TYPES = ["INTERNAL_PLT", "EXTERNAL_BANK"] as const;

export const beneficiaryCreateSchema = z.object({
  type: z.enum(BENEFICIARY_TYPES),
  nickname: z.string().trim().min(1, "Enter a nickname").max(60),
  accountName: z.string().trim().min(1, "Enter the recipient's account name").max(120),
  accountNumber: z.string().trim().min(4, "Enter a valid account number").max(34),
  bankName: z.string().trim().max(120).optional(),
  // Step-up authentication (security memory: "Require step-up
  // authentication before adding or changing a beneficiary"). Editing a
  // nickname or toggling favourite on an already-vetted beneficiary
  // (beneficiaryUpdateSchema, below) is low-risk and does not re-prompt;
  // adding a brand-new payment destination is the sensitive action.
  currentPassword: z.string().min(1, "Enter your current password to confirm"),
});
export type BeneficiaryCreateInput = z.infer<typeof beneficiaryCreateSchema>;

export const beneficiaryUpdateSchema = z.object({
  nickname: z.string().trim().min(1).max(60).optional(),
  isFavorite: z.boolean().optional(),
});
export type BeneficiaryUpdateInput = z.infer<typeof beneficiaryUpdateSchema>;

export const setTransactionPinSchema = z
  .object({
    pin: z.string().regex(/^\d{4,6}$/, "PIN must be 4-6 digits"),
    confirmPin: z.string(),
    currentPassword: z.string().min(1, "Enter your current password"),
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });
export type SetTransactionPinInput = z.infer<typeof setTransactionPinSchema>;

export const TRANSACTION_TYPES = [
  "TRANSFER", "DEPOSIT", "WITHDRAWAL", "TRADE", "CONVERSION", "FEE", "CARD_PAYMENT",
] as const;
export const TRANSACTION_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REVERSED"] as const;
