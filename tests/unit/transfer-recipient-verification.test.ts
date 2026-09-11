import { describe, expect, it } from "vitest";
import { sanitizeRecipientData } from "@/features/banking/recipient-lookup";
import { RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

describe("sanitizeRecipientData", () => {
  it("extracts only safe confirmation fields and masks account number", () => {
    const rawData = {
      accountId: "acct_cuid_123",
      accountNumber: "1234567890",
      type: "CURRENT",
      currencySymbol: "USD",
      fullName: "Jane Doe",
      nickname: "My Checking",
      bankName: null,
      isInternalPlt: true,
      // Potentially sensitive fields that must NEVER appear in output
      email: "jane.doe@example.com",
      phone: "+12345678901",
      address: "123 Main St",
      dateOfBirth: "1990-01-01",
      balanceCache: "150000.00",
      userId: "user_private_id",
      transactions: [],
    };

    const sanitized = sanitizeRecipientData(rawData as unknown as Parameters<typeof sanitizeRecipientData>[0]);

    // Allowed fields
    expect(sanitized.accountId).toBe("acct_cuid_123");
    expect(sanitized.displayName).toBe("Jane Doe");
    expect(sanitized.accountType).toBe("Current Account");
    expect(sanitized.currencySymbol).toBe("USD");
    expect(sanitized.maskedAccountNumber).toBe("•••• 7890");
    expect(sanitized.isInternalPlt).toBe(true);
    expect(sanitized.bankName).toBeNull();

    // Sensitive fields must NOT exist on sanitized object
    expect((sanitized as Record<string, unknown>).email).toBeUndefined();
    expect((sanitized as Record<string, unknown>).phone).toBeUndefined();
    expect((sanitized as Record<string, unknown>).address).toBeUndefined();
    expect((sanitized as Record<string, unknown>).dateOfBirth).toBeUndefined();
    expect((sanitized as Record<string, unknown>).balanceCache).toBeUndefined();
    expect((sanitized as Record<string, unknown>).balance).toBeUndefined();
    expect((sanitized as Record<string, unknown>).userId).toBeUndefined();
    expect((sanitized as Record<string, unknown>).transactions).toBeUndefined();
  });

  it("falls back to nickname or FHT Customer when full name is missing or blank", () => {
    const withNickname = sanitizeRecipientData({
      accountId: "acct_1",
      accountNumber: "999988887777",
      type: "SAVINGS",
      currencySymbol: "EUR",
      fullName: "   ",
      nickname: "Euro Vault",
    });
    expect(withNickname.displayName).toBe("Euro Vault");

    const fallback = sanitizeRecipientData({
      accountId: "acct_2",
      accountNumber: "999988887777",
      type: "SAVINGS",
      currencySymbol: "EUR",
      fullName: null,
      nickname: null,
    });
    expect(fallback.displayName).toBe("FHT Customer");
  });
});

describe("recipientLookup rate limit configuration", () => {
  it("configures strict recipient lookup rate limits to prevent enumeration", () => {
    const rule = RATE_LIMIT_RULES.recipientLookup;
    expect(rule).toBeDefined();
    expect(rule.action).toBe("recipient-lookup");
    expect(rule.limit).toBeLessThanOrEqual(20);
    expect(rule.windowMs).toBe(15 * 60 * 1000); // 15 minutes
  });
});
