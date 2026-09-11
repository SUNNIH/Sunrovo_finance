# CURRENT PROJECT STATE

## Project
FISE Holdings Trust Bank (FHT)

## Brand
- Bank: FISE Holdings Trust Bank
- Acronym: FHT
- FISE: Finance, Investment, Security, Equity
- PLT remains the cryptocurrency/token symbol

## Stack
- Next.js 15
- React 19
- App Router
- TypeScript strict mode
- Tailwind CSS
- PostgreSQL
- Prisma ORM
- Vitest

## Architecture
- Feature-oriented modular monolith
- Double-entry ledger is the financial source of truth
- All financial movements must preserve debits = credits
- No direct balance editing
- Preserve idempotency, atomicity, auditability, and ownership checks

## Current UI State
- FISE branding implemented
- Public landing page redesigned
- FISE loading/processing experience implemented
- Help & Support implemented
- Mobile UI polish in progress
- Mobile input auto-zoom fix required/implemented via minimum 16px form-control font size

## Withdrawal Policy
- ALL new withdrawals require administrator approval
- Every new withdrawal starts as PENDING
- Admin approval changes withdrawal to COMPLETED
- Admin rejection changes withdrawal to REJECTED
- Rejection uses the existing balanced ledger reversal/refund flow
- No withdrawal amount threshold remains

## Account Provisioning / Funding
CURRENT DECISION:
- New user accounts should start at zero balance
- Remove automatic onboarding welcome funding
- Admin-authorized treasury/platform funding should be used to fund users
- Admin personal accounts must not act as the funding source
- Funding must use balanced ledger postings, idempotency, audit logs, and transaction history
- Existing user balances must not be changed automatically

## Loading / Processing
- Reusable FiseLoader implemented
- Integrated into major financial/security processing flows
- Existing route skeletons retained
- No artificial delays or fake progress

## Help & Support
- /support implemented
- FAQ/search/category filtering available
- Desktop and mobile navigation already integrated
- Support email addresses will be inserted manually later

## Validation
Latest known:
- Typecheck: PASS
- Lint: PASS
- Unit tests: 211 passed
- Known former jsdom/html-encoding-sniffer ESM issue was under dependency investigation

## Important Rules
- Do not modify stable financial/security architecture without inspection
- Never direct-edit balances
- Keep PLT token branding separate from FHT bank branding
- Preserve auth, MFA, transaction PIN, CSRF, sessions, rate limits, allowlists, audit logs, and ledger integrity
- Newer repository files always override this document if they conflict

## Next Work
- Implement zero-balance onboarding
- Implement admin-controlled treasury funding
- Continue focused mobile UI fixes
- Verify final production build after major changes
