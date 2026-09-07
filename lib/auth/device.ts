import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Lightweight device recognition for "remember this device" and
 * new-device login notifications. This is a cookie-based fingerprint,
 * not a hardware/browser fingerprinting technique — it identifies
 * "this browser profile that previously chose to be remembered," which
 * is all "remember this device" needs. Losing the cookie (private
 * browsing, cleared storage, new browser) simply means the device is
 * treated as new again, which is the correct, safe fallback.
 */

const DEVICE_COOKIE_NAME = "plt_device";
const DEVICE_COOKIE_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export async function getOrCreateDeviceId(): Promise<{ deviceId: string; isNew: boolean }> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  if (existing) {
    return { deviceId: existing, isNew: false };
  }

  const deviceId = randomBytes(16).toString("hex");
  cookieStore.set(DEVICE_COOKIE_NAME, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(Date.now() + DEVICE_COOKIE_TTL_MS),
  });
  return { deviceId, isNew: true };
}

/** Stable, non-reversible key for TrustedDevice.deviceFingerprint. */
export function fingerprintDevice(deviceId: string, userAgent?: string | null): string {
  return createHash("sha256").update(`${deviceId}::${userAgent ?? "unknown"}`).digest("hex");
}
