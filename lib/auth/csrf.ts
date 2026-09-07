import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * CSRF protection (deferred in Phase 2, implemented here per
 * SECURITY.md's Phase 3 commitment). Double-submit cookie pattern:
 *
 *  - A CSRF token is set as a *readable* (non-HTTP-only) cookie once a
 *    session exists — readable on purpose, since JS must read it to echo
 *    it back.
 *  - Every mutating request (POST/PATCH/DELETE on a financial or
 *    account-changing route) must send that same value back in the
 *    `X-CSRF-Token` header.
 *  - The server verifies header === cookie. A cross-site attacker can
 *    make the browser send the cookie automatically, but cannot read it
 *    (same-origin policy) to put it in a header — so a forged
 *    cross-origin request will always have a missing/mismatched header.
 *
 * This is intentionally independent of the session cookie itself (never
 * trust CSRF token presence as authentication) — it only proves the
 * request originated from a page that could read this origin's cookies.
 */

const CSRF_COOKIE_NAME = "plt_csrf";

export async function ensureCsrfCookie(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  if (existing) return existing;

  const token = randomBytes(32).toString("hex");
  cookieStore.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return token;
}

export async function verifyCsrf(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(CSRF_COOKIE_NAME)?.value;
  const headerToken = request.headers.get("x-csrf-token");

  if (!cookieToken || !headerToken) return false;

  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);
  if (cookieBuf.length !== headerBuf.length) return false;

  return timingSafeEqual(cookieBuf, headerBuf);
}
