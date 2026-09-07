import { beforeAll, describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "@/lib/encryption/aes";

beforeAll(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = "test-only-32-byte-encryption-key-value";
});

describe("secret encryption", () => {
  it("round-trips a value exactly", () => {
    const encrypted = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(encrypted)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("never stores the plaintext inside the encrypted payload", () => {
    const encrypted = encryptSecret("my-totp-secret");
    expect(encrypted).not.toContain("my-totp-secret");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-value");
    const b = encryptSecret("same-value");
    expect(a).not.toBe(b);
  });

  it("fails to decrypt a tampered payload rather than returning garbage silently", () => {
    const encrypted = encryptSecret("sensitive-value");
    const tampered = encrypted.slice(0, -2) + "00";
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
