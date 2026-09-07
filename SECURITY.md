# Security

## Product safety boundaries

- PLT is an original application. It does not use the Bybit name, logo,
  wordmark, or copy Bybit's screens; Bybit is used only as a public
  spot-market data source and functional layout reference.
- A persistent "Demo Environment — no real funds are held or transferred"
  notice is shown on every authenticated screen until real, licensed,
  regulated providers are connected.
- PLT never asks for a user's Bybit (or any third-party exchange)
  credentials, and never stores them.
- Mainnet crypto withdrawals, leveraged/margin/futures/options trading,
  copy trading, and real customer custody are out of scope for the MVP
  and will not be added without an explicit, separate scope change.

## Reporting a vulnerability

This is a demonstration project. If you find a security issue, open an
issue in the repository with as much reproduction detail as you can
(without including real secrets, personal data, or exploit payloads that
could be misused if the issue is public). Do not test against any
deployed instance you do not own.

## Current status (Phase 5)

Authentication, session management, MFA, CSRF protection, core banking,
crypto trading, and now deposits/withdrawals/cards/notifications/full
security settings are all implemented and described below as shipped.
Only the admin review panel remains — that's Phase 6. This file is
updated at the end of every phase that touches security-relevant surface
area.

### Implemented in Phase 1

- **Strict TypeScript**, `no-explicit-any` enforced via ESLint.
- **No floating-point money.** See `ARCHITECTURE.md`. Removes an entire
  class of rounding/precision bugs that can otherwise become balance
  discrepancies.
- **Ledger balance enforcement.** `assertBalancedPosting` throws before
  any DB write if debits ≠ credits for any asset in a posting — covered
  by unit tests in `tests/unit/ledger.test.ts`.
- **Idempotency-by-design.** Every financial-mutation table has a unique
  `idempotencyKey` column; see `lib/ledger/idempotency.ts`.
- **No secrets in the repo.** `.env.example` contains placeholders only;
  `.gitignore` excludes `.env*`. `ApiConnection` (for provider config
  like Bybit) stores status/metadata only — never a secret.
- **Baseline HTTP security headers** in `next.config.mjs`:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
  `Permissions-Policy`. CSP is deliberately deferred until chart/font
  sources are finalized in a later phase, to avoid shipping an
  inaccurate policy.
- **Accessible focus handling.** Visible focus rings everywhere; the
  mobile navigation drawer traps focus and restores it to the trigger
  on close.

### Implemented in Phase 2

- **Argon2id password hashing** (`lib/auth/password.ts`, `@node-rs/argon2`).
  Never stores or logs plaintext. A constant-time-ish dummy-hash fallback
  in `loginUser` prevents a non-existent email from responding
  measurably faster than a wrong password for a real one.
- **Secure, HTTP-only, rotated sessions.** Opaque random tokens; only a
  SHA-256 hash is stored server-side (`Session.sessionTokenHash`); cookie
  is `httpOnly`, `SameSite=Lax`, and `secure` in production. Logging out,
  resetting a password, or disabling MFA revokes sessions server-side
  immediately (`destroySession` / `destroyAllSessionsForUser`) — not a
  client-side-only "forget the cookie."
- **Email verification and time-boxed tokens.** Verification tokens live
  24h, password-reset tokens 30 minutes; both are single-use
  (`consumedAt`) and only a SHA-256 hash is ever stored
  (`lib/auth/tokens.ts`).
- **MFA (TOTP).** `lib/auth/mfa.ts` + `lib/encryption/aes.ts` (AES-256-GCM,
  authenticated encryption) for the stored secret. The login flow never
  creates a session on password-verification alone when MFA is required —
  see `ARCHITECTURE.md` for the two-step flow.
- **Rate limiting** on register, login, MFA verification, forgot-password,
  and reset-password (`lib/rate-limit/limiter.ts`). **Known MVP
  limitation:** in-memory, per-process — does not share state across
  multiple server instances or serverless invocations. `RATE_LIMIT_REDIS_URL`
  is scaffolded in `.env.example` for the swap before any multi-instance
  deployment.
- **Audit logging** on register, login, logout, email verification,
  password reset, onboarding completion, and MFA enable/disable
  (`lib/audit/log.ts` → `AuditLog`).
- **Device recognition** for "remember this device" and new-device login
  notifications (`lib/auth/device.ts`), without third-party fingerprinting.
- **Non-enumeration by design.** Registration reveals whether an email is
  taken (needed for usable signup UX), but login, forgot-password, and
  resend-verification never do — see `ARCHITECTURE.md`.
- **Never-log-secrets, enforced in code, not just policy.** No password,
  OTP, session token, TOTP secret, or reset/verification token appears in
  any `console.log`/audit-log call anywhere in `features/authentication/`.

### Implemented in Phase 3

- **CSRF protection.** Double-submit cookie (`lib/auth/csrf.ts`) on every
  mutating banking route. See `ARCHITECTURE.md` for the mechanism.
- **Transaction PIN.** Argon2id-hashed (`lib/auth/transaction-pin.ts`),
  required to confirm every transfer. A user cannot transfer at all until
  one is set.
- **Step-up authentication for beneficiaries.** Adding a new beneficiary
  requires re-entering the account password
  (`features/banking/beneficiaries.ts#createBeneficiary`).
- **Idempotent financial mutations.** `POST /api/transfers` requires an
  `Idempotency-Key` header; duplicate submissions (double-click, retry
  after a timeout) return the original result instead of transferring
  twice. Namespaced per-user so keys can never collide across accounts.
- **Ownership checks on every account/transaction read.**
  `getOwnedAccountOrThrow`, `getTransactionOrThrow`, and the beneficiary
  update/delete paths all verify `record.userId === callerId` and return
  a generic 404 (never a distinguishable "exists but not yours" vs
  "doesn't exist") — this is the IDOR defense for Phase 3's resources.
- **Rate limiting extended** to transfer creation and beneficiary
  creation (same in-memory limiter and multi-instance caveat as Phase 2).
- **Audit logging extended** to transfer creation, beneficiary
  create/delete, and transaction-PIN changes.

### Implemented in Phase 4

- **CSRF protection extended** to every crypto mutation route: order
  placement/cancellation, watchlist toggling, and conversion execution.
  Getting a conversion quote is intentionally excluded, same as
  `/api/transfers/quote` in Phase 3 — it previews a rate and creates a
  time-boxed, single-use `ConversionQuote` row, but moves no funds.
- **Idempotent order placement and conversion execution.** `POST
  /api/orders` and `POST /api/conversions` both require an
  `Idempotency-Key` header, namespaced per-user, following the exact
  pattern established for transfers in Phase 3.
- **Rate limiting extended** to order placement (30/hour per user+IP).
- **Ownership checks** on every order/wallet read — `cancelOrder` and the
  `GET /api/orders/:id` route both verify `order.userId === callerId`
  before returning anything, same IDOR defense as accounts/transactions.
- **No external credentials required or accepted for market data.** The
  Bybit integration is public-data-only in this phase; there is nowhere
  in the codebase that accepts, stores, or transmits a Bybit API key —
  `BYBIT_API_KEY`/`BYBIT_API_SECRET` in `.env.example` remain unused
  placeholders for the optional demo-trading phase described in the
  product spec, not yet wired to anything.
- **Balance reservation prevents double-spending across concurrent
  actions.** Placing a limit order atomically moves funds from
  `available` to `locked` in the same transaction that creates the
  order, so the reserved amount can't simultaneously be spent by a
  transfer or a second order.

### Implemented in Phase 5

- **Withdrawals require the transaction PIN**, same as transfers, plus a
  destination-format check (`isValidDestinationFormat` —
  network-appropriate heuristics, not full per-chain checksum
  validation, which is out of scope for a simulated withdrawal with no
  real chain).
- **Risk-based withdrawal review.** Withdrawals above a USD-equivalent
  threshold are held `PENDING` instead of completing instantly — see
  `ARCHITECTURE.md`. This is the first place in the codebase that
  distinguishes "the request succeeded" from "the money has actually
  moved," which the Phase 6 admin panel will act on.
- **Session-based account controls, not just login-time ones.** Users
  can now change their password (revokes every session), view and
  individually revoke trusted devices and active sessions, revoke every
  *other* session in one action, and review their login history — this
  is the UI surface for data that's existed since Phase 2 but was
  previously invisible to the account owner.
- **Account deactivation requires password re-confirmation** and
  immediately revokes every session, same pattern as MFA disable and
  beneficiary creation.
- **CSRF protection and ownership checks extended** to every new
  mutation route (deposits, withdrawals, card actions, notification
  read-state, all security-settings endpoints) — same patterns
  established in Phases 3–4, not a new mechanism.
- **Card numbers are never fully generated or displayed.** `maskedNumber`
  only ever contains a masked format with the last 4 digits; there is no
  code path anywhere that constructs, stores, or logs a full card number
  (there's no real card network to issue one against in the first
  place).

### Implemented in Phase 6

- **ADMIN-only operational surface.** `/admin` is protected by the
  database-backed `requireAdmin` check and every admin API repeats the
  role check. Admin mutations require CSRF and are written to `AuditLog`.
- **Withdrawal review and reversals.** A rejected pending withdrawal is
  atomically reversed with a fresh balanced ledger group and the cache is
  credited by the exact Decimal principal-plus-fee amount.
- **Enforced allowlist.** Users can store scoped destinations; when the
  setting is enabled, a withdrawal cannot reach a balance or ledger write
  unless its destination is allowlisted for the requested asset/network.
- **Operational controls.** Maintenance mode is durable, blocks financial
  mutation routes, redirects non-admin platform sessions, and leaves
  admins able to recover the service. Announcements and provider health
  are auditable admin actions.
- **Browser hardening.** The response headers now include CSP,
  cross-origin isolation, disabled DNS prefetching, frame denial, and a
  restrictive permissions policy.

### Explicitly deferred to later phases (tracked, not forgotten)

**CSRF protection is now implemented** (see above) — the item below is
resolved and kept here only as a record of the earlier commitment.

| Control | Target phase |
| --- | --- |
| ~~Token-based CSRF protection~~ | ✅ Phase 3 |
| ~~Transaction PIN~~ | ✅ Phase 3 |
| ~~Step-up auth for beneficiaries~~ | ✅ Phase 3 |
| ~~Step-up auth for withdrawals~~ | ✅ Phase 5 |
| ~~Trusted-devices list, active-sessions list, login-history UI~~ | ✅ Phase 5 |
| ~~Tightened CSP and browser security headers~~ | ✅ Phase 6 |
| Server-side signing for any authenticated Bybit calls; secrets only in non-`NEXT_PUBLIC_` env vars | if/when the optional Bybit demo-trading phase is approved |
| Encryption at rest for stored integration credentials/metadata | if/when the optional Bybit demo-trading phase is approved |
| ~~Withdrawal address allowlist enforcement~~ | ✅ Phase 6 |
| ~~Admin review/approval flow for `PENDING` withdrawals~~ | ✅ Phase 6 |
| Withdrawal velocity checks and beneficiary cooling period | future hardening |
| Redis-backed rate limiting (see Phase 2 note) | before any multi-instance production deployment |

## Logging policy

Enforced from Phase 2 onward: no password, OTP, session token, TOTP
secret, private key, API secret, recovery code, full card number, or full
bank account number appears in any log line or `AuditLog.metadata` value.
`lib/auth/mailer.ts`'s console-simulated email fallback prints the
verification/reset **link** (equivalent to what a real inbox would show
the user) — never the underlying raw token in isolation outside that link,
and never a password. Every API error response carries a `requestId` for
correlation without needing to log request bodies.
