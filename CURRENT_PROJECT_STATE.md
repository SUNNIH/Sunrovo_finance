# CURRENT PROJECT STATE

## Project

**FISE Holdings Trust Bank (FHT)**

FHT is an original digital banking application with retained digital-asset wallet and crypto-deposit support.

**FISE** = Finance, Investment, Security, and Equity.

The historical/project token symbol **PLT** remains a technical/domain symbol where still required by retained data, historical records, or wallet/deposit support. Do not globally rename PLT references without inspecting their purpose.

---

## Source of Truth

The **active application is the repository root**.

`phase6-review/` is **historical/reference material only** and must not be modified or treated as the active application.

Newest repository files override older implementation reports, documentation, and previous assumptions.

Before architecture-changing work, inspect:

- `AGENTS.md`
- `CURRENT_PROJECT_STATE.md`
- `README.md`
- `CHANGELOG.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `package.json`
- `prisma/schema.prisma`
- affected routes, services, tests, and migrations

---

## Current Stack

Preserve the existing stack:

- Next.js 15
- React 19
- App Router
- TypeScript strict mode
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Vitest
- existing authentication/security libraries
- Decimal-based money handling
- feature-oriented modular monolith

Do not perform a framework rewrite or broad architecture replacement without a strong reason.

---

## Current Product Direction

HR has instructed that FHT should no longer expose broad crypto-market/exchange functionality.

### Retained Digital-Asset Scope

Keep:

- Crypto Wallet
- Crypto asset balances
- Crypto deposit address
- Crypto deposit via QR code
- Crypto deposit transaction/history records
- ledger accounts required for crypto balances and deposits
- asset/network metadata required by the deposit flow
- historical financial/audit records

### Scheduled for Decommissioning

Remove in controlled phases:

- Markets
- market detail pages
- Trade
- Buy / Sell functionality
- Limit orders
- Open orders
- Convert
- conversion quotes
- Watchlists
- Candles
- Order books
- recent market trades
- live market-price surfaces
- Bybit REST/WebSocket market integration
- Bybit mock-market infrastructure
- trading inventory/settlement functionality
- Trade/Convert CTAs
- Bybit provider-health UI
- most customer-facing crypto-market references
- crypto withdrawals, unless management explicitly re-approves them

The retained wallet is intended to become a **deposit-and-hold wallet**, not an exchange/trading interface.

---

## Safe Crypto Decommissioning Sequence

Do **not** delete crypto/trading code wholesale.

Use this order:

1. Update project instructions/state and establish a clean Git checkpoint.
2. Fix high-priority financial correctness issues before broad refactoring.
3. Remove Markets / Trade / Convert exposure from navigation, dashboard, marketing, support, and CTAs while leaving backend logic temporarily intact.
4. Decouple Wallet from Bybit/live-market valuation.
5. Replace the current QR placeholder with a genuinely scannable QR representation of the retained deposit address.
6. Identify and safely cancel/migrate all OPEN limit orders; release locked balances correctly.
7. Disable/remove Markets / Trade / Convert / Watchlist runtime APIs and feature modules.
8. Remove Bybit integration, provider-health UI, CSP/env configuration, and market-specific tests once no retained feature depends on it.
9. Remove crypto withdrawal functionality if the retained scope remains Wallet + Deposit only.
10. Preserve historical database models initially; consider schema cleanup only after runtime dependencies are gone.
11. Update documentation, help content, marketing copy, tests, and final regression coverage.

At every phase, verify typecheck/lint/tests and do not continue through a new regression.

---

## Financial Architecture

The FHT **double-entry ledger is the financial source of truth**.

Never implement financial movement as a direct balance edit.

Required flow:

**Request → Authentication → Authorization → Validation → Ledger posting → Transaction record → Balance/cache update → Audit event**

Every completed posting must satisfy:

**Total debits = total credits**

Use Prisma Decimal / existing money helpers for authoritative monetary values.

Preserve:

- idempotency
- duplicate protection
- atomic database transactions
- exact ownership checks
- provenance
- transaction history
- auditability
- cache consistency
- environment isolation where applicable

---

## Current Account Provisioning

### New Users

New onboarding now creates:

- Current Account → `0`
- Savings Account → `0`
- Spot/Crypto Wallet → no initial asset balances

Automatic onboarding/welcome funding has been removed.

No onboarding welcome ledger postings or welcome deposit transactions should be created.

Existing users and existing balances must not be modified by this policy.

---

## Admin Funding

Admin-controlled treasury funding is implemented.

Expected flow:

**Admin → User → Account/Wallet → Asset → Amount → Reason → Confirm → Treasury ledger posting → Balance/cache update → Transaction history → Audit**

Rules:

- admin-only authorization
- normal users cannot access admin funding endpoints
- funding source is a platform/treasury ledger account, not an admin's personal balance
- target account/wallet must belong to the selected user
- asset/currency compatibility must be validated
- balanced ledger posting required
- idempotency required
- atomicity required
- audit history required
- existing user balances are never altered outside an explicit funding transaction

### Known Review Item

Admin-funding idempotency requires careful verification.

The previously inspected implementation appeared to compare a namespaced idempotency value against `Transaction.ledgerGroupId` while the actual ledger posting generated its own group UUID. This can undermine duplicate protection if unchanged.

Treat this as **HIGH PRIORITY** before relying on admin funding in a production-like workflow.

---

## Withdrawals

### Approval Policy

All valid new withdrawals require administrator approval.

Flow:

**User submits → PENDING → Admin approves → COMPLETED**

or:

**User submits → PENDING → Admin rejects → REJECTED + balanced reversal/refund**

There is no amount threshold that bypasses admin approval.

### Minimum Withdrawal

Minimum withdrawal is:

**USD $100 equivalent**

Applies to supported currencies/assets where withdrawals remain enabled.

Rules:

- below $100 equivalent → reject before financial posting
- exactly $100 equivalent → allowed
- above $100 equivalent → allowed
- accepted withdrawal still becomes `PENDING`
- server-side validation is authoritative
- use Decimal / existing money helpers
- use existing FX/pricing infrastructure where retained
- if required pricing cannot be obtained, fail safely

### Crypto Withdrawal Direction

Under the current HR scope, crypto withdrawals are planned for removal because the retained digital-asset scope is Wallet + Deposit only.

Do not remove fiat withdrawal functionality.

### Known Review Item

Withdrawal reversal/source provenance needs verification.

The previously inspected implementation used currency-based lookup to find the source/refund account. A user can have multiple accounts in the same currency, so rejection/refund must preserve the **exact original source account/wallet ID**.

Treat this as **HIGH PRIORITY**.

---

## Deposits

### Fiat

Existing fiat deposit behavior remains part of the banking product unless changed by a later requirement.

### Crypto

Retain crypto deposit functionality.

Current retained flow:

**Wallet → Select asset/network → Deposit address → QR representation → Deposit processing → Ledger posting → Wallet balance → Transaction history**

### QR Code Status

The previously inspected UI showed a QR icon/placeholder rather than a real scannable QR matrix.

This must be replaced with a real QR code that encodes the retained deposit address.

Do not claim QR deposit is complete until an actual device can scan the rendered QR code and obtain the expected address.

---

## Wallet

Retain the crypto wallet, but transition it away from exchange-style behavior.

Desired retained wallet:

- asset name/symbol
- available/native balance
- deposit action
- deposit address/network
- deposit history / relevant transactions

Remove or decommission:

- live market valuation dependency
- portfolio allocation based on Bybit pricing
- Trade CTA
- Convert CTA
- open-order/"in orders" UI
- market pair construction
- Bybit-specific ticker dependency

If live fiat valuation is removed, do not fake valuation.

---

## Open Orders / Locked Balances

Trading currently has/had logic that can move funds from:

**available → locked**

for OPEN limit orders.

Before disabling or removing order endpoints:

1. identify all OPEN orders
2. safely cancel/close them
3. release locked funds back to available balances
4. preserve the historical order record
5. create appropriate audit/history records

Never remove trading endpoints in a way that can strand locked user balances.

---

## Database Preservation During Crypto Removal

Retain the core models required for wallet/deposit operation, including:

- `CryptoWallet`
- `AssetBalance`
- `Asset`
- `LedgerAccount`
- `LedgerEntry`
- `Deposit`
- `Transaction`

Historical trading/conversion models should initially remain even after runtime features are disabled, for example:

- `CryptoOrder`
- `ConversionQuote`
- `Conversion`
- `Watchlist`

Do not perform destructive schema cleanup until:

- no active runtime dependencies remain
- historical/audit requirements are understood
- migrations are planned
- regression impact is verified

Never manually delete financial tables.

---

## Admin

Current admin capabilities include:

- admin console
- treasury/user funding
- withdrawal review/approval/rejection
- announcements
- announcement Hide/Show controls
- audit/operations functionality
- maintenance controls
- provider-health functionality currently exists but Bybit-specific provider health is scheduled for removal with market infrastructure

Admin funding and withdrawal approval must remain server-authorized.

---

## Announcements

Admin announcements support active/hidden state.

Expected behavior:

- Active announcement → visible to customers
- Hidden announcement → remains visible in Admin as hidden but disappears from customer-facing banner
- Admin UI provides Hide/Show controls
- announcements are not deleted merely to hide them

---

## Dashboard

Device-local greeting is implemented.

Expected greeting:

- 00:00–11:59 → Good morning
- 12:00–17:59 → Good afternoon
- 18:00–23:59 → Good evening

Greeting should use the user's browser/device local time, not server time.

---

## Navigation / Desktop Shell

The desktop sidebar has undergone multiple fixes.

Current intended behavior:

- sidebar is pinned/full-height on desktop
- sidebar header remains fixed
- only the middle navigation list scrolls
- footer/support/collapse section remains fixed at the bottom
- main content scrolls independently
- no top clipping
- no blank 64px offset above the sidebar
- mobile/tablet navigation remains separate and unchanged

Do not reintroduce the incorrect assumption that the entire sidebar must start below the right-column `TopNavigation`.

---

## Mobile UX

Mobile form controls should use a computed font size of at least `16px` to prevent iOS Safari keyboard-focus auto-zoom.

Do not disable user zoom with:

- `maximum-scale=1`
- `user-scalable=no`

Preserve accessibility and browser zoom capability.

---

## Help & Support

Help & Support exists under `/support`.

Current functionality includes:

- FAQ categories
- search/filtering
- responsive layout
- security guidance/quick links
- desktop/mobile navigation integration

Real support/compliance email addresses are to be inserted manually where placeholders still exist.

---

## Branding

Current bank/site brand:

**FISE Holdings Trust Bank (FHT)**

Visual direction:

- Light mode → White + Blue
- Dark mode → Black/Navy + Blue

Keep the bank branding separate from retained technical/token references.

Do not globally replace historical/technical `PLT` references without inspecting context.

---

## Security

Preserve:

- authentication/session validation
- password hashing
- MFA
- trusted-device logic
- transaction PIN
- CSRF protection
- rate limiting
- ownership checks
- withdrawal allowlist where applicable
- audit logging
- maintenance-mode controls
- secure server-side secrets

Never expose:

- database passwords
- API secrets
- private keys
- seed phrases
- session tokens
- OTPs
- MFA secrets
- transaction PINs
- recovery codes

Environment review should use `.env.example` or redacted values only.

---

## Audit Atomicity Review

Some previously inspected financial flows write financial state inside a Prisma transaction and then call audit logging after the transaction commits.

That can allow:

**financial commit succeeds → audit write fails**

For critical financial operations, inspect whether required audit events should participate in the same transaction or use an equally reliable transactional/outbox pattern.

Treat this as a financial-hardening review item.

---

## Current Validation State

The repository contains current tests for areas including:

- ledger
- ledger reversal
- money
- authentication/security
- transfers
- withdrawal allowlist
- withdrawal approval policy
- withdrawal minimum policy
- zero-balance provisioning
- admin funding
- deposit UI
- notifications UI
- sidebar/UI behavior
- Bybit/market/trading functionality that will be retired during the phased crypto removal

Do not claim current full-suite PASS unless confirmed by a fresh run against the active root project.

Before major implementation work, establish:

```bash
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

Classify each result as:

- PASS
- FAIL
- PRE-EXISTING FAILURE
- NEW REGRESSION

On Windows, avoid running production build concurrently with the dev server if `.next` file-locking/EPERM problems occur.

---

## Documentation Drift

Some project documentation still reflects older architecture and must be updated during the decommissioning work.

Known examples from the latest inspection:

- older onboarding/welcome-funding descriptions
- older withdrawal threshold behavior
- older crypto/Bybit product positioning
- older phase/status wording

Newest source code and this project-state file override stale documentation until those files are reconciled.

---

## Immediate Priorities

### Priority 1 — Financial correctness review

Verify/fix:

1. Admin funding idempotency
2. Exact withdrawal source/refund provenance
3. Critical financial audit atomicity

### Priority 2 — HR crypto-scope transition

Begin the phased removal process without breaking:

- banking
- ledger
- wallet
- crypto deposit
- QR deposit
- transaction history
- admin
- security

### Priority 3 — Wallet/Deposit retention quality

- decouple wallet from Bybit pricing
- make QR genuinely scannable
- preserve wallet native balances and deposit history

### Priority 4 — Controlled decommissioning

Only after dependencies are removed:

- Markets
- Trade
- Convert
- Watchlist
- Bybit
- market-specific APIs/tests
- crypto withdrawal UI/backend if still outside approved scope

---

## Do Not Do

Do not:

- perform a full rewrite
- directly edit balances
- remove financial history
- delete open-order functionality before releasing locked balances
- delete crypto database models before dependency analysis
- remove wallet/deposit models needed by retained functionality
- globally replace PLT references
- weaken auth/MFA/CSRF/PIN/rate limits
- edit `phase6-review/` as if it were active code
- claim tests/build passed without actual output
- remove Bybit before Wallet/withdrawal-minimum dependencies are safely decoupled
- invent replacement FX/market providers without explicit need

---

## Working Principle

**Financial correctness + Ledger integrity + Security + Authorization + Auditability + Stable banking functionality + Controlled crypto decommissioning + Professional UX**

When a new requirement conflicts with this file, update `AGENTS.md` and `CURRENT_PROJECT_STATE.md` deliberately rather than allowing assumptions to diverge.
