import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, isPasswordStrongEnough } from "@/lib/auth/password";

describe("password hashing", () => {
  it("hashes and verifies a correct password", async () => {
    const hash = await hashPassword("a-very-secure-password-123");
    expect(hash).not.toBe("a-very-secure-password-123");
    expect(await verifyPassword(hash, "a-very-secure-password-123")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("a-very-secure-password-123");
    expect(await verifyPassword(hash, "the-wrong-password")).toBe(false);
  });

  it("never stores the plaintext password in the hash output", async () => {
    const hash = await hashPassword("correct-horse-battery-staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("does not throw on a malformed/foreign hash — just fails verification", async () => {
    await expect(verifyPassword("not-a-real-hash", "anything")).resolves.toBe(false);
  });
});

describe("isPasswordStrongEnough", () => {
  it("rejects short passwords", () => {
    expect(isPasswordStrongEnough("short1")).toBe(false);
  });

  it("accepts a 10+ character password", () => {
    expect(isPasswordStrongEnough("longenoughpassword")).toBe(true);
  });
});
