import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing (security memory: "Hash passwords with Argon2id.
 * Never store plaintext passwords."). @node-rs/argon2 defaults to the
 * Argon2id variant with OWASP-recommended parameters (19 MiB memory,
 * 2 iterations, 1 degree of parallelism) — tuned below to be deliberate
 * about the trade-off rather than relying on library defaults silently.
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plainTextPassword: string): Promise<string> {
  return hash(plainTextPassword, ARGON2_OPTIONS);
}

export async function verifyPassword(hashedPassword: string, plainTextPassword: string): Promise<boolean> {
  try {
    return await verify(hashedPassword, plainTextPassword, ARGON2_OPTIONS);
  } catch {
    // Malformed/foreign hash — treat as a failed verification, not a crash.
    return false;
  }
}

/**
 * Minimum password strength check enforced server-side (client-side Zod
 * validation mirrors this, but the server is the source of truth).
 * Deliberately simple and predictable rather than a byzantine composition
 * rule — length is the strongest single predictor of crack resistance.
 */
export function isPasswordStrongEnough(plainTextPassword: string): boolean {
  return plainTextPassword.length >= 10;
}
