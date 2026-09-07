import { describe, expect, it } from "vitest";
import { registerSchema, onboardingSchema, loginSchema } from "@/lib/validation/auth";

describe("registerSchema", () => {
  const base = {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    password: "correct-horse-battery",
    confirmPassword: "correct-horse-battery",
    acceptedTerms: true as const,
  };

  it("accepts a valid registration payload", () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "different" });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = registerSchema.safeParse({ ...base, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("lowercases the email", () => {
    const result = registerSchema.safeParse({ ...base, email: "ADA@EXAMPLE.COM" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("ada@example.com");
  });

  it("rejects when terms are not accepted", () => {
    const result = registerSchema.safeParse({ ...base, acceptedTerms: false });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid payload with rememberDevice explicit", () => {
    const result = loginSchema.safeParse({ email: "a@b.com", password: "x", rememberDevice: false });
    expect(result.success).toBe(true);
  });

  it("rejects a payload missing rememberDevice — the form (not the schema) supplies the default", () => {
    // rememberDevice is a plain required boolean, not `.optional().default()`,
    // specifically to avoid an input/output type mismatch between Zod and
    // react-hook-form (see CHANGELOG). Every form using this schema passes
    // `defaultValues: { rememberDevice: false }` to useForm instead.
    const result = loginSchema.safeParse({ email: "a@b.com", password: "x" });
    expect(result.success).toBe(false);
  });
});

describe("onboardingSchema", () => {
  const base = {
    country: "Nigeria",
    preferredFiatCurrency: "NGN" as const,
    accountType: "individual" as const,
    dateOfBirth: "1990-01-01",
    phoneNumber: "+2348012345678",
  };

  it("accepts a valid onboarding payload", () => {
    expect(onboardingSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an under-18 date of birth", () => {
    const recentYear = new Date().getFullYear() - 5;
    const result = onboardingSchema.safeParse({ ...base, dateOfBirth: `${recentYear}-01-01` });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported currency", () => {
    const result = onboardingSchema.safeParse({ ...base, preferredFiatCurrency: "JPY" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    const result = onboardingSchema.safeParse({ ...base, phoneNumber: "not-a-phone" });
    expect(result.success).toBe(false);
  });
});
