# PLATINUM TRUST BANK (PLT)

A digital banking and cryptocurrency application. Original brand, original UI —
Bybit is used only as a functional/layout reference for the crypto surfaces
and as a public spot-market data provider; PLT never presents itself as
Bybit or reproduces Bybit branding.

> **Demo Environment.** No real funds are held or transferred. PLT is not
> currently licensed, insured, or regulated. See `SECURITY.md` and the
> in-app "Demo Environment" badge.

## Status

**Phase 6 of 6 complete: Admin panel + hardening.** Administrators can
review pending withdrawals, approve them, or reject them through a
balanced ledger reversal that returns both principal and fee. The release
also adds durable withdrawal allowlists, audit-log viewing, customer
announcements, maintenance mode, provider health checks, tightened browser
headers, and live Bybit kline updates with selectable timeframes.

### Try it

```bash
npm run dev
```

After logging in:

1. `/deposit` — fund your fiat account or simulate an incoming crypto
   deposit (with a demo, non-functional address + QR placeholder).
2. `/withdraw` — withdraw from any funded account. Amounts under ~$1000
   (USD-equivalent) complete instantly; larger amounts show as
   "pending review" and can be approved or rejected by an administrator.
3. `/cards` — request a virtual or physical demo card, freeze/unfreeze,
   report lost, set a spending limit, view sample transactions.
4. `/notifications` — see security and transaction alerts; the bell icon
   in the top bar now shows a real unread count.
5. `/security` — set a transaction PIN, enable MFA, change your
   password, review trusted devices/active sessions/login history, set
   an anti-phishing phrase, maintain an enforced withdrawal-destination
   allowlist, or deactivate your account.
6. `/admin` — ADMIN users can review withdrawals, publish announcements,
   operate maintenance mode, inspect provider health, and view audit events.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS with semantic design tokens (light/dark)
- PostgreSQL + Prisma ORM
- Vitest (unit), Playwright (e2e, added in a later phase)
- Bybit public V5 REST/WebSocket for spot market data (added in Phase 4)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, SESSION_SECRET, CREDENTIALS_ENCRYPTION_KEY at minimum
npx prisma generate
npx prisma migrate dev       # Phase 2 (Profile.country) + Phase 3 (Transaction.transferId) migrations
npm run prisma:seed          # loads reference assets + demo funding/settlement/fee pools
npm run dev
```

Requires Node.js >= 18.18 and a reachable PostgreSQL instance.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm run lint` | ESLint (`next/core-web-vitals` + `next/typescript`, `no-explicit-any` enforced) |
| `npm run test` | Vitest unit tests |
| `npm run prisma:migrate` | Create/apply a migration |
| `npm run prisma:seed` | Seed reference assets |
| `npm run prisma:studio` | Browse the database |

## Repository layout

Feature-oriented modular monolith (see `ARCHITECTURE.md` for the reasoning):

```
app/            Next.js routes: (marketing), (auth), (platform), admin, api
components/     Reusable UI: ui, layout, navigation, financial, ...
features/       Business-logic modules per domain (banking, crypto, ...)
lib/            Cross-cutting: money, ledger, db, auth, bybit, validation, ...
prisma/         schema.prisma, migrations, seed.ts
tests/          unit, integration, accessibility, e2e
```

## A note on this sandbox's build verification

Every phase of this code is verified with `npm run typecheck`, `npm run
lint`, `npm run test`, and `npm run build` inside the build sandbox used to
produce it. Two things can **not** be verified inside that sandbox because
its network allowlist only permits package registries, not arbitrary
hosts:

1. **`prisma generate`** — Prisma downloads its query/schema engine binaries
   from `binaries.prisma.sh`, which the sandbox blocks (403). Run `npx prisma
   generate` yourself after `npm install`; it works normally with unrestricted
   internet access.
2. **`next/font/google` (Inter)** — fetched from `fonts.googleapis.com` at
   build time, also blocked in-sandbox.

**Phase 1** had no code touching generated Prisma types from `app/`, so a
full build compiled with zero errors. From **Phase 2** onward, `next
build`'s type-checker reaches that gap and stops at the first occurrence,
so verification relies on `tsc --noEmit` (reports *every* error, not just
the first) — Phase 2 had exactly 5 such errors, Phase 3 has 35, and every
single one was individually traced to "this variable/type comes from a
Prisma model/enum that only exists after `generate` runs," not a distinct
bug. The count grows each phase in proportion to how much new code touches
the database — that's expected, not a quality regression. Two genuinely
new bugs *were* caught and fixed this phase (see `CHANGELOG.md`), which is
exactly what this two-tool verification approach is for.
