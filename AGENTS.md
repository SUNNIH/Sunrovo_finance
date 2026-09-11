# FISE HOLDINGS TRUST BANK (FHT) — AGENT RULES

## Project Identity

FISE HOLDINGS TRUST BANK (FHT) is an original digital banking and cryptocurrency application.
FHT is not a Bybit clone. Bybit may only be used as a public market-data provider, functional reference, or optional future API provider where explicitly required.
Preserve the existing FHT branding, UI, navigation, authentication, database, ledger, wallets, banking architecture, security, and crypto features.

## Source of Truth

The current repository is authoritative.
Before significant changes:

1. Inspect the relevant current code.
2. Inspect affected Prisma models and migrations.
3. Inspect relevant tests and dependencies.
4. Cross-check reported issues against the current implementation.

When architecture or project status matters, read:

- README.md
- CHANGELOG.md
- ARCHITECTURE.md
- SECURITY.md
- package.json
- prisma/schema.prisma
- prisma/migrations/

Never assume an issue still exists. If something is already correctly implemented, do not rewrite it.

## Stack and Architecture

Preserve:

- Next.js 15
- React 19
- App Router
- TypeScript strict mode
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Vitest
- Existing auth/security libraries
- Bybit V5 where applicable

FHT is a feature-oriented modular monolith.
Prefer small modules, adapters, services, reusable components, focused migrations, and incremental changes.
Do not perform broad rewrites of stable functionality without a strong reason.

## Financial Rules

The FHT double-entry ledger is the financial source of truth.
Never implement financial movement primarily as a direct balance edit.
Financial operations must preserve authentication, authorization, ownership checks, validation, idempotency, atomic database transactions, ledger posting, transaction history, cache consistency, and auditability.
Every completed posting must satisfy, per asset: TOTAL DEBITS = TOTAL CREDITS.
BankAccount.balanceCache and AssetBalance.available/locked are caches, not the authoritative source of funds.

## Money Safety

Use Prisma Decimal, decimal.js, or existing FHT money utilities for authoritative financial values.
Do not use Number() or parseFloat() for authoritative balances, transaction amounts, fees, quantities, reserves, notionals, financial comparisons, ledger amounts, or balance-cache calculations.
Number() is acceptable for non-authoritative UI, charts, timestamps, pagination, and layout calculations.

## Exact Financial Ownership

Always preserve the exact account or wallet involved in financial activity.
Prefer exact BankAccount ID, CryptoWallet ID, LedgerAccount ID, ledgerGroupId, and transaction/reference IDs.
Do not rediscover a financial target later with a broad query when the original exact target can be determined.

## Idempotency and Concurrency

Preserve idempotency for every financial mutation.
Prevent duplicate transfers, deposits, withdrawals, trades, conversions, reversals, and future admin funding.
Use concurrency-safe state transitions when multiple actors can process the same record.
Never allow duplicate ledger postings or duplicate refunds.

## Atomicity and Audit

Where one financial action logically includes multiple writes, keep them in the same Prisma transaction.
Where appropriate, include state claim, ledger posting, domain update, exact cache update, transaction history, notification, and required audit event.
Do not allow critical money movement to commit while its required audit event fails separately.

## Security

Never weaken authentication, authorization, ownership checks, CSRF, MFA, password hashing, sessions, trusted-device logic, transaction PIN protections, rate limiting, or audit controls.
ADMIN access must always be enforced server-side.
Never request or expose real passwords, database credentials, API secrets, private keys, seed phrases, session tokens, OTPs, MFA secrets, transaction PINs, or recovery codes.
Use .env.example or redacted values only.

## Bybit

Keep Bybit modular: Bybit → FHT adapter/provider → normalized FHT types → FHT UI.
Public market data should not require private API credentials.
Private Bybit credentials must remain server-side and must never be exposed through NEXT*PUBLIC*\* variables.
Normal market-data paths may safely fall back to FHT mock/stale data.
Admin provider-health checks should distinguish actual upstream availability from fallback operation.

## Withdrawals

Approval must not debit a customer twice.
Rejected withdrawals must preserve the original posting, create a separate balanced reversal, restore the exact originally debited account/wallet, refund principal and fee exactly, prevent duplicate reversal/refund, update transaction status, and create notification/audit records.
Prefer reversing the exact original ledger group instead of reconstructing a financial event from broad account lookups.

## Withdrawal Allowlist

Withdrawal allowlist enforcement must happen on the backend.
Entries must belong to the authenticated user, have deterministic scope, avoid accidental wildcard authorization, and have reliable uniqueness.
Do not rely on nullable security fields as implicit wildcards unless explicitly designed and documented.

## Maintenance Mode

Maintenance mode must prevent new non-admin financial mutations.
Inspect hidden mutation paths, including lazy limit-order fills and mutations triggered by GET handlers or server-page evaluation.
Admins must retain the operational access required to manage maintenance mode.

## Database Safety

Prefer additive Prisma migrations.
Do not run destructive resets unless explicitly instructed, delete migration history, casually edit already-applied migrations, or destroy useful data to resolve schema issues.
Inspect schema and migration history before database changes.

## Validation Cadence

Do not run typecheck, lint, tests, or build after every small edit.
Work in coherent significant change sets and use targeted checks only when useful.
After significant implementation work is complete, run:

- npx prisma generate
- npm run typecheck
- npm run lint
- npm run test
- npm run build

Classify results as PASS, FAIL, PRE-EXISTING FAILURE, or NEW REGRESSION.
Never claim a command passed without actual output.

## UI / UX

Preserve FHT branding:

- Light mode: White + Blue
- Dark mode: Black/Navy + Blue

Support desktop, tablet, and mobile.
Maintain accessible labels, keyboard navigation, focus states, readable contrast, touch-friendly controls, and appropriate loading/error/empty/disabled states.
Do not perform a major UI redesign while backend functionality is still changing.

## UI Polish Guidelines

FHT UI improvements must preserve existing functionality.

Design goals:

- Premium fintech experience
- Professional banking feel
- Clean and trustworthy
- FHT-specific branding

References may include:

- modern fintech dashboards
- banking applications
- trading interfaces

Do not copy external branding, layouts, or terminology.

When improving UI:

- inspect existing components first
- reuse existing design tokens
- prefer small incremental changes
- maintain accessibility
- support desktop, tablet, and mobile

Include appropriate:

- loading states
- empty states
- error states
- disabled states
- hover/focus states

Animations should be:

- subtle
- purposeful
- performant

Avoid:

- excessive motion
- unnecessary redesigns
- changing business logic during UI work

Before major UI polish:

- confirm typecheck passes
- confirm lint passes
- confirm tests pass
- confirm build passes

## Deferred Post-Build Work

Do not implement these unless explicitly requested after the main build is stable:

1. DEMO / LIVE_SIMULATED / PRODUCTION environment separation
2. Remote Admin Funding
3. Presentation/live-style mode
4. Final comprehensive UI/UX and smart-animation polish

## Future Admin Funding Principle

Future Admin Funding must allow an authorized ADMIN to select:
User → Environment → Exact Account/Wallet → Asset → Amount → Reason

Then perform:
Authorization → Validation → Idempotency → Balanced treasury/platform ledger posting → Exact cache update → Transaction history → Notification → Audit event

Never implement future Admin Funding as a direct authoritative balance edit.
Normal users must never access admin-funding endpoints.
Future Admin Funding must respect financial-environment isolation.

## Working Method

For every task:

1. Inspect current code.
2. Confirm the issue or requirement.
3. Identify financial, security, and database impact.
4. Make the smallest safe change.
5. Preserve working baselines.
6. Add focused regression tests where needed.
7. Validate after significant change sets.
8. Report exactly what changed and what remains.

Never guess when the repository can answer the question.

## Core Priority

Financial correctness → Ledger integrity → Exact ownership → Security → Authorization → Idempotency → Auditability → Stable functionality → Professional UX
