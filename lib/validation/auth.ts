import { z } from "zod";

// Server is the source of truth; these schemas run in both the API route
// handlers and the client-side React Hook Form resolvers.

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(10, "Use at least 10 characters"),
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, {
      errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  rememberDevice: z.boolean(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const mfaVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  rememberDevice: z.boolean(),
});

export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const SUPPORTED_FIAT_CURRENCIES = ["USD", "NGN", "EUR", "GBP"] as const;
export const ACCOUNT_TYPES = ["individual", "business"] as const;

export const onboardingSchema = z.object({
  country: z.string().trim().min(2).max(60),
  preferredFiatCurrency: z.enum(SUPPORTED_FIAT_CURRENCIES),
  accountType: z.enum(ACCOUNT_TYPES),
  dateOfBirth: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), "Enter a valid date")
    .refine((value) => {
      const age = (Date.now() - new Date(value).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      return age >= 18;
    }, "You must be at least 18 years old"),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+?[0-9()\-.\s]{7,20}$/, "Enter a valid phone number"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
