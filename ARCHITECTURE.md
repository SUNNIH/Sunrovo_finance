# Architecture

## Shape: modular monolith

One Next.js application, feature-oriented internal boundaries. No
microservices until a specific feature demonstrably needs independent
scaling or deployment (product rule: "Prefer a modular monolith before
microservices"). `features/*` own business logic; `app/api/*` route
handlers stay thin and delegate into `features/*` and `lib/*`.

## Design tokens

Every color in the product is a CSS custom property defined once in
`app/globals.css` (`:root` for light, `.dark` for dark) and exposed to
Tailwind via `tailwind.config.ts` (e.g. `bg-surface`, `text-secondary`,
`border-default`, `text-success`). Components must reference these
Tailwind classes, never a literal hex value or a hardcoded `dark:` pair.
This is what makes the light/dark themes (and any future rebrand) a
one-file change.

## Money: no floating-point, ever

- **Storage**: every monetary/asset amount in `prisma/schema.prisma` is
  `Decimal @db.Decimal(36, 18)`. One precision fits both fiat (2dp) and
  crypto (up to 18dp); display precision is a lookup (`Asset.precision`
  in the DB, mirrored for the UI layer in
  `lib/money/format.ts#ASSET_DISPLAY_PRECISION`), not a storage decision.
- **Arithmetic**: `lib/money/money.ts` wraps `decimal.js`. The `Money`
  class is asset-tagged — `Money` for USD and `Money` for BTC cannot be
  added together; attempting it throws `MoneyAssetMismatchError`. This
  makes an entire class of bugs (accidentally summing different assets)
  a compile-adjacent, always-runtime-checked error instead of a silent
  wrong number.
- **Display**: `lib/money/format.ts#formatMoney` + the `CurrencyValue`
  component in `components/financial/`. Every balance, price, and
  transaction amount in the UI must render through `CurrencyValue` (or
  carry the `.financial-value` / `.tabular-nums` class directly), per
  the "financial values must use tabular numerals" rule.

## Ledger: source of truth, double-entry, atomic

`LedgerAccount` (a chart of accounts — user-owned via `BankAccount` /
`CryptoWallet`, or platform-owned like a fee-revenue or fiat-settlement
account) and `LedgerEntry` (one debit or credit leg) are the only
authoritative record of "who owns how much of what." Everything else —
`BankAccount.balanceCache`, `AssetBalance.available/locked` — is a
performance cache, reconciled from `LedgerEntry` rows, and must never be
written to directly outside `lib/ledger/`.

`lib/ledger/postLedgerEntries.ts#assertBalancedPosting` enforces, before
any row is written, that for every `assetSymbol` present in a posting,
`sum(DEBIT) === sum(CREDIT)`. `postLedgerEntries()` must always be called
from inside an existing `prisma.$transaction(...)`, alongside the write
to the domain record (`Transfer`, `CryptoOrder`, `Conversion`, `Deposit`,
`Withdrawal`) and the user-facing `Transaction` row, so all of it commits
or none of it does. All legs of one posting share a `groupId`, which is
how `Transaction.ledgerGroupId` lets support/audit trace a user-visible
event back to its exact ledger postings.

Example — internal transfer of 50,000 NGN:
```
DEBIT  sender's BankAccount ledger account     50,000 NGN
CREDIT recipient's BankAccount ledger account  50,000 NGN
```

Example — simulated BTC purchase with USD:
```
DEBIT  user's fiat ledger account         100.00 USD
CREDIT platform fiat-settlement account   100.00 USD
DEBIT  platform crypto-inventory account  0.0015 BTC
CREDIT user's crypto ledger account       0.0015 BTC
```
(fee leg omitted above for brevity; added as its own balanced pair against
a fee-revenue `LedgerAccount` in the trading-engine phase.)

## Idempotency

Every financial-mutation model (`Transfer`, `CryptoOrder`, `Conversion`,
`Deposit`, `Withdrawal`) carries a `idempotencyKey @unique` column.
`lib/ledger/idempotency.ts` documents and helps enforce the standard
shape: look up by key before doing work; if found, return the original
result; if a concurrent duplicate slips past that check, the DB's unique
constraint rejects the second insert and `withIdempotentFallback` recovers
the original record instead of surfacing a 500.

## Navigation as data

`components/navigation/nav-config.ts` is the single source of truth for
both the desktop `Sidebar`, the `MobileNavDrawer`, and the
`MobileBottomNavigation`. Adding/renaming/reordering a nav item is a
one-file change instead of three.

## Auth: sessions, not JWTs

Sessions are opaque random tokens, stored server-side (`Session.sessionTokenHash`,
a SHA-256 hash — never the raw token) and handed to the browser only as an
HTTP-only, `SameSite=Lax` cookie. This is a deliberate choice over stateless
JWTs: revocation (logout, password change, MFA disable) is a single DB
delete rather than a token-blocklist workaround, which matters for a
banking product where "sign out everywhere" needs to actually take effect
immediately.

**Middleware vs. layout — two different jobs, on purpose.** Next.js
Middleware runs on the Edge runtime, which cannot load Prisma's query
engine. So `middleware.ts` only checks whether a session cookie is
*present* and does a cheap redirect — it is not the authorization
boundary. The real check is `lib/auth/session.ts#requireUser` /
`requireOnboardedUser` / `requireAdmin`, called from each protected route
group's Server Component layout (`app/(platform)/layout.tsx`), which
validates the session against the database, checks expiry, and checks
`User.status`. This matches the security rule "authorise every protected
resource" literally: the resource's own layout authorizes it, rather than
trusting a perimeter check.

## MFA: password, then a separate signed cookie, then a session

Logging in with MFA enabled is two requests, not one, and deliberately
never creates a `Session` row for the second factor to attach to:

1. `POST /api/auth/login` verifies the password. If MFA is required (enabled,
   and the device isn't already trusted), it does **not** create a session.
   Instead it sets a short-lived (10 min), HMAC-signed cookie
   (`lib/auth/pending-mfa.ts`) carrying only a user ID — signed with
   `SESSION_SECRET` so it can't be forged, and useless on its own since it
   grants no access to anything.
2. `POST /api/auth/mfa/verify` reads that cookie, checks the TOTP code
   against the user's encrypted secret, and only then calls the same
   `finalizeLogin` path a non-MFA login uses (create session, set the real
   session cookie, record the login event, handle device trust).

This means a stolen "I entered the right password" moment never grants
access on its own — there is no session, cookie, or token that represents
"password verified" as a standalone privilege.

## Login-enumeration and timing

`loginUser` always calls `verifyPassword` — against the real hash if the
user exists, against a lazily-generated, cached dummy Argon2id hash if they
don't — so a non-existent email doesn't return measurably faster than a
wrong password for a real one. `resendVerificationEmail` and
`requestPasswordReset` always resolve successfully regardless of whether
the account exists, for the same reason (never let response shape/timing
reveal account existence).

## Device trust and "remember this device"

`lib/auth/device.ts` sets a long-lived, random, HTTP-only cookie
(`plt_device`) the first time a browser is seen. `TrustedDevice` rows key
on a hash of that device ID plus the user agent — trusted only once
"remember this device" is checked at login or MFA confirmation. Losing the
cookie (private browsing, cleared storage) simply makes the device look new
again next time, which is the correct, safe default (falls back to
requiring MFA again, never silently trusts).

## Transfers: three destination kinds, one ledger pattern

Every transfer resolves its destination to exactly one of three kinds
(`features/banking/transfers.ts#resolveDestination`) before touching the
ledger:

- **`own_account`** — between two of the caller's own `BankAccount`s.
- **`internal_beneficiary`** — a saved beneficiary whose account number
  resolves to a real FHT `BankAccount` (any user's). Free.
- **`external_beneficiary`** — a saved beneficiary marked `EXTERNAL_BANK`.
  Since there is no real bank rail to settle against, the sender's leg is
  credited to a platform-owned "External Settlement — Demo" `LedgerAccount`
  instead of a recipient account — the same pattern as a withdrawal,
  conceptually. Carries a flat demo fee; `own_account` and
  `internal_beneficiary` transfers are free.

The fee/balance math itself lives in `features/banking/transfer-pricing.ts`,
deliberately split out from `transfers.ts` (which imports the Prisma
client at module scope) so it stays unit-testable without a live database
— `tests/unit/transfer-fee.test.ts` exercises it directly.

Both `own_account` and `internal_beneficiary` transfers post two
`Transaction` rows sharing one `ledgerGroupId` — one DEBIT for the sender,
one CREDIT for the recipient (a different user, except when transferring
between your own two accounts) — which is why `Transaction.transferId` is
not unique: one `Transfer` can have up to two `Transaction` rows pointing
at it. `external_beneficiary` transfers only ever produce the sender's
DEBIT row, since there's no FHT-side recipient.

## Step-up authentication: two different mechanisms, two different triggers

- **Adding a beneficiary** requires re-entering your **password**
  (`beneficiaryCreateSchema.currentPassword`). Editing a nickname or
  toggling favourite on an already-vetted beneficiary does not re-prompt —
  the sensitive moment is adding a new payment destination, not adjusting
  metadata on one already vetted.
- **Confirming a transfer** requires a **transaction PIN**
  (`lib/auth/transaction-pin.ts`, Argon2id-hashed like the account
  password). This is deliberately a different secret than the login
  password — the spec's "MFA or transaction PIN for sensitive actions"
  resolves to PIN specifically for money movement, keeping MFA scoped to
  login. A user with no PIN set cannot transfer at all
  (`createTransfer` throws `PIN_NOT_SET`); the UI routes them to
  `/security` to set one first.

## CSRF: double-submit cookie

Implemented in `lib/auth/csrf.ts`. A random token is set as a *readable*
(non-HTTP-only) cookie the moment a session exists (`ensureCsrfCookie`,
called from `finalizeLogin` and the `(platform)` layout). Every mutating
banking route (`POST /api/transfers`, `POST/PATCH/DELETE
/api/beneficiaries*`, `POST /api/security/transaction-pin`) requires that
same value echoed back in an `X-CSRF-Token` header — `lib/utilities/
api-client.ts`'s `postJson`/`patchJson`/`deleteJson` attach it
automatically by reading the cookie client-side. A cross-site attacker's
browser will send the cookie automatically but cannot read it to forge
the header, so a forged request always fails the comparison. This is
independent of session-cookie validation — CSRF failure and
"unauthenticated" are checked and reported separately.

## Idempotency in practice

`createTransfer` takes a client-supplied `Idempotency-Key` header,
namespaces it as `${userId}:${key}` (so two different users can never
collide on the same raw key), and checks for an existing `Transfer` with
that key *before* doing any work. If a concurrent duplicate request still
races past that check, the DB's `idempotencyKey @unique` constraint
rejects the second insert and `withIdempotentFallback`
(`lib/ledger/idempotency.ts`) recovers the original record instead of
surfacing an error. The transfer wizard generates one key per wizard
session (`crypto.randomUUID()`, held in a ref) — retrying the same
review-and-confirm without changing any input safely returns the original
result rather than double-transferring.

## Onboarding funds real ledger postings, not a fake balance

`features/authentication/provision-accounts.ts` creates a new user's
`BankAccount`s and `CryptoWallet` and then posts *actual* balanced
`LedgerEntry` rows crediting the account/wallet from a platform-owned
"Demo Funding Pool" `LedgerAccount` (seeded per-asset in `prisma/seed.ts`,
looked up via `lib/ledger/platform-accounts.ts`). This exercises the same
`postLedgerEntries` atomicity/balance-checking path that every later
financial feature (transfers, trading, conversion) will use — onboarding
isn't a special case that bypasses the ledger, it's the first real caller
of it.

## Crypto: the platform is always the counterparty

There is no real order matching. Every simulated trade fills against a
platform-owned ledger account, not another user's order — see
`features/crypto/trading.ts`. A market BUY posts:

```
DEBIT  user's quote-asset ledger account (e.g. USDT)     notional
CREDIT platform "Crypto Trading Settlement (USDT)"       notional
DEBIT  platform "Crypto Inventory (BTC)"                 quantity
CREDIT user's base-asset ledger account (BTC)             quantity − fee
CREDIT platform "Fee Revenue (BTC)"                       fee
```
(a SELL mirrors this with the base/quote roles swapped). The fee is
charged in whichever asset the user *receives* — base asset for a BUY,
quote asset for a SELL — matching common exchange convention. All of the
actual math (fill price from the ticker's bid/ask, notional, 0.1% fee) is
pure and lives in `features/crypto/trading-pricing.ts`, split out from
`trading.ts` (which imports Prisma) for the same testability reason as
`features/banking/transfer-pricing.ts`.

**Limit orders reserve funds, then fill lazily.** Placing a limit order
immediately moves the required balance from `available` to `locked` —
visible in the `/wallets` table — so it can't be double-spent by another
action while the order is open. There is no persistent background worker
checking prices every second (Next.js's serverless-friendly deployment
model has no always-on process for that); instead,
`evaluateAndFillOpenOrders` runs opportunistically at the start of
`GET /api/orders` and the `/trade` and `/wallets` page loads. A limit
order fills the next time the market is checked *for that user*, not the
instant the price crosses it — a deliberate, documented MVP trade-off,
not a hidden gap.

## Convert: USDT as the settlement hub

The MVP converter only supports pairs where one side is USDT (BTC→USDT,
USDT→ETH, etc.) — not direct BTC→ETH. `getUsdtPrice` in
`features/crypto/convert.ts` prices every asset off its `*USDT` Bybit
pair (USDT itself is defined as 1:1), so the conversion rate between any
two supported assets is always derivable without needing every pairwise
market to exist. A `ConversionQuote` is time-boxed (30s) and single-use
(`consumedAt`); executing it posts the same kind of platform-counterparty
ledger legs as a trade, against "Crypto Inventory" (or "Crypto Trading
Settlement" for the USDT leg specifically) and a fee-revenue account in
the *received* asset.

## Bybit integration: REST is authoritative, WebSocket is a bonus

`lib/bybit/client.ts` is the only thing that calls Bybit's REST API —
cached (short TTL, `lib/bybit/cache.ts`), retried with jittered
exponential backoff, and behind a circuit breaker that stops attempting
real calls for 30s after 3 consecutive failures. Every function falls
back to `lib/bybit/mock-data.ts` on any failure (network error, malformed
response, open circuit), so a Bybit outage degrades to "stale demo
prices," never a broken page. PLT/USDT never calls Bybit at all — it's a
fictional token and always uses mock data.

`lib/bybit/websocket.ts` connects **directly from the browser** to
Bybit's public spot stream, not proxied through an FHT server route. This
is a deliberate deviation from the "Browser → FHT market-data service →
Bybit" diagram in the product spec: Bybit's public topics need no
authentication, and Next.js's serverless-friendly request/response model
has no long-running process to hold a persistent upstream WebSocket open
and fan it out to many browsers the way a traditional always-on server
could. Every incoming WS message is still passed through the *same*
`normaliseTicker` function the server uses (`lib/bybit/use-live-ticker.ts`),
so the UI never depends on Bybit's raw payload shape regardless of
transport — only the transport changed, not the data-ownership boundary.
Polling (`GET /api/markets/:symbol` every 8s) is the reliable baseline
that runs regardless; the WebSocket is purely a faster-update bonus layered
on top, satisfying "fall back to periodic REST polling if WebSocket is
unavailable" by construction rather than by explicit fallback-detection
logic. A dedicated market-data fan-out service is the natural next step
if FHT ever needs the fully-proxied architecture — e.g. to add private
streams, which *do* require server-side signing and must never run in
the browser.

## Withdrawals: immediate ledger impact, status-gated completion

Unlike a limit order (which reserves funds in a separate `locked` field),
a withdrawal debits the user's `available` balance/`balanceCache`
*immediately* and posts its ledger legs at request time regardless of
whether it ends up `COMPLETED` or `PENDING` review
(`features/treasury/withdrawals.ts`). `BankAccount` has no `locked`
field the way `AssetBalance` does, so rather than add one purely for
this one case, withdrawals use the simpler, arguably more realistic
pattern real banks use: the money already looks "gone" from the
customer's available balance the moment they submit the request, win or
lose. A `PENDING` withdrawal rejected by an administrator receives a
separate, balanced `WithdrawalReversal` ledger group: settlement and fee
revenue are debited while the customer's ledger account is credited for
both principal and fee. The original posting is retained unchanged for
auditability; no balance is ever edited without its corresponding ledger
posting.

**The review threshold is a USD-equivalent estimate, not a live FX
lookup.** `estimateUsdValue` uses hardcoded approximate rates for fiat
(`FIAT_USD_APPROX_RATE`) and the real Bybit-backed ticker price for
crypto. This is a demo-grade risk gate, not a compliance-grade valuation
— documented as such in the code, not presented as more precise than it
is.

## Cards, notifications, and security settings: read/write over existing models

None of Phase 5's remaining surface needed schema changes — `Card`,
`CardTransaction`, `Notification`, `TrustedDevice`, `Session`, and
`LoginEvent` were all already fully specified in the Phase 1 schema,
written to by earlier phases (e.g. every login already created a
`LoginEvent` and, for a new device, a `Notification`), just never
exposed through their own UI until now. Requesting a demo card seeds a
handful of fictional sample `CardTransaction` rows purely so the card
doesn't render as an empty, lifeless demo the instant it's issued — an
explicitly cosmetic touch, not simulated real spending activity.

`revokeAllOtherSessions` needed one small addition to
`lib/auth/session.ts`: `getCurrentSessionId()`, a lightweight lookup
(just the session ID, not the full user) so "sign out everywhere else"
can exclude the caller's own active session without duplicating
`getCurrentUser`'s heavier query.
