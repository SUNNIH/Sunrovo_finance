/**
 * Bybit API Rate Limiter
 * 
 * Token bucket implementation to enforce Bybit's 10 requests/second limit.
 * Prevents rate limit violations that could result in temporary API bans.
 */

import { BYBIT_RATE_LIMIT_PER_SECOND } from "./config";

class TokenBucket {
  private tokens: number;
  private lastRefillTime: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(capacity: number, refillPerSecond: number) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
    this.refillRate = refillPerSecond / 1000; // convert to tokens per ms
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillTime;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  /**
   * Attempt to consume a token. Returns true if successful, false if bucket is empty.
   */
  tryConsume(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Wait until a token is available, then consume it.
   * Returns a promise that resolves when the token is acquired.
   */
  async acquire(): Promise<void> {
    while (!this.tryConsume()) {
      // Wait a small amount before retrying
      const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
      await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 100)));
    }
  }

  /**
   * Get the current number of available tokens (for monitoring).
   */
  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// ─── Singleton Instance ─────────────────────────────────────────────────────

const rateLimiter = new TokenBucket(
  BYBIT_RATE_LIMIT_PER_SECOND,
  BYBIT_RATE_LIMIT_PER_SECOND
);

/**
 * Acquire a rate limit token before making a Bybit API request.
 * This function will wait if necessary to avoid exceeding rate limits.
 */
export async function acquireRateLimitToken(): Promise<void> {
  await rateLimiter.acquire();
}

/**
 * Check if a rate limit token is immediately available without waiting.
 */
export function hasRateLimitToken(): boolean {
  return rateLimiter.tryConsume();
}

/**
 * Get the current rate limit state (for monitoring).
 */
export function getRateLimitState(): { availableTokens: number } {
  return {
    availableTokens: rateLimiter.getAvailableTokens(),
  };
}
