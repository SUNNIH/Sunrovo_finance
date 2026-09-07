import { describe, expect, it } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit/limiter";

describe("checkRateLimit", () => {
  it("allows requests under the limit", () => {
    const rule = { action: "test-under-limit", limit: 3, windowMs: 60_000 };
    expect(checkRateLimit(rule, "user-a").allowed).toBe(true);
    expect(checkRateLimit(rule, "user-a").allowed).toBe(true);
    expect(checkRateLimit(rule, "user-a").allowed).toBe(true);
  });

  it("blocks once the limit is exceeded within the window", () => {
    const rule = { action: "test-over-limit", limit: 2, windowMs: 60_000 };
    expect(checkRateLimit(rule, "user-b").allowed).toBe(true);
    expect(checkRateLimit(rule, "user-b").allowed).toBe(true);
    const third = checkRateLimit(rule, "user-b");
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate identifiers independently", () => {
    const rule = { action: "test-independent", limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(rule, "user-c").allowed).toBe(true);
    expect(checkRateLimit(rule, "user-d").allowed).toBe(true);
    expect(checkRateLimit(rule, "user-c").allowed).toBe(false);
  });

  it("tracks separate actions independently for the same identifier", () => {
    const ruleA = { action: "test-action-a", limit: 1, windowMs: 60_000 };
    const ruleB = { action: "test-action-b", limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(ruleA, "same-user").allowed).toBe(true);
    expect(checkRateLimit(ruleB, "same-user").allowed).toBe(true);
  });
});
