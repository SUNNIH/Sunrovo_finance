import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { AuthError } from "@/features/authentication/errors";
import { generateRawToken, hashToken } from "./tokens";

/**
 * Sessions (security memory: "Use secure HTTP-only sessions", "Rotate
 * sessions after authentication", "Session revocation"). We store only a
 * SHA-256 hash of the session token in the DB (Session.sessionTokenHash)
 * — the raw token lives solely in the browser's HTTP-only cookie, so a
 * leaked database dump cannot be replayed as a live session.
 *
 * Read functions (getCurrentUser, requireUser) work from Server
 * Components. Write functions (createSession, destroySession, and the
 * cookie setters) must only be called from a Route Handler or Server
 * Action — Next.js forbids mutating cookies from a plain Server
 * Component render.
 */

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "plt_session";

export interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function createSession(userId: string, meta: RequestMeta = {}) {
  // Recheck at the session issuance boundary, including alternative callers.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, emailVerifiedAt: true },
  });
  if (!user || user.status !== "ACTIVE") {
    throw new AuthError("ACCOUNT_INACTIVE", "This account is not active. Contact support.", 403);
  }
  if (!user.emailVerifiedAt) {
    throw new AuthError("EMAIL_NOT_VERIFIED", "Verify your email address before signing in. You can request a new verification link.", 403);
  }

  const rawToken = generateRawToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      sessionTokenHash: hashToken(rawToken),
      expiresAt,
      ipAddress: meta.ipAddress ?? undefined,
      userAgent: meta.userAgent ?? undefined,
    },
  });

  return { rawToken, expiresAt };
}

/** Must be called from a Route Handler / Server Action. */
export async function setSessionCookie(rawToken: string, expiresAt: Date) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Must be called from a Route Handler / Server Action. */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Revokes the session server-side. Safe to call even if already expired/missing. */
export async function destroySession(rawToken: string) {
  await prisma.session
    .delete({ where: { sessionTokenHash: hashToken(rawToken) } })
    .catch(() => undefined);
}

/** Revoke every session for a user (e.g. "log out of all devices", password change). */
export async function destroyAllSessionsForUser(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Resolves the current request's authenticated user from the session
 * cookie. Returns null rather than throwing for any invalid/expired/
 * missing session so callers can decide how to respond (redirect vs.
 * 401 JSON vs. treat as anonymous).
 */
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: hashToken(rawToken) },
    include: {
      user: {
        include: { profile: true, securitySetting: true },
      },
    },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.status !== "ACTIVE" || !session.user.emailVerifiedAt) return null;

  return session.user;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Returns just the current session's ID (or null), without the full user
 * lookup `getCurrentUser` does. Used by "sign out of all other devices,"
 * which needs to exclude the caller's own active session from the
 * revocation.
 */
export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionTokenHash: hashToken(rawToken) },
    select: { id: true },
  });
  return session?.id ?? null;
}

/** For Server Components in the (platform) / admin route groups. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

export async function requireOnboardedUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.profile?.onboardingCompletedAt) {
    redirect("/onboarding");
  }
  return user;
}
