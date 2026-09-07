import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Bridges the gap between "password verified" and "MFA code verified"
 * without creating a full Session (and thus without granting access)
 * early. Rather than a new DB table, this is a short-lived, HMAC-signed
 * cookie carrying only a userId + expiry — signed with SESSION_SECRET so
 * it cannot be forged, and never trusted as authentication on its own
 * (only `/api/auth/mfa/verify` reads it, and only to know *which*
 * pending login to check a code against).
 */

const COOKIE_NAME = "plt_pending_mfa";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set.");
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export async function setPendingMfaCookie(userId: string): Promise<void> {
  const expiresAt = Date.now() + TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const value = `${payload}.${sign(payload)}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function readPendingMfaUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [userId, expiresAtRaw, signature] = parts;
  if (!userId || !expiresAtRaw || !signature) return null;

  const expectedSignature = sign(`${userId}.${expiresAtRaw}`);
  const provided = Buffer.from(signature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) return null;

  return userId;
}

export async function clearPendingMfaCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
