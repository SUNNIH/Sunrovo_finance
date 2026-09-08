import "server-only";

/**
 * Rate limiting (security memory: "Apply rate limits to authentication
 * and financial actions"). This is a fixed-window, in-memory limiter —
 * correct and dependency-free for local dev and a single-instance demo
 * deployment, but it does NOT share state across multiple server
 * instances or serverless invocations. `RATE_LIMIT_REDIS_URL` is already
 * scaffolded in .env.example for swapping in a Redis-backed
 * implementation before any multi-instance production deployment; this
 * module is written so that swap only touches this one file.
 */

interface Bucket {
  count: number;
  windowStartedAt: number;
}

const buckets = new Map<string, Bucket>();

// Sweep old buckets periodically so the in-memory Map doesn't grow
// unbounded over a long-running dev/demo server process.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now - bucket.windowStartedAt > SWEEP_INTERVAL_MS) buckets.delete(key);
    }
  }, SWEEP_INTERVAL_MS).unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitRule {
  /** Distinguishes limiter buckets, e.g. "login", "forgot-password". */
  action: string;
  limit: number;
  windowMs: number;
}

/**
 * Common rules referenced across auth routes. Values are deliberately
 * generous enough not to lock out a legitimate user typing a wrong
 * password twice, while still blocking brute-force / enumeration.
 */
export const RATE_LIMIT_RULES = {
  login: { action: "login", limit: 8, windowMs: 15 * 60 * 1000 },
  register: { action: "register", limit: 5, windowMs: 60 * 60 * 1000 },
  forgotPassword: { action: "forgot-password", limit: 4, windowMs: 60 * 60 * 1000 },
  resetPassword: { action: "reset-password", limit: 8, windowMs: 60 * 60 * 1000 },
  mfaVerify: { action: "mfa-verify", limit: 6, windowMs: 15 * 60 * 1000 },
  resendVerification: { action: "resend-verification", limit: 4, windowMs: 60 * 60 * 1000 },
  transfer: { action: "transfer", limit: 20, windowMs: 60 * 60 * 1000 },
  beneficiaryCreate: { action: "beneficiary-create", limit: 10, windowMs: 60 * 60 * 1000 },
  recipientLookup: { action: "recipient-lookup", limit: 20, windowMs: 15 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

/** identifier is typically `${ip}:${email}` or just `ip` for pre-auth endpoints. */
export function checkRateLimit(rule: RateLimitRule, identifier: string): RateLimitResult {
  const key = `${rule.action}:${identifier}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStartedAt > rule.windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return { allowed: true, remaining: rule.limit - 1, retryAfterMs: 0 };
  }

  if (bucket.count >= rule.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: rule.windowMs - (now - bucket.windowStartedAt),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: rule.limit - bucket.count, retryAfterMs: 0 };
}
