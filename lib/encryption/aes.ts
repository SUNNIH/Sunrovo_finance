import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

/**
 * Generic at-rest encryption for sensitive strings PLT must store but
 * never expose in plaintext (MFA TOTP secrets today; provider API
 * credentials in a later phase). Security memory: "Encrypt sensitive
 * integration credentials at rest using a server-side key-management
 * approach." AES-256-GCM gives us both confidentiality and integrity
 * (a tampered ciphertext fails to decrypt rather than silently
 * decrypting to garbage).
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is missing or too short. Set a random 32+ byte value in .env.local."
    );
  }
  // Derive a stable 32-byte key regardless of the raw secret's length/format.
  return scryptSync(secret, "plt-encryption-salt", 32);
}

/** Returns "iv:authTag:ciphertext", all hex-encoded, safe to store as one column value. */
export function encryptSecret(plainText: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(encoded: string): string {
  const [ivHex, authTagHex, cipherTextHex] = encoded.split(":");
  if (!ivHex || !authTagHex || !cipherTextHex) {
    throw new Error("Malformed encrypted secret payload.");
  }
  const key = getEncryptionKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherTextHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
