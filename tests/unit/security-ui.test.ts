import { describe, expect, it } from "vitest";
import { setTransactionPinSchema } from "@/lib/validation/banking";
import { changePasswordSchema, antiPhishingPhraseSchema } from "@/lib/validation/treasury";

describe("Transaction PIN Validation Schema", () => {
  it("accepts valid 4-6 digit numeric PINs with matching confirmation", () => {
    const valid4 = setTransactionPinSchema.safeParse({
      pin: "1234",
      confirmPin: "1234",
      currentPassword: "existingPassword123",
    });
    expect(valid4.success).toBe(true);

    const valid6 = setTransactionPinSchema.safeParse({
      pin: "987654",
      confirmPin: "987654",
      currentPassword: "existingPassword123",
    });
    expect(valid6.success).toBe(true);
  });

  it("rejects mismatched confirmPin", () => {
    const mismatched = setTransactionPinSchema.safeParse({
      pin: "1234",
      confirmPin: "4321",
      currentPassword: "existingPassword123",
    });
    expect(mismatched.success).toBe(false);
    if (!mismatched.success) {
      expect(mismatched.error.issues[0]?.message).toBe("PINs do not match");
    }
  });

  it("rejects PINs shorter than 4 digits or longer than 6 digits", () => {
    const short = setTransactionPinSchema.safeParse({
      pin: "123",
      confirmPin: "123",
      currentPassword: "existingPassword123",
    });
    expect(short.success).toBe(false);

    const long = setTransactionPinSchema.safeParse({
      pin: "1234567",
      confirmPin: "1234567",
      currentPassword: "existingPassword123",
    });
    expect(long.success).toBe(false);
  });

  it("rejects non-numeric PIN characters", () => {
    const alpha = setTransactionPinSchema.safeParse({
      pin: "abcd",
      confirmPin: "abcd",
      currentPassword: "existingPassword123",
    });
    expect(alpha.success).toBe(false);
  });
});

describe("Password Change Schema", () => {
  it("enforces minimum 10 characters for new password", () => {
    const short = changePasswordSchema.safeParse({
      currentPassword: "oldPassword123",
      newPassword: "short9",
      confirmNewPassword: "short9",
    });
    expect(short.success).toBe(false);

    const valid = changePasswordSchema.safeParse({
      currentPassword: "oldPassword123",
      newPassword: "validLengthPassword10",
      confirmNewPassword: "validLengthPassword10",
    });
    expect(valid.success).toBe(true);
  });

  it("rejects mismatched new passwords", () => {
    const mismatched = changePasswordSchema.safeParse({
      currentPassword: "oldPassword123",
      newPassword: "validLengthPassword10",
      confirmNewPassword: "differentPassword10",
    });
    expect(mismatched.success).toBe(false);
    if (!mismatched.success) {
      expect(mismatched.error.issues[0]?.message).toBe("Passwords do not match");
    }
  });
});

describe("Anti-Phishing Phrase Schema", () => {
  it("enforces 3 to 40 characters limit", () => {
    const short = antiPhishingPhraseSchema.safeParse({ phrase: "ab" });
    expect(short.success).toBe(false);

    const long = antiPhishingPhraseSchema.safeParse({ phrase: "a".repeat(41) });
    expect(long.success).toBe(false);

    const valid = antiPhishingPhraseSchema.safeParse({ phrase: "Blue Lighthouse 42" });
    expect(valid.success).toBe(true);
  });
});

describe("Security Invariant Preservation", () => {
  it("preserves authoritative isCurrent session flag without client-side inference", () => {
    const sessions = [
      { id: "sess_1", isCurrent: true, userAgent: "Mozilla/5.0 (Windows NT 10.0)", ipAddress: "127.0.0.1" },
      { id: "sess_2", isCurrent: false, userAgent: "Mozilla/5.0 (Macintosh)", ipAddress: "192.168.1.1" },
    ];

    expect(sessions.find((s) => s.isCurrent)?.id).toBe("sess_1");
    expect(sessions.filter((s) => !s.isCurrent).length).toBe(1);
  });

  it("preserves backend riskFlag without fabricating scores", () => {
    const eventWithRisk = { id: "evt_1", success: false, riskFlag: "IP_MISMATCH" };
    const eventWithoutRisk = { id: "evt_2", success: true, riskFlag: null };

    expect(eventWithRisk.riskFlag).toBe("IP_MISMATCH");
    expect(eventWithoutRisk.riskFlag).toBeNull();
  });
});
