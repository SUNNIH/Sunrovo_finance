# FISE HOLDINGS TRUST BANK (FHT) — AGENT RULES

## Project Identity

FISE HOLDINGS TRUST BANK (FHT) is an original digital banking application with a limited retained digital-asset wallet/deposit capability.

FHT is not a crypto exchange and must not be treated as a Bybit clone.

Current management/HR direction is to REMOVE the exchange/trading crypto surface while RETAINING only:

- Crypto wallet balances
- Crypto deposit addresses
- Crypto deposits by address / QR code
- Crypto deposit transaction history
- Ledger/accounting support required for those retained wallet/deposit functions

The PLT token symbol may remain where it is still required by retained historical or wallet/deposit data, but do not expand PLT/crypto product scope.

Unless explicitly re-approved, remove/decommission:

- Markets
- Market-detail pages
- Trade / Buy / Sell
- Limit orders / open orders
- Convert
- Conversion quotes
- Watchlists
- Candles
- Order books
- Public trade feeds
- Live ticker/price surfaces
- Portfolio live-market valuation
- Bybit REST/WebSocket market-data integration
- Bybit mock market data
- Trading settlement/inventory product functionality
- Crypto withdrawals
- Crypto trading/market CTAs and marketing copy

Do not delete historical financial/audit data merely because a product surface is being retired.

## Active Repository Scope

The repository root is the ACTIVE application.

`phase6-review/` is historical/reference material only.

Do not modify `phase6-review/` unless explicitly instructed.
Do not use it as the implementation source of truth when root files differ.

## Source of Truth

The newest current repository files are authoritative.

Before significant changes:

1. Read this `AGENTS.md`.
2. Inspect the relevant current root code.
3. Inspect affected Prisma models/migrations.
4. Inspect relevant tests and dependencies.
5. Confirm the reported issue still exists before changing code.

When architecture or project status matters, inspect current root versions of:

- `CURRENT_PROJECT_STATE.md`
- `README.md`
- `CHANGELOG.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `package.json`
- `prisma/schema.prisma`
- `prisma/migrations/`

Do not invent functionality the repository does not contain.
Do not rewrite already-correct functionality just because an older report says it is incomplete.

## Current Stack

Preserve the existing stack unless explicitly instructed otherwise:

- Next.js 15
- React 19
- App Router
- TypeScript strict mode
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Vitest
- Existing authentication/security libraries

FHT is a feature-oriented modular monolith.
Prefer incremental modules, adapters, services, reusable components, and focused migrations.
Do not perform a broad framework rewrite.

## Current Financial Baseline

The double-entry ledger is the financial source of truth.

Never implement financial movement primarily as a direct balance edit.

Financial movement must follow the existing FHT pattern:

Request → Authentication → Authorization → Validation → Idempotency → Ledger posting → Domain/transaction record → Cache update → Notification/Audit

Every completed ledger group must satisfy, per asset:

**TOTAL DEBITS = TOTAL CREDITS**

`BankAccount.balanceCache` and `AssetBalance.available/locked` are caches, not authoritative balances.

Use Prisma Decimal, decimal.js, or existing FHT money helpers for authoritative monetary values.
Do not use `Number()` / `parseFloat()` for authoritative balances, fees, quantities, reserves, notionals, financial comparisons, or ledger/cache calculations.

## Exact Financial Ownership

Always preserve the exact financial source and destination.

Prefer persisted exact identifiers such as:

- `BankAccount.id`
- `CryptoWallet.id`
- `LedgerAccount.id`
- `ledgerGroupId`
- transaction/reference IDs

Do not later rediscover a financial source using a broad `findFirst()` query when the exact original account/wallet can be stored or recovered from the original transaction/ledger relationship.

## Idempotency and Concurrency

Every financial mutation must be idempotent and concurrency-safe.

This includes:

- Transfers
- Deposits
- Withdrawals
- Reversals/refunds
- Admin funding
- Any remaining transitional crypto financial actions until removed

A UI-generated key alone is not sufficient. Idempotency must be enforced by durable server/database logic so the same request cannot post funds twice.

Never allow duplicate ledger postings, duplicate funding, duplicate withdrawals, or duplicate refunds.

## Atomicity and Audit

Where one financial action logically includes multiple writes, keep them in the same Prisma transaction where architecture permits.

Critical financial operations should keep these logically consistent:

- State claim / optimistic lock
- Ledger posting
- Exact cache update
- Domain record update
- Transaction history
- Required audit event
- Required notification where appropriate

Do not intentionally allow money movement to commit while its mandatory audit event can fail separately.

## Current Account Provisioning

Newly provisioned users must start at zero balance.

Current intended baseline:

- Current Account → 0
- Savings Account → 0
- Spot/Digital Asset Wallet → no initial funded balances

Do not reintroduce automatic welcome credits, onboarding funding ledger postings, or welcome-deposit transactions.
Existing user balances must not be altered merely because provisioning rules changed.

## Current Admin Funding

Admin funding is an IMPLEMENTED feature, not a future-only concept.

Authorized admins fund a user's exact account/wallet through platform treasury/funding-pool ledger accounts.

Required flow:

Admin → User → Exact Account/Wallet → Asset → Amount → Reason → Confirm → Balanced treasury posting → Exact cache update → Transaction history → Audit

Rules:

- ADMIN authorization must be server-side.
- Normal users must never access admin-funding endpoints.
- Funding must not use the admin's personal Current/Savings balance as source of funds.
- Funding must be idempotent.
- Funding must preserve exact target ownership and asset compatibility.
- Never implement admin funding as an authoritative direct balance edit.

## Current Withdrawal Policy

All accepted withdrawals require administrator review.

Current intended policy:

- Minimum withdrawal = USD $100 equivalent
- Exactly $100 equivalent is allowed
- Below $100 equivalent is rejected before financial posting
- Every accepted withdrawal starts `PENDING`
- Admin approval moves it to `COMPLETED`
- Admin rejection moves it to `REJECTED` and creates the required balanced reversal/refund

As part of the current HR crypto reduction, crypto withdrawals are transitional/deprecated and should be removed from the supported product surface unless explicitly re-approved.
The retained withdrawal product after decommissioning should be fiat-only.

Rejected withdrawals must:

- Preserve the original posting
- Reverse/refund the exact originally debited account
- Refund principal and fee exactly
- Prevent duplicate reversal/refund
- Update transaction status
- Create required audit/notification records

Prefer reversing the exact original ledger group instead of reconstructing the event from broad account lookup.

## Retained Digital-Asset Wallet Scope

The retained crypto capability is deposit-and-hold only.

Keep only what is required for:

- Wallet creation/ownership
- Asset balances
- Deposit address/network metadata
- Scannable deposit QR
- Crypto deposit ledger postings
- Crypto deposit transaction history

The retained wallet must not require live market data to function.

Prefer native-unit display such as:

- `0.006027 BTC`
- `425.00 USDT`

Do not require Bybit/ticker data merely to render the wallet.
If live valuation is removed, do not replace it with fake/static market values.

The QR deposit control must encode the actual retained deposit address/network payload appropriately; a decorative QR icon is not a functional QR code.

## Crypto Decommissioning Safety Order

Do not mass-delete crypto code.

Use this safe order:

1. Establish clean Git/validation baseline.
2. Fix high-priority financial correctness blockers before broad refactoring.
3. Remove Markets/Trade/Convert/crypto-withdrawal exposure from navigation and user-facing CTAs.
4. Decouple Wallet and Crypto Deposit from Bybit/live market pricing.
5. Make retained deposit QR genuinely scannable.
6. Identify all OPEN crypto orders and safely cancel/close them, releasing locked funds back to available balance with correct provenance/auditability.
7. Disable/remove trading, conversion, market, watchlist APIs and feature modules.
8. Remove Bybit REST/WebSocket/mock/provider-health infrastructure only after no retained wallet/deposit path imports it.
9. Preserve historical completed/cancelled orders/conversions and audit/transaction data.
10. Consider destructive Prisma/schema cleanup only as a later, explicit migration after runtime references and retention requirements are verified.
11. Update docs/help/marketing/tests after code behavior is stable.

Never delete order functionality while user funds can remain locked in `AssetBalance.locked`.

## Historical Crypto Data

Historical financial records are not disposable UI state.

Initially preserve Prisma models/data needed to retain history, including where applicable:

- `CryptoOrder`
- `Conversion`
- `ConversionQuote`
- `Watchlist`
- Historical transactions
- Historical ledger entries
- Audit logs

Do not drop tables just because their runtime feature is hidden or disabled.
Any later schema deletion must use an explicit Prisma migration and must not destroy required financial/audit history.

## Bybit

Bybit is being decommissioned from the supported product surface.

Do not add new Bybit dependencies or new Bybit-powered features.
Do not add private Bybit credentials.
Do not expose any API secret through `NEXT_PUBLIC_*`.

Existing Bybit code may remain temporarily during the phased removal, but it must be treated as transitional and removed only after retained wallet/deposit functionality is decoupled from it.

## Security

Never weaken:

- Authentication
- Authorization
- Ownership checks
- CSRF
- MFA
- Password hashing
- Session validation/revocation
- Trusted-device logic
- Transaction PIN protections
- Withdrawal allowlist rules where still applicable
- Rate limiting
- Audit controls

ADMIN access must always be enforced server-side.

Never request or expose real:

- Passwords
- Database credentials
- API secrets
- Private keys
- Seed phrases
- Session tokens
- OTPs
- MFA secrets
- Transaction PINs
- Recovery codes

Use `.env.example` or redacted values only.

## Maintenance Mode

Maintenance mode must prevent new non-admin financial mutations.
Inspect hidden mutation paths and side effects, not only obvious POST routes.
Admins must retain the operational access necessary to manage maintenance mode.

## Database Safety

Prefer additive Prisma migrations.

Do not:

- Run destructive resets unless explicitly instructed
- Delete migration history
- Casually edit already-applied migrations
- Drop financial/audit tables just to simplify code removal
- Destroy useful data to resolve schema issues

Inspect `prisma/schema.prisma` and migration history before database changes.
Run `npx prisma generate` before diagnosing generated Prisma-type problems.

## Known High-Priority Financial Review Items

Before or during the crypto-removal rebuild, verify and fix these if still present in current root source:

1. **Admin funding idempotency** — ensure duplicate admin-funding requests cannot create duplicate ledger postings. The idempotency key must be durably enforced and the lookup key must match what is actually persisted.
2. **Withdrawal exact-source provenance** — ensure a rejected withdrawal refunds the exact BankAccount/Wallet originally debited, especially when one user has multiple accounts in the same currency.
3. **Financial audit atomicity** — ensure mandatory audit events for critical money movement are not left as best-effort writes after the financial transaction commits.

Do not assume these are still broken; inspect the current code and tests first.

## UI / UX

Preserve FHT branding:

- Light mode: White + Blue
- Dark mode: Black/Navy + Blue

Support desktop, tablet, and mobile as distinct responsive experiences.

Maintain:

- Accessible labels
- Keyboard navigation
- Focus states
- Readable contrast
- Touch-friendly controls
- Loading states
- Empty states
- Validation/error states
- Disabled/busy states

Mobile form controls should remain at least 16px computed font size to avoid iOS Safari input auto-zoom.

Do not perform a broad visual rewrite while the crypto decommissioning/backend behavior is still changing.

## Navigation

`components/navigation/nav-config.ts` is the primary shared navigation source for desktop/mobile navigation.

During crypto decommissioning, remove retired routes consistently from:

- Desktop sidebar
- Mobile drawer
- Mobile bottom navigation where applicable
- Dashboard quick actions
- Marketing/support copy

Do not leave dead links to removed Markets/Trade/Convert/Crypto Withdrawal routes.

## Validation Cadence

Before major implementation work, establish a baseline when practical:

- `npx prisma generate`
- `npm run typecheck`
- `npm run lint`
- `npm run test -- --run`
- `npm run build`

On Windows, do not run `npm run build` concurrently with the dev server if `.next` locking/EPERM issues occur.

For incremental work, use targeted tests while editing, then run the broader validation set after a coherent phase/change set.

Classify results exactly as:

- PASS
- FAIL
- PRE-EXISTING FAILURE
- NEW REGRESSION

Never report PASS when the command returned a non-zero exit code.
Never claim a test/build passed without actual command output.

## Current Rebuild Checkpoints

For the HR-directed crypto reduction, complete work in phases and stop after each phase for verification.

Recommended checkpoints:

- Phase 0 — Rules/docs/baseline/Git checkpoint
- Phase 1 — Financial correctness blockers
- Phase 2 — Remove crypto market/trading UI exposure
- Phase 3 — Wallet/deposit decoupling from market data
- Phase 4 — Functional QR deposit
- Phase 5 — Open-order cleanup / locked-fund release
- Phase 6 — Remove Trade/Convert/Markets/Watchlist APIs and feature modules
- Phase 7 — Remove Bybit infrastructure/provider health/config
- Phase 8 — Remove crypto withdrawal surface
- Phase 9 — Historical-data/schema review
- Phase 10 — Documentation/help/tests/final regression verification

Do not jump ahead and perform multiple destructive phases in one broad change unless explicitly approved.

## Deferred / Explicitly Separate Work

Do not mix these into the crypto-removal rebuild unless explicitly requested:

- DEMO / LIVE_SIMULATED / PRODUCTION environment separation
- Presentation/live-style mode
- Final comprehensive UI/UX polish
- Broad framework migration
- Production provider/custody integration

## Working Method

For every task:

1. Read `AGENTS.md` first.
2. Work only in the active root project unless explicitly told otherwise.
3. Inspect current code before proposing or editing.
4. Confirm the issue/requirement exists.
5. Identify financial, security, database, and historical-data impact.
6. Make the smallest safe change.
7. Add focused regression tests where needed.
8. Validate the completed coherent change set.
9. Report exact files changed, exact validation results, and anything intentionally deferred.
10. Stop at the requested phase boundary.

Never guess when the repository can answer the question.

## Core Priority

**Financial correctness → Ledger integrity → Exact ownership → Security → Authorization → Idempotency → Auditability → Historical-data preservation → Stable functionality → Professional UX**
