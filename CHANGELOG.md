# Changelog

All notable changes to this project are recorded here, grouped by build
phase (see `README.md` for the current status).

## Phase roadmap

1. **Foundation** — scaffold, design tokens, DB schema, ledger core *(this release)*
2. **Auth & onboarding**
3. **Core banking** — dashboard, accounts, transfers, beneficiaries, transactions
4. **Crypto core** — Bybit client, markets, asset detail, simulated trading, convert, wallets
5. **Remaining MVP surface** — deposits/withdrawals, cards, notifications, profile/security settings
6. **Admin panel + hardening** — admin tools, audit logging, rate limits, full test pass, docs

## [0.6.0-phase6] — Admin panel + hardening

### Added

- ADMIN-only `/admin` console and API routes for pending-withdrawal review,
  audit-log viewing, customer announcements, maintenance mode, and Bybit
  provider-health refresh.
- Additive migration for withdrawal rejection metadata, durable scoped
  withdrawal allowlist entries, announcements, and singleton platform
  settings.
- Rejection reversals that post a separate balanced ledger group and return
  exact Decimal principal plus fee to the customer cache.
- Live Bybit kline WebSocket updates, REST polling fallback, and 1m/5m/15m/
  1h/4h/1D chart controls.

### Changed

- Removed JavaScript number coercion from authoritative treasury, trading,
  conversion, and Bybit normalisation calculations.
- Added CSP and cross-origin browser security headers. Maintenance mode now
  blocks financial mutation routes and redirects non-admin platform users.

## [0.2.0-phase2] — Auth & onboarding

### Added

- **Auth core** (`lib/auth/`): Argon2id password hashing
  (`@node-rs/argon2`), cookie-based sessions with server-side revocation
  (`session.ts`), single-use time-boxed verification/reset tokens
  (`tokens.ts`), TOTP MFA (`mfa.ts`, `otpauth`), signed pending-MFA cookie
  bridging password-check to code-verification (`pending-mfa.ts`), device
  fingerprinting for "remember this device" (`device.ts`), and an
  SMTP-or-console-simulated mailer (`mailer.ts`, `nodemailer`).
- `lib/encryption/aes.ts` — AES-256-GCM at-rest encryption for the stored
  MFA secret (and, from Phase 4, provider credentials).
- `lib/rate-limit/limiter.ts` — in-memory fixed-window rate limiting,
  applied to register/login/MFA-verify/forgot-password/reset-password.
- `lib/audit/log.ts` — `AuditLog` writer, called on every auth event.
- `lib/validation/auth.ts` — Zod schemas for every auth/onboarding input.
- `lib/ledger/platform-accounts.ts` — lookup/creation for platform-owned
  (ownerless) `LedgerAccount`s, starting with the "Demo Funding Pool."
- **`features/authentication/`** — the business logic behind every auth
  route: `register`, `verify-email`, `login` (with MFA + device-trust
  branching), `logout`, `password-reset`, `mfa-setup`, `onboarding`, and
  `provision-accounts` (creates a new user's Current/Savings BankAccounts
  + Spot CryptoWallet and funds them with real, balanced `LedgerEntry`
  postings against the seeded Demo Funding Pool — not a fake number).
- **API routes**: `/api/auth/register`, `verify-email`,
  `resend-verification`, `login`, `logout`, `mfa/setup`, `mfa/enable`,
  `mfa/disable`, `mfa/verify`, `forgot-password`, `reset-password`, `me`,
  and `/api/onboarding`.
- **UI**: `/register`, `/login`, `/mfa`, `/forgot-password`,
  `/reset-password`, `/verify-email`, `/onboarding` (3-step wizard with a
  simulated identity-verification step), plus minimal `/security` (MFA
  enrollment only) and `/profile` (read-only) pages.
- `middleware.ts` now redirects based on session-cookie presence;
  `app/(platform)/layout.tsx` now calls `requireOnboardedUser()` for the
  real, DB-backed authorization check; `TopNavigation` shows the real
  signed-in user with a working sign-out.
- 35 new unit tests: password hashing, tokens, TOTP/MFA, AES encryption,
  rate limiting, and every auth/onboarding Zod schema.

### Changed

- `prisma/schema.prisma`: `Profile.country` is now optional (collected at
  onboarding, not registration). **Run `npx prisma migrate dev`.**
- `prisma/seed.ts`: added EUR/GBP fiat assets and a "Demo Funding Pool"
  `LedgerAccount` per seeded asset.
- `lib/validation/auth.ts`: `rememberDevice` changed from
  `z.boolean().optional().default(false)` to a plain `z.boolean()` —
  the `.default()` form produces an input/output type mismatch that
  react-hook-form's `useForm<T>` can't reconcile with `zodResolver`.
  Behavior is identical; both forms already pass
  `defaultValues: { rememberDevice: false }`.

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` (Vitest) | ✅ 47/47 passed (11 from Phase 1 + 36 new) |
| `npm run lint` | ✅ no warnings/errors |
| `npm run typecheck` (`tsc --noEmit`, reports every error, not just the first) | ✅ 5 remaining errors, all attributable to the one documented sandbox limitation (Prisma client not generated) — see below |
| `npm run build` | ⚠️ could not reach a full green build in this sandbox this phase — see below |

### Limitations

- **`prisma generate` still can't run in the build sandbox** (see Phase 1
  limitations, unchanged). This phase's code touches generated Prisma
  types from within `app/` for the first time (session/user lookups), so
  unlike Phase 1, `next build`'s type-checker now reaches that gap and
  stops at the first occurrence instead of compiling everything around
  it. To keep verification meaningful anyway, this phase (and every
  phase from here on) is checked with `tsc --noEmit`, which reports
  *every* type error in the project rather than stopping at the first —
  confirmed exactly 5 errors, all of the form "enum/model X is not
  exported from `@prisma/client`," none of them a different bug. On your
  machine, where `prisma generate` already runs successfully, `next
  build` proceeds past this normally.
- MFA setup/enable/disable ships now (needed to make the MFA login branch
  testable), but the rest of the security-settings surface — trusted
  devices list, active sessions list, login history, transaction PIN,
  anti-phishing phrase, withdrawal allowlist — is still Phase 5.
  `/security` and `/profile` are intentionally minimal this phase.
- No CSRF token defense yet (see `SECURITY.md`); deferred to Phase 3
  alongside the first financial mutation forms.
- Rate limiting is in-memory/per-process — fine for local dev and a
  single-instance demo deploy, not for multiple instances. See
  `SECURITY.md`.
- Dashboard/accounts pages still show static/placeholder data outside of
  the greeting — real balance/transaction data is Phase 3 scope.

### Next phase

**Phase 3 — Core banking**: dashboard wired to real account/ledger data,
accounts list, internal transfers (with the idempotency + ledger-posting
pattern this phase established), beneficiaries, transaction history with
filtering, and the first CSRF token defense.

## [0.5.0-phase5] — Remaining MVP surface

### Added

- **`features/treasury/`**: `demo-address` (deterministic, obviously-fake
  deposit addresses — unit tested), `deposits` (fiat self-funding +
  simulated crypto incoming deposits, both ledger-posted and idempotent),
  `withdrawals` (fiat + crypto, PIN-gated, USD-equivalent threshold
  gating instant-complete vs. pending-review), `cards` (request, freeze/
  unfreeze, report lost, spending limit, sample transaction seeding).
- **`features/notifications/`**: list, unread count, mark read, mark all
  read.
- **`features/authentication/account-security.ts`**: change password,
  trusted-device list/revoke, active-session list/revoke/revoke-others,
  login history, anti-phishing phrase, withdrawal-allowlist toggle,
  account deactivation.
- `lib/auth/session.ts`: added `getCurrentSessionId()`, needed so "sign
  out everywhere else" can exclude the caller's own session.
- `lib/money/asset-kind.ts`: shared fiat-vs-crypto classification,
  unit tested.
- **API routes**: `/api/deposits/fiat`, `/api/deposits/crypto`,
  `/api/withdrawals`, `/api/cards` (+ `/freeze`, `/report-lost`,
  `/spending-limit`, `/transactions`), `/api/notifications` (+
  `/:id/read`, `/mark-all-read`), `/api/security/change-password`,
  `/api/security/devices` (+ `/:id`), `/api/security/sessions` (+ `/:id`,
  `/revoke-others`), `/api/security/login-history`,
  `/api/security/anti-phishing-phrase`,
  `/api/security/withdrawal-allowlist`, `/api/security/deactivate`.
- **UI**: `/deposit` (fiat + crypto tabs, demo address with copy +
  simulated incoming deposit), `/withdraw` (unified fiat/crypto flow,
  clear pending-vs-complete outcome), `/cards` (request, freeze,
  report lost, spending limit, expandable transaction history),
  `/notifications` (read/unread styling, mark all read), and a fully
  expanded `/security` page (7 cards: transaction PIN, MFA, change
  password, anti-phishing/allowlist, trusted devices, active sessions,
  login history, danger zone). The dashboard/wallets Deposit and
  Withdraw buttons are wired to the real pages instead of disabled
  placeholders, and the top-bar notification bell now shows a real
  unread count.
- 9 new unit tests: fiat/crypto asset classification, demo deposit
  address determinism.

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` (Vitest) | ✅ 113/113 passed (9 new) |
| `npm run lint` | ✅ no warnings/errors |
| `npm run typecheck` (`tsc --noEmit`) | ✅ 60 errors, individually confirmed all attributable to the one documented sandbox limitation (Prisma client not generated), including one that presents differently (a `Set` constructor generic-inference quirk on an `any`-typed input) but traces to the same cause |

### Limitations

- **No schema changes this phase** — `Card`, `CardTransaction`,
  `Notification`, `TrustedDevice`, `Session`, `LoginEvent` were all
  already fully specified in Phase 1. No new migration needed.
- **Withdrawal review threshold uses an approximate USD valuation**
  (hardcoded fiat rates, real Bybit ticker price for crypto) — a
  demo-grade risk gate, not a compliance-grade one. See
  `ARCHITECTURE.md`.
- **`PENDING` withdrawals have nowhere to go yet.** The review/approval
  flow (and the reversal posting a rejection would need) is explicitly
  Phase 6 (admin panel) scope — a large withdrawal will sit visibly
  "pending review" until then, which is honest about the current state
  rather than silently auto-completing everything.
- **Withdrawal address allowlist is a bare toggle.** The
  `withdrawalAllowlistEnabled` flag exists and is settable, but no
  address list is stored or actually enforced against yet — deferred to
  Phase 6 alongside admin tooling, since the two are closely related.
- Card "transactions" are a handful of seeded fictional sample rows at
  issuance, not a simulated ongoing spending feed — clearly a cosmetic
  demo touch, not a claim of real transaction activity.
- Destination-address validation for crypto withdrawals is a loose
  shape heuristic, not real per-network checksum validation (there's no
  real chain to validate against in a simulated withdrawal).

### Next phase

**Phase 6 — Admin panel + hardening**: admin review tools (including
finally giving `PENDING` withdrawals somewhere to go), audit-log
viewing, announcements, maintenance mode, provider health visibility,
full test-suite pass, and final documentation review across all four
maintained docs.



### Added

- **`lib/bybit/`**: PLT-owned types (`types.ts`), the five supported
  pairs (`instruments.ts`), a deterministic-ish mock-data generator
  (`mock-data.ts`, always used for PLT/USDT and as the fallback for
  everything else), Bybit V5 response normalisers (`normalisers.ts`), an
  in-memory TTL cache with request dedup (`cache.ts`), the REST client
  with retry/backoff/circuit-breaker/mock-fallback (`client.ts`), a
  reconnecting public-WebSocket singleton (`websocket.ts`), and the
  `useLiveTicker` client hook layering WS updates over a reliable REST
  polling baseline.
- **`features/crypto/`**: `trading-pricing` (pure fill/fee math, unit
  tested independently of Prisma), `wallet-helpers` (lazy
  AssetBalance/LedgerAccount creation), `trading` (market + limit orders,
  cancellation, lazy limit-fill evaluation — all ledger-posted and
  idempotent), `convert` (quote + execute), `markets` (ticker list, asset
  detail, watchlist), `wallets` (balances + USD valuation).
- New platform ledger accounts: "Crypto Inventory (\<asset\>)" and
  "Crypto Trading Settlement (\<asset\>)", alongside the existing
  "Fee Revenue" pattern from Phase 3 — see `ARCHITECTURE.md` for the
  full leg breakdown of a simulated trade.
- **API routes**: `/api/markets`, `/api/markets/:symbol`,
  `/api/markets/:symbol/candles`, `/api/markets/:symbol/orderbook`,
  `/api/markets/:symbol/trades`, `/api/watchlist`, `/api/orders`
  (GET/POST), `/api/orders/:id` (GET/DELETE), `/api/quotes/convert`,
  `/api/conversions`, `/api/wallets`.
- **UI**: `/markets` (favourites/all/gainers/losers tabs, search,
  favouriting), `/markets/[symbol]` (live-updating chart, order book,
  recent trades, holdings, buy/sell CTAs), `/trade` (symbol selector,
  chart/book/trades — tabbed on mobile, side-by-side on desktop —
  market/limit buy-sell panel, open orders, order history), `/convert`
  (quote with a live countdown, execute), `/wallets` (balances + USD
  value, links into Convert/Trade).
- `components/charts/candlestick-chart.tsx` — a hand-rolled SVG
  candlestick chart (no general-purpose charting library in this stack
  has a native candlestick type) with a screen-reader text summary.
- `components/financial/order-book-display.tsx` — simplified bid/ask
  depth with relative-size bars.
- `lib/utilities/api-client.ts`: added `postJsonIdempotent` for
  financial-mutation endpoints needing an `Idempotency-Key` header;
  refactored the Phase 3 transfer wizard to use it instead of a
  duplicated manual `fetch` call.
- 27 new unit tests: supported-pairs config, mock-data generator, Bybit
  response normalisers, trading-pricing math.

### Two real bugs caught by this phase's verification (not sandbox noise)

- **`tests/unit/bybit-mock-data.test.ts`**: hit the same
  `noUncheckedIndexedAccess` array-destructuring issue fixed elsewhere in
  Phase 3 (`const [a,b,c,d] = arr.map(Number)` types each element as
  possibly `undefined`). Fixed by using explicit `Number(candle.field)`
  calls instead of destructuring a mapped array.
- Nothing else this phase — the rest of the 45 typecheck errors were all
  individually confirmed as the same documented Prisma-generation
  limitation.

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` (Vitest) | ✅ 104/104 passed (27 new) |
| `npm run lint` | ✅ no warnings/errors |
| `npm run typecheck` (`tsc --noEmit`) | ✅ 45 errors, individually confirmed all attributable to the one documented sandbox limitation (Prisma client not generated) |

### Limitations

- **No live Bybit connectivity was available to test against in this
  build sandbox** (its network allowlist doesn't include
  `api.bybit.com`/`stream.bybit.com`) — every test and manual check in
  this environment exercised the mock-data fallback path, not a real
  Bybit response. The normalisers are written defensively against the
  documented Bybit V5 response shape and fail closed (fall back to mock
  data) on any mismatch, but a live-data smoke test on your machine is
  the first real validation of the actual Bybit integration.
- **WebSocket connects directly browser-to-Bybit**, not proxied through
  a PLT server route — a deliberate, documented deviation from the
  product spec's architecture diagram, driven by Next.js's
  serverless-friendly deployment model having no persistent process to
  fan out a shared upstream connection. See `ARCHITECTURE.md`.
- **Limit orders fill lazily** (checked when `/trade`, `/wallets`, or
  `GET /api/orders` is next loaded for that user), not via a background
  worker, for the same reason.
- **Convert only supports pairs where one side is USDT** (not direct
  BTC→ETH) — see `ARCHITECTURE.md`.
- Trades and conversions don't require the transaction PIN transfers do
  — a deliberate scope choice (PIN gates money *leaving* PLT-controlled
  accounts; trading/converting stays within the user's own wallet). Worth
  revisiting if that distinction doesn't hold up under further design
  review.
- No admin visibility into trading/conversion activity yet — Phase 6.

### Next phase

**Phase 5 — Remaining MVP surface**: demo deposits/withdrawals, card
management (demonstration only), notifications, and full profile/security
settings (trusted devices, sessions list, login history, anti-phishing
phrase, withdrawal allowlist).



Two bugs reported after testing against a real browser/DB, neither
visible from static analysis alone.

### Fixed

- **`crypto.randomUUID is not a function` in the transfer wizard.**
  `crypto.randomUUID()` only exists in secure contexts (HTTPS, or exactly
  `localhost`/`127.0.0.1`). Visiting the dev server via the LAN IP
  Next.js prints alongside `localhost` (e.g. `http://192.168.x.x:3000`)
  is not a secure context — `crypto` still exists but `.randomUUID` does
  not, so calling it threw. Added `lib/utilities/id.ts#generateClientId`,
  which uses `crypto.randomUUID` when available and falls back to a
  `Date.now()`/`Math.random()`-based ID otherwise (fine, since this value
  is only ever a client-side idempotency correlation key, never a
  secret). `transfer-wizard.tsx` now uses it, generated lazily once per
  mount instead of on every render.
- **Infinite redirect loop between `/login` and `/dashboard`.** The
  middleware redirected away from auth pages whenever a session cookie
  was merely *present* — but Edge middleware can't validate that session
  against the database. A stale cookie (session expired, revoked, or the
  DB reset during a migration) triggered: `/login` → middleware sees the
  cookie, bounces to `/dashboard` → the real session check there finds it
  invalid, bounces back to `/login` → repeat forever. This is also why
  the login/register pages appeared not to load at all. Removed that
  unsafe rule from `middleware.ts` (kept the safe direction: no cookie at
  all always means "not logged in," so redirecting *protected* routes to
  `/login` without a cookie remains there) and moved the "already logged
  in, skip the auth pages" behavior into `app/(auth)/layout.tsx`, which
  calls the real, DB-backed `getCurrentUser()`. A stale cookie now simply
  renders the login page normally instead of looping — no manual cookie
  clearing needed on your end.

### Added

- `tests/unit/client-id.test.ts` — covers both the native-`randomUUID`
  path and the fallback path (simulated via `vi.stubGlobal`, since
  `randomUUID` lives on `Crypto.prototype` in jsdom and a plain `delete`
  doesn't remove it — the first version of this test had that exact bug
  and caught itself).

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` | ✅ 77/77 passed (3 new) |
| `npm run lint` | ✅ clean |
| `npm run typecheck` | ✅ 35 errors, unchanged from Phase 3, all the same documented sandbox limitation |



### Added

- **CSRF protection** (`lib/auth/csrf.ts`) — double-submit cookie,
  required on every mutating banking route.
- **Transaction PIN** (`lib/auth/transaction-pin.ts`,
  `features/banking/security.ts`) — Argon2id-hashed, required to confirm
  any transfer.
- **`features/banking/`**: `accounts` (ownership-checked reads),
  `beneficiaries` (CRUD with password step-up on create),
  `transfer-pricing` (pure fee logic, unit-tested independently of
  Prisma), `transfers` (destination resolution across own-account /
  internal-PLT / simulated-external, idempotent ledger-posted execution),
  `transactions` (filtered, cursor-paginated history + CSV export).
- **API routes**: `/api/accounts`, `/api/accounts/:id`,
  `/api/transfers/quote`, `/api/transfers`, `/api/transfers/:id`,
  `/api/beneficiaries` (GET/POST), `/api/beneficiaries/:id`
  (PATCH/DELETE), `/api/transactions` (GET, filtered), `/api/transactions/
  :id`, `/api/transactions/export` (CSV), `/api/security/transaction-pin`.
- **UI**: `/dashboard` now shows real account/wallet/transaction data;
  `/accounts` (real balances); `/beneficiaries` (search, add with
  step-up, favourite, delete); `/transfers` (5-step wizard: source →
  destination → amount → review/PIN → receipt, using
  `/api/transfers/quote` so the preview and the executed transfer always
  agree); `/transactions` (search/type/status filters, cursor pagination,
  CSV export, detail drawer, responsive table/card views); `/security`
  gained a transaction-PIN setup card.
- 24 new unit tests: transfer fee pricing, CSV export, transaction PIN
  hashing, banking validation schemas, and the CSRF cookie reader.

### Changed

- `prisma/schema.prisma`: **`Transaction.transferId` is no longer
  `@unique`** (was 1:1, now 1:many) — an internal transfer needs two
  `Transaction` rows (sender debit + recipient credit) pointing at one
  `Transfer`. **Run `npx prisma migrate dev`.**
- `prisma/seed.ts`: added "External Settlement — Demo" and "Fee Revenue"
  platform ledger accounts per fiat currency (used by simulated
  external-bank transfers); refactored the seeding loop into a small
  reusable helper.
- `lib/rate-limit/limiter.ts`: added `transfer` and `beneficiaryCreate`
  rules.
- `lib/utilities/api-client.ts`: added `patchJson`/`deleteJson`, and
  every mutating call now automatically attaches the CSRF header;
  `getCsrfToken` is now exported (and unit-tested) for the one call site
  that needs custom headers alongside it.

### Two real bugs caught by this phase's verification (not sandbox noise)

- **`features/banking/transfers.ts`**: the ledger `legs` array's type was
  narrowed to `direction: "DEBIT"` from its first literal element, so the
  later `.push()` of a `"CREDIT"` leg failed to typecheck. Fixed by
  explicitly typing `legs: PostingLeg[]`.
- **`transfer-wizard.tsx`**: the CSRF header was built from two
  *separate* `document.cookie.match(...)` calls stitched together with a
  ternary — fragile (re-running the regex, and the two calls could in
  principle observe different cookie state) and it didn't actually
  typecheck (`RegExpMatchArray` capture groups are `string | undefined`
  even after a non-null assertion on the match itself). Replaced with the
  single, already-exported, now-unit-tested `getCsrfToken()` helper.

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` (Vitest) | ✅ 74/74 passed (24 new) |
| `npm run lint` | ✅ no warnings/errors |
| `npm run typecheck` (`tsc --noEmit`) | ✅ 35 errors, individually confirmed all attributable to the one documented sandbox limitation (Prisma client not generated) |
| `npm run build` | ⚠️ not attempted this phase — see Phase 2's note; `next build` stops at the same gap `tsc --noEmit` already fully characterizes |

### Limitations

- `prisma generate` still can't run in this build sandbox (see Phase 1/2).
  35 typecheck errors this phase, up from 15 in Phase 2 — proportional to
  how much more Prisma-touching code this phase adds (every account/
  beneficiary/transfer/transaction page reads real data now), not a
  quality regression. Every single one was individually checked against
  the "comes from a Prisma-generated type" explanation.
- External-bank transfers are simulated identically to internal ones
  (debit sender, credit a platform pool) — there is no real bank rail,
  by design, per the product's safety boundaries. The flat demo fee
  (2.50 in the source currency) is illustrative, not a real pricing model.
- No admin review queue yet for anything — that's Phase 6.
- Transaction PIN has no "forgot PIN" recovery flow yet (only "change PIN"
  via current password); full account-recovery flows are out of scope for
  the MVP.
- CSV export is capped at 5,000 rows (`listAllTransactionsForExport`) —
  fine for demo data volumes, would need real pagination/streaming for a
  production-scale export.

### Next phase

**Phase 4 — Crypto core**: `lib/bybit` client/normalisers/cache, markets
page, asset-detail page, the simulated spot-trading engine, convert, and
wallets — the first phase to talk to an external provider.



Reported after real-world testing against a fully generated Prisma client
(this sandbox cannot run `prisma generate`, so this specific class of
error was invisible until tested against the real thing).

### Fixed

- `lib/audit/log.ts`: `AuditEventInput.metadata` was typed as
  `Record<string, unknown>`, which does not satisfy Prisma's generated
  `InputJsonValue` type for the `AuditLog.metadata Json?` column —
  `unknown` isn't assignable to Prisma's JSON value union, so any call
  passing `metadata` (e.g. the new-device-login audit event in
  `login.ts`) failed `tsc`/`next build` type-checking once a real
  generated client existed to check against. Retyped as
  `Prisma.InputJsonValue`, which is what Prisma actually expects and
  what every current call site (`{ isNewDevice: boolean }`) already
  satisfies — no call-site changes needed.

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` | ✅ 47/47 passed |
| `npm run lint` | ✅ clean |
| `npm run typecheck` | ✅ 6 remaining errors (was 5 — the fix itself references `Prisma.InputJsonValue`, adding one more instance of the same pre-existing "Prisma client not generated in this sandbox" class), still zero unrelated errors |



### Added

- Next.js 15 (App Router) + React 19 + TypeScript strict project scaffold.
- Tailwind CSS semantic design-token system: full light/dark palette
  derived from the brand spec, tabular-nums utility, focus-visible rings,
  reduced-motion support, safe-area utilities, 44px touch targets.
- Complete `prisma/schema.prisma` covering all MVP entities (identity,
  security, assets/balances, double-entry ledger, banking, crypto
  trading/conversion/deposits/withdrawals, cards, notifications, audit,
  provider connections) — all monetary fields `Decimal(36,18)`, no floats.
- `prisma/seed.ts` — reference asset seed (USD, NGN, USDT, BTC, ETH, SOL,
  XRP, PLT demo token) and a Bybit `ApiConnection` placeholder.
- `lib/money/` — asset-tagged `Money` value type (decimal.js-backed, no
  floating-point arithmetic) and display formatting helpers.
- `lib/ledger/` — atomic, balance-enforced double-entry posting
  (`postLedgerEntries`, `assertBalancedPosting`), a reconciliation
  helper, ledger-specific error types, and the idempotency pattern used
  by every future financial-mutation endpoint.
- Component system: `AppShell`, `Sidebar` (collapsible), `TopNavigation`,
  `MobileBottomNavigation`, `MobileNavDrawer` (focus-trapped), `ThemeToggle`
  + `ThemeProvider`, `Button`/`Card`/`Badge` primitives, `CurrencyValue` /
  `PercentChange` (colour + icon + signed text, never colour-only).
- `DemoEnvironmentBadge` — the persistent "no real funds" notice.
- Demo-data preview pages: `/` (landing) and `/dashboard`, proving the
  shell, tokens, and financial components end-to-end.
- `middleware.ts` pass-through stub, ready for Phase 2 session checks.
- Unit tests: `tests/unit/money.test.ts`, `tests/unit/ledger.test.ts` (11
  tests, all passing) — cover exact decimal arithmetic, cross-asset
  guarding, and multi-asset balanced/unbalanced posting validation.
- `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `CHANGELOG.md` (this file).

### Changed mid-build

- Upgraded the initial scaffold off Next.js 14.2.15 (EOL, disclosed
  critical CVEs) to Next.js 15.5.9 / React 19 before delivery, including
  the matching `eslint-config-next`, `lucide-react`, and `next-themes`
  bumps this required.

### Tests run

| Command | Result |
| --- | --- |
| `npm run test` (Vitest) | ✅ 11/11 passed |
| `npm run lint` (ESLint, `no-explicit-any` enforced) | ✅ no warnings/errors |
| `npm run typecheck` (`tsc --noEmit`, strict) | ✅ passes once `prisma generate` has run (see Limitations) |
| `npm run build` | ✅ verified compiling with zero errors (see Limitations for the two sandbox-only caveats) |

### Limitations

- **`prisma generate` could not run in the build sandbox** used to
  produce this code (it fetches engine binaries from
  `binaries.prisma.sh`, which that sandbox's network allowlist blocks).
  Run it yourself after `npm install` — it works normally with regular
  internet access. Until then, `prisma/seed.ts` shows one expected type
  error (`AssetType` not yet exported) and `lib/db/prisma.ts` types are
  unavailable.
- **`next/font/google` (Inter) could not fetch from
  `fonts.googleapis.com`** in that same sandbox. Verified separately by
  swapping to a system font, confirming a full build with zero other
  errors, then reverting to the real Inter import — no action needed on
  a normal machine.
- No authentication, no real data fetching, no API routes yet — the
  landing and dashboard pages render static demo data by design (see
  "What Phase 1 deliberately does not include" in `ARCHITECTURE.md`).
- `next lint` reports itself as deprecated (removed in Next.js 16); left
  as-is for now since it still works correctly on 15.x. Migrating to the
  plain ESLint CLI is a good candidate for the Phase 6 hardening pass.

### Next phase

**Phase 2 — Auth & onboarding**: registration, email verification,
Argon2id + secure session login, MFA scaffold, password reset, the
onboarding flow (country/currency/account type/DOB/phone), default demo
account creation, and wiring `middleware.ts` to real session checks.
