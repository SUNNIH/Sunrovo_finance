import { createHash, randomBytes } from "node:crypto";

/**
 * Email-verification and password-reset tokens (security memory:
 * "Implement email verification. Implement password-reset tokens with
 * short expirations."). We only ever store a SHA-256 hash of the token
 * in VerificationToken.tokenHash — the raw token exists only in the
 * outgoing email link and the requester's browser, so a leaked database
 * cannot be used to forge verification/reset links.
 */

export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes, deliberately short

export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function isTokenExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now();
}
