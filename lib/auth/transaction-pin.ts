import "server-only";
import { hashPassword, verifyPassword } from "./password";

/**
 * Transaction PIN — the step-up authentication mechanism for sensitive
 * money-moving actions (security memory: "Use MFA or transaction PIN for
 * sensitive actions"). Reuses the same Argon2id hashing as the account
 * password (a short PIN still deserves a real password hash, not a fast
 * general-purpose hash that's cheap to brute-force offline).
 */

export function isValidPinFormat(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export async function hashTransactionPin(pin: string): Promise<string> {
  return hashPassword(pin);
}

export async function verifyTransactionPin(pinHash: string, pin: string): Promise<boolean> {
  return verifyPassword(pinHash, pin);
}
