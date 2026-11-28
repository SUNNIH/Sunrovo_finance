import { describe, it, expect, beforeEach, vi } from "vitest";
import { createConversionQuote, executeConversion } from "@/features/crypto/conversion";

/**
 * Phase 5: Conversion Feature Flag Tests
 * 
 * Verifies that conversion operations are blocked when CRYPTO_CONVERSION_ENABLED = false
 */

// Mock feature flag as DISABLED
vi.mock("@/lib/feature-flags", () => ({
  CRYPTO_CONVERSION_ENABLED: false,
  CRYPTO_TRADING_ENABLED: false,
}));

// Mock market service (shouldn't be called when disabled)
vi.mock("@/lib/market/service", () => ({
  getMarketTicker: vi.fn(),
}));

// Mock database (shouldn't be accessed when disabled)
vi.mock("@/lib/db/prisma", () => ({
  prisma: {},
}));

describe("Phase 5: Conversion Feature Flag Protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should block quote creation when CRYPTO_CONVERSION_ENABLED = false", async () => {
    const result = await createConversionQuote({
      userId: "user_123",
      fromAsset: "BTC",
      toAsset: "USDT",
      fromAmount: "0.1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("temporarily disabled");
  });

  it("should block conversion execution when CRYPTO_CONVERSION_ENABLED = false", async () => {
    const result = await executeConversion({
      userId: "user_123",
      quoteId: "quote_123",
      idempotencyKey: "idem_123",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("temporarily disabled");
  });
});
