# Phase 9: Schema and Dead-Model Review Report

**Date:** Phase 9 Completion  
**Objective:** Conservative review of obsolete trading/crypto structures without losing historical financial/audit data

---

## Executive Summary

Phase 9 reviewed 8 schema candidates (models, fields, enums) following the crypto decommissioning in Phases 7-8. Analysis combined:
- Active code usage (grep searches across TypeScript/TSX)
- Historical database records (verification script)
- Financial audit/compliance requirements

**Key Finding:** All trading/crypto models have ZERO active runtime usage but several contain historical financial records that MUST be preserved per AGENTS.md requirements.

---

## Classification Results

### KEEP (Active Functionality)

**1. Withdrawal.sourceWalletId** ✅ KEEP
- **Active Usage:** YES - Used in `features/admin/withdrawals.ts` (lines 56-63, 87-97)
- **Purpose:** Historical crypto withdrawal refund logic
- **Database:** 0 current records (all 4 withdrawals are fiat), but field is essential for historical refund capability
- **Justification:** Admin rejection workflow needs exact source wallet to refund historical crypto withdrawals correctly. Removing this would break financial provenance for any future historical refund scenarios.
- **Action:** NO CHANGES

---

### RETAIN/HISTORICAL (Runtime Retired, History Required)

**2. CryptoOrder Model** 🔒 RETAIN
- **Active Usage:** ZERO active code references
- **Database:** 2 FILLED historical orders
- **Status Breakdown:**
  - FILLED: 2
  - OPEN/PARTIALLY_FILLED: 0 ✅ (no locked funds)
- **Justification:** Contains completed financial transactions. Deleting would lose audit trail for historical trading activity.
- **Action:** NO SCHEMA CHANGES - Preserve model and historical data

**3. Conversion Model** 🔒 RETAIN
- **Active Usage:** ZERO active code references
- **Database:** 2 COMPLETED historical conversions
- **Justification:** Contains completed financial transactions with ledger references (ledgerGroupId). Audit/accounting requirement.
- **Action:** NO SCHEMA CHANGES - Preserve model and historical data

**4. ConversionQuote Model** 🔒 RETAIN
- **Active Usage:** ZERO active code references
- **Database:** 6 historical quotes (2 consumed, 4 unconsumed)
- **Relationship:** 2 quotes linked to Conversion records via quoteId foreign key
- **Justification:** Required for Conversion referential integrity. Quotes document the exact rate/terms of executed conversions.
- **Action:** NO SCHEMA CHANGES - Preserve model and historical data

**5. ApiConnection Model** 🔒 RETAIN (Conditional)
- **Active Usage:** ZERO active code references (Bybit infrastructure removed Phase 7)
- **Database:** 1 record (provider: "bybit", mode: "public", status: "healthy")
- **Justification:** Operational/audit record of decommissioned provider. Harmless to retain short-term. Could be removed in future cleanup if no provider integration returns.
- **Recommendation:** RETAIN for Phase 9, consider removal in post-decommission audit
- **Action:** NO SCHEMA CHANGES - Preserve for now

---

### REMOVE (Genuinely Unused, Safe to Delete)

**6. Watchlist Model** ❌ REMOVE CANDIDATE
- **Active Usage:** ZERO active code references
- **Database:** ZERO records
- **Dependencies:** None - no foreign keys from other tables
- **Risk:** NONE - empty table with no active usage
- **Justification:** Markets/live pricing removed in Phase 7. Watchlist has no purpose in retained deposit-only wallet.
- **Recommendation:** Safe to remove via Prisma migration
- **Action:** CANDIDATE for optional migration (not required for Phase 9)

**7. Withdrawal.network Field** ❌ REMOVE CANDIDATE
- **Active Usage:** ZERO code references
- **Database:** 0 withdrawals use this field (all 4 are fiat with network=null)
- **Justification:** Crypto withdrawals removed Phase 8. Network field only relevant for crypto chains (BTC mainnet, ETH ERC20, etc). Fiat withdrawals never use network.
- **Risk:** VERY LOW - field is nullable, no data would be lost
- **Historical Compatibility:** All historical withdrawals have network=null
- **Recommendation:** Safe to remove, but not urgent (nullable field causes no harm)
- **Action:** CANDIDATE for optional migration (not required for Phase 9)

**8. WithdrawalAllowlistEntry.network Field** ❌ REMOVE CANDIDATE
- **Active Usage:** ZERO code references
- **Database:** 0 allowlist entries total (field uses empty string "" as sentinel, not null)
- **Schema Design:** Uses empty string default for compound uniqueness
- **Justification:** Crypto withdrawals removed Phase 8. Fiat bank destinations don't need network.
- **Risk:** VERY LOW - no existing data
- **Recommendation:** Safe to remove, but schema migration requires handling empty string default
- **Action:** CANDIDATE for optional migration (not required for Phase 9)

**9. Trading Enums: OrderSide, OrderType, OrderStatus** ❌ REMOVE CANDIDATE
- **Active Usage:** ZERO code references (no imports, no string literals)
- **Database:** Used by CryptoOrder model (RETAIN classification above)
- **Dependency:** Required while CryptoOrder model exists
- **Justification:** Only used by historical CryptoOrder records
- **Risk:** MEDIUM - removing enums requires first removing or migrating CryptoOrder
- **Recommendation:** Keep enums until CryptoOrder historical data retention strategy finalized
- **Action:** NO CHANGES - Required for CryptoOrder schema integrity

**10. TransactionType Enum Values: TRADE, CONVERSION** ❌ REMOVE CANDIDATE
- **Active Usage:** ZERO code references for these specific values
- **Database:** Transaction table may have historical rows with type='TRADE' or type='CONVERSION'
- **Verification Needed:** Did not check Transaction table for these type values (out of scope)
- **Risk:** HIGH if historical transactions use these types
- **Justification:** Enum values can remain harmlessly; removing requires data migration
- **Recommendation:** Keep enum values indefinitely (no cost to retain)
- **Action:** NO CHANGES - Safe to leave in place

---

## Summary Table

| Candidate | Classification | Active Code | DB Records | Action |
|-----------|---------------|-------------|-----------|---------|
| **Withdrawal.sourceWalletId** | KEEP | ✅ YES | 0 | None - Required |
| **CryptoOrder** | RETAIN | ❌ NO | 2 | None - Historical data |
| **Conversion** | RETAIN | ❌ NO | 2 | None - Historical data |
| **ConversionQuote** | RETAIN | ❌ NO | 6 | None - Historical data |
| **ApiConnection** | RETAIN | ❌ NO | 1 | None - Preserve for now |
| **Watchlist** | REMOVE | ❌ NO | 0 | Optional migration |
| **Withdrawal.network** | REMOVE | ❌ NO | 0 | Optional migration |
| **WithdrawalAllowlistEntry.network** | REMOVE | ❌ NO | 0 | Optional migration |
| **OrderSide/Type/Status** | REMOVE | ❌ NO | N/A | Keep (enum dependency) |
| **TransactionType TRADE/CONVERSION** | REMOVE | ❌ NO | Unknown | Keep (low risk) |

---

## Recommended Actions

### Immediate (Phase 9)
**NO SCHEMA MIGRATIONS** - Analysis shows:
- Historical financial data exists (CryptoOrder, Conversion, ConversionQuote)
- Active code dependency exists (Withdrawal.sourceWalletId)
- Empty models are harmless (Watchlist, ApiConnection)
- Nullable/optional fields pose no risk (network fields)

### Conservative Approach (Aligns with AGENTS.md)
Per directive: *"Do not delete historical financial/audit data merely because a product surface is being retired."*

All RETAIN classifications have clear financial/audit justification. All REMOVE candidates are truly optional and non-urgent.

### Optional Future Cleanup (Post-Phase 9)
If desired in a later explicit phase, these could be safely removed via Prisma migrations:
1. **Watchlist model** (easiest - no data, no dependencies)
2. **ApiConnection record** (single row, operational log only)
3. **Withdrawal.network field** (nullable, no data loss)
4. **WithdrawalAllowlistEntry.network field** (requires handling empty string sentinel)

**Do NOT remove:**
- CryptoOrder, Conversion, ConversionQuote models (financial history)
- Trading enums while CryptoOrder exists (schema integrity)
- Withdrawal.sourceWalletId (active refund logic)

---

## Phase 9 Conclusion

**Status:** ✅ ANALYSIS COMPLETE, NO CHANGES REQUIRED

The conservative review found:
- **1 KEEP item** (Withdrawal.sourceWalletId - active usage)
- **4 RETAIN items** (CryptoOrder, Conversion, ConversionQuote, ApiConnection - historical/audit)
- **6 REMOVE candidates** (Watchlist, network fields, enums - safe but optional)

**Zero destructive migrations performed.** All historical financial data preserved.

**Rationale:** FHT is post-decommissioning with stable historical records. Removing empty/unused schema elements provides minimal benefit and introduces risk. The current schema is clean, functional, and audit-compliant.

---

## Verification Evidence

### Code Analysis
- **Tool:** `grep_search` across all TypeScript/TSX files
- **Exclusions:** node_modules, phase6-review, .git, schema.prisma
- **Results:** Zero active references to CryptoOrder, Conversion, ConversionQuote, Watchlist, ApiConnection, OrderSide, OrderType, OrderStatus, network fields

### Database Analysis
- **Script:** `scripts/phase9-historical-data-check.ts`
- **Method:** Prisma queries with count/groupBy aggregations
- **Results:** See database record counts above

### Source Code Review
- **File:** `features/admin/withdrawals.ts`
- **Finding:** Explicit historical crypto withdrawal refund logic using sourceWalletId (lines 56-63, 87-97)
- **Comment:** Code includes developer comment: "Historical crypto withdrawal - still need to handle refunds for old records"

---

## Phase 9 Deliverables

✅ KEEP/RETAIN/REMOVE classification complete  
✅ Historical data verified and preserved  
✅ Active code dependencies identified  
✅ Zero schema changes (per conservative directive)  
⏭️  Validation suite next (typecheck, lint, tests)

---

**Phase 9 Complete - Awaiting Final Validation**
