import { describe, expect, it } from "vitest";
import * as OTPAuth from "otpauth";
import { generateTotpSecret, getTotpProvisioningUri, verifyTotpCode } from "@/lib/auth/mfa";

describe("MFA (TOTP)", () => {
  it("generates a usable base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(0);
    expect(() => OTPAuth.Secret.fromBase32(secret)).not.toThrow();
  });

  it("builds a valid otpauth:// provisioning URI carrying the FHT issuer", () => {
    const secret = generateTotpSecret();
    const uri = getTotpProvisioningUri(secret, "ada@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain("FISE%20Holdings%20Trust%20Bank");
  });

  it("accepts the current, correctly generated code", () => {
    const secret = generateTotpSecret();
    const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30 });
    const code = totp.generate();
    expect(verifyTotpCode(secret, "ada@example.com", code)).toBe(true);
  });

  it("rejects an incorrect code", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "ada@example.com", "000000")).toBe(false);
  });

  it("rejects malformed input instead of throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpCode(secret, "ada@example.com", "abc")).toBe(false);
    expect(verifyTotpCode(secret, "ada@example.com", "12345")).toBe(false);
  });
});
