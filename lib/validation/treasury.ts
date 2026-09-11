import { z } from "zod";
import Decimal from "decimal.js";

function isPositiveDecimalString(value: string): boolean {
  try {
    return new Decimal(value).gt(0);
  } catch {
    return false;
  }
}

const amountSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine(isPositiveDecimalString, "Enter an amount greater than zero");

export const fiatDepositSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  amount: amountSchema,
});
export type FiatDepositInput = z.infer<typeof fiatDepositSchema>;

export const cryptoDepositSchema = z.object({
  assetSymbol: z.string().trim().toUpperCase(),
  amount: amountSchema,
});
export type CryptoDepositInput = z.infer<typeof cryptoDepositSchema>;

export const withdrawalSchema = z.object({
  assetSymbol: z.string().trim().toUpperCase(),
  amount: amountSchema,
  destination: z.string().trim().min(4, "Enter a valid destination").max(120),
  network: z.string().trim().max(40).optional(),
  transactionPin: z.string().regex(/^\d{4,6}$/, "Enter your 4-6 digit transaction PIN"),
});
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;

export const requestCardSchema = z.object({
  formFactor: z.enum(["PHYSICAL", "VIRTUAL"]),
  currencySymbol: z.string().trim().toUpperCase().default("USD"),
});
export type RequestCardInput = z.infer<typeof requestCardSchema>;

export const cardSpendingLimitSchema = z.object({
  spendingLimit: amountSchema,
});
export type CardSpendingLimitInput = z.infer<typeof cardSpendingLimitSchema>;

export const adminFundingSchema = z
  .object({
    targetUserId: z.string().min(1, "Select a user"),
    targetAccountId: z.string().optional(),
    targetWalletId: z.string().optional(),
    assetSymbol: z.string().trim().toUpperCase(),
    amount: amountSchema,
    reason: z.string().trim().min(5, "Provide a reason (min 5 characters)").max(200),
  })
  .superRefine((input, ctx) => {
    const hasAccount = Boolean(input.targetAccountId);
    const hasWallet = Boolean(input.targetWalletId);
    if ((hasAccount && hasWallet) || (!hasAccount && !hasWallet)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetAccountId"],
        message: "Specify exactly one target: account or wallet.",
      });
    }
  });
export type AdminFundingInput = z.infer<typeof adminFundingSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(10, "Use at least 10 characters"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const antiPhishingPhraseSchema = z.object({
  phrase: z.string().trim().min(3, "Enter at least 3 characters").max(40),
});
export type AntiPhishingPhraseInput = z.infer<typeof antiPhishingPhraseSchema>;

export const deactivateAccountSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
});
export type DeactivateAccountInput = z.infer<typeof deactivateAccountSchema>;
