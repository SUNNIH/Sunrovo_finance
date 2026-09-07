import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Route protection middleware.
 *
 * This only checks whether a session cookie is *present* — it runs on
 * the Edge runtime, which cannot use Prisma (the query engine needs the
 * Node.js runtime), so it cannot validate the session against the
 * database. That authoritative check happens in `lib/auth/session.ts`
 * (`requireUser`/`requireOnboardedUser`/`requireAdmin`), called from
 * each protected route group's Server Component layout. This
 * middleware exists purely for fast, cheap redirect UX — defense in
 * depth, not the source of truth (security memory: "Authorise every
 * protected resource" is enforced at the data layer, not here).
 *
 * Deliberately one-directional: "no cookie at all" unambiguously means
 * "not logged in," so redirecting protected routes to /login without a
 * cookie is always safe. The inverse — "cookie present, so redirect
 * away from /login" — is NOT safe here, because a cookie can be stale
 * (session expired, revoked, or the DB was reset/migrated) without the
 * middleware being able to tell. Doing that redirect based on presence
 * alone created an infinite loop: /login -> (cookie present) -> bounce
 * to /dashboard -> (session invalid) -> bounce back to /login -> repeat.
 * The real "already logged in, skip the login page" check now lives in
 * app/(auth)/layout.tsx, which can actually validate the session.
 */
const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "plt_session";

const PROTECTED_PREFIXES = [
  "/dashboard", "/accounts", "/transfers", "/beneficiaries", "/transactions",
  "/markets", "/trade", "/convert", "/wallets", "/cards", "/notifications",
  "/profile", "/security", "/support", "/onboarding", "/admin",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
