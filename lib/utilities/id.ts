/**
 * Generates a unique-enough client-side correlation ID (used as an
 * idempotency key, request marker, etc. — never as a security secret).
 *
 * `crypto.randomUUID()` only exists in secure contexts (HTTPS, or exactly
 * `http://localhost`/`127.0.0.1`) and only in reasonably modern
 * environments. Visiting the dev server via a LAN IP (e.g. the
 * `http://192.168.x.x:3000` address Next.js prints alongside
 * `localhost`) is *not* a secure context, so `crypto` exists but
 * `.randomUUID` does not — calling it throws `TypeError: crypto.
 * randomUUID is not a function`. This falls back to a
 * `Date.now()` + `Math.random()` based ID in that case. Not
 * cryptographically strong, but that's fine: nothing here needs to be
 * unguessable, only unique per client action.
 */
export function generateClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
