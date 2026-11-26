/**
 * Bybit Rate Limiter Tests
 */

import { describe, it, expect } from "vitest";
import { acquireRateLimitToken, hasRateLimitToken, getRateLimitState } from "@/lib/bybit/rate-limiter";

describe("rate-limiter", () => {
  it("should allow immediate token acquisition when bucket is full", async () => {
    const startTime = Date.now();
    await acquireRateLimitToken();
    const elapsed = Date.now() - startTime;

    // Should complete almost immediately
    expect(elapsed).toBeLessThan(100);
  });

  it("should track available tokens", async () => {
    const initialState = getRateLimitState();
    expect(initialState.availableTokens).toBeGreaterThan(0);

    // Consume a token
    await acquireRateLimitToken();

    const afterState = getRateLimitState();
    expect(afterState.availableTokens).toBeLessThan(initialState.availableTokens);
  });

  it("should refill tokens over time", async () => {
    // Consume multiple tokens
    for (let i = 0; i < 5; i++) {
      await acquireRateLimitToken();
    }

    const stateAfterConsumption = getRateLimitState();
    const tokensAfterConsumption = stateAfterConsumption.availableTokens;

    // Wait for refill (1 second should refill ~10 tokens at 10/sec rate)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const stateAfterRefill = getRateLimitState();
    expect(stateAfterRefill.availableTokens).toBeGreaterThan(tokensAfterConsumption);
  }, 2000);

  it("should not exceed capacity", async () => {
    // Wait to ensure bucket is full
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const state = getRateLimitState();
    
    // Available tokens should not exceed capacity (10 at 10/sec rate)
    expect(state.availableTokens).toBeLessThanOrEqual(10);
  }, 2000);
});
