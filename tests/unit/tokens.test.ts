import { describe, expect, it } from "vitest";
import { generateRawToken, hashToken, isTokenExpired } from "@/lib/auth/tokens";

describe("tokens", () => {
  it("generates a long, unpredictable raw token", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes deterministically (so a stored hash can be looked up again)", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("never reveals the raw token from its hash (different string entirely)", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).not.toContain(raw);
  });

  it("flags a past expiry as expired", () => {
    expect(isTokenExpired(new Date(Date.now() - 1000))).toBe(true);
  });

  it("does not flag a future expiry as expired", () => {
    expect(isTokenExpired(new Date(Date.now() + 60_000))).toBe(false);
  });
});
