# Ledger Account Repair Summary

## Issue

**Error:** `Account cmtgu68wh000n1821y06181si has no ledger account`

**Type:** Provisioning Integrity Problem (Case B)

## Root Cause

14 withdrawal-eligible bank accounts (CURRENT and SAVINGS) were provisioned **without their required LedgerAccounts**. This occurred before the current atomic provisioning logic in `features/authentication/provision-accounts.ts` was implemented.

## Affected Accounts

- **Total:** 14 bank accounts
- **Types:** CURRENT (7), SAVINGS (7)
- **Currency:** USD only
- **Total balanceCache exposure:** $49,497.50 USD
- **Users affected:** 7 unique users

### Account List

| Account Type | Account Number | Balance Cache | User ID |
|--------------|----------------|---------------|---------|
| SAVINGS | 2040298379 | $2,000.00 | cmtgvmniy00024ifqerz9p216 |
| CURRENT | 2166156684 | $5,000.00 | cmtj0yqbz000kvgeya3o3gh5u |
| SAVINGS | 9706297209 | $2,000.00 | cmtj0yqbz000kvgeya3o3gh5u |
| CURRENT | 7254168041 | $4,701.00 | cmtgef5u00000129wfwg8p918 |
| SAVINGS | 8332690099 | $3,299.00 | cmtgef5u00000129wfwg8p918 |
| CURRENT | 5517965969 | $5,000.00 | cmttwooji0000ucnw8agt3soe |
| SAVINGS | 3985428586 | $2,000.00 | cmttwooji0000ucnw8agt3soe |
| CURRENT | 3134629978 | $5,000.00 | cmtu4rzuu0000ton93843tdl6 |
| SAVINGS | 5639034721 | $2,000.00 | cmtu4rzuu0000ton93843tdl6 |
| SAVINGS | 6530913718 | $2,000.00 | cmtgu3xq1000218213v4c9jgc |
| CURRENT | 4082782995 | $6,400.00 | cmtgvmniy00024ifqerz9p216 |
| **CURRENT** | **9430000091** | **$2,099.00** | **cmtgu3xq1000218213v4c9jgc** |
| SAVINGS | 1701039169 | $6,200.00 | cmtn8d629000c10i03f10vj51 |
| CURRENT | 3933111091 | $1,798.50 | cmtn8d629000c10i03f10vj51 |

*(The bolded account is the one from the original error report)*

## Investigation Findings

### Financial Operations Require Ledger Accounts

Both withdrawal and admin funding operations enforce ledger account requirements:

```typescript
// features/treasury/withdrawals.ts:92-93
const ledgerAccount = await tx.ledgerAccount.findUnique({ where: { bankAccountId: account.id } });
if (!ledgerAccount) throw new Error(`Account ${account.id} has no ledger account`);

// features/admin/funding.ts:147-150
const ledgerAccount = await tx.ledgerAccount.findUnique({ where: { bankAccountId: account.id } });
if (!ledgerAccount) {
  throw new Error(`Bank account ${account.id} has no ledger account`);
}
```

### Data Corruption Evidence

- Transactions exist with `ledgerGroupId` values
- BUT querying `LedgerEntry` by those `groupId` values returns 0 results
- This suggests ledger entries were either never created or were deleted
- The `balanceCache` values have no authoritative ledger backing

### Current Provisioning IS Correct

The current `features/authentication/provision-accounts.ts` logic **does create LedgerAccounts atomically** when provisioning new users. This issue affects only **legacy accounts** created before this fix.

## Repair Action Taken

### Strategy

**Structural repair only** - do not attempt to reconstruct financial history.

1. ✅ Create missing LedgerAccounts linked to the correct BankAccount
2. ✅ Set LedgerAccount type to ASSET
3. ✅ Link via `bankAccountId` foreign key
4. ❌ Do NOT create ledger entries
5. ❌ Do NOT modify `balanceCache`
6. ⚠️ Ledger accounts start at **ZERO balance**

### Script Used

```bash
DRY_RUN=false npx tsx scripts/safe-repair-ledger-accounts.ts
```

### Result

- **14 LedgerAccounts created successfully**
- **0 failures**
- All accounts now have the required LedgerAccount structure
- Withdrawals will no longer fail with "no ledger account" error

## Current State

### What Works Now

✅ Withdrawals can be **initiated** from these accounts  
✅ The structural requirement (LedgerAccount exists) is satisfied  
✅ No more "Account has no ledger account" runtime errors

### Critical Discrepancy

⚠️ **LEDGER BALANCE:** $0.00 (newly created, empty)  
⚠️ **BALANCE CACHE:** $49,497.50 total (historical, unverified)

**This discrepancy means:**
- The system does not know the authoritative balance
- Ledger integrity is compromised for these 14 accounts
- Manual financial reconciliation is required

## Validation Results

### Typecheck
✅ **PASS** - No type errors

### Lint
✅ **PASS** - No ESLint warnings or errors

### Tests
✅ **PASS** - 237/237 tests passing

All test suites passed, including:
- `withdrawal-source-destination-mapping.test.ts` (5 tests)
- `withdrawal-minimum-policy.test.ts` (8 tests)
- `withdrawal-approval-policy.test.ts` (8 tests)
- `admin-funding.test.ts` (11 tests)
- `zero-provisioning.test.ts` (8 tests)
- All other 34 test files (195 tests)

## Recommended Next Steps

### Immediate (Required)

1. **Flag affected accounts for reconciliation**
   - Add a `needsReconciliation` flag to BankAccount model
   - Mark these 14 accounts in the database
   - Display warning in UI when viewing these accounts

2. **Audit transaction history**
   - For each affected account, review all Transaction records
   - Determine what financial operations were performed
   - Identify source of `balanceCache` values

3. **Freeze or restrict operations**
   - Consider temporarily disabling withdrawals from affected accounts
   - Allow view-only access until reconciliation is complete
   - Notify affected users about the reconciliation process

### Short-term (Recommended)

4. **Determine authoritative balances**
   - Review external records (bank statements, admin funding logs, etc.)
   - Reconstruct financial history where provenance is clear
   - Document any gaps or unknowns

5. **Create corrective ledger entries**
   - IF provenance is unambiguous, create ledger entries to reflect true balances
   - Ensure all entries maintain double-entry integrity (DEBITS = CREDITS)
   - Use a special "Reconciliation Adjustment" reference type

6. **Update UI to show ledger balance**
   - Display authoritative ledger balance, not `balanceCache`
   - Show discrepancy warning if cache differs from ledger
   - Allow admins to view both values for comparison

### Long-term (Preventive)

7. **Add database constraints**
   - Consider a database trigger or constraint ensuring BankAccount → LedgerAccount relationship
   - Alternatively, make `bankAccountId` required in LedgerAccount for certain types

8. **Add runtime validation**
   - On application startup, verify all CURRENT/SAVINGS accounts have ledger accounts
   - Log warnings for any orphaned accounts
   - Consider a health-check endpoint for monitoring

9. **Review historical provisioning**
   - Investigate when/how these 14 accounts were created
   - Determine if there are other account types with similar issues
   - Document the legacy provisioning method for forensic purposes

10. **Comprehensive data integrity audit**
    - Scan for other potential orphaned relationships
    - Verify all CryptoWallet → LedgerAccount relationships
    - Check for any ledger entries without corresponding transactions

## Files Changed

### Scripts Created

1. `scripts/investigate-account-cmtgu68wh000n1821y06181si.ts`
   - Diagnostic script for the specific failing account
   - Shows account details, ledger status, transaction history

2. `scripts/investigate-ledger-structure.ts`
   - Explores how transactions create ledger entries
   - Shows all ledger accounts and their relationships

3. `scripts/safe-repair-ledger-accounts.ts` ⭐
   - **Primary repair script**
   - Creates missing LedgerAccounts safely
   - DRY_RUN mode for safety
   - Used to fix the 14 affected accounts

4. `scripts/repair-missing-ledger-accounts.ts`
   - Alternative repair script (not used)
   - Includes balance calculation logic (more complex, deemed unnecessary)

### Documentation

5. `LEDGER-ACCOUNT-REPAIR-SUMMARY.md` (this file)

## Prevention: Current Provisioning is Correct

The current account provisioning logic in `features/authentication/provision-accounts.ts` **correctly creates LedgerAccounts atomically**:

```typescript
const currentAccount = await tx.bankAccount.create({ /* ... */ });
const savingsAccount = await tx.bankAccount.create({ /* ... */ });

await tx.ledgerAccount.create({
  data: {
    type: "ASSET",
    assetSymbol: fiatCurrency,
    name: "FHT Current Account",
    bankAccountId: currentAccount.id,  // ✅ Correctly linked
  },
});
await tx.ledgerAccount.create({
  data: {
    type: "ASSET",
    assetSymbol: fiatCurrency,
    name: "FHT Savings Account",
    bankAccountId: savingsAccount.id,  // ✅ Correctly linked
  },
});
```

**New users registered after this fix will NOT have this issue.**

## Conclusion

### Issue Resolution

✅ **Structural repair complete** - all 14 accounts now have LedgerAccounts  
✅ **Withdrawals unblocked** - runtime error eliminated  
✅ **Tests passing** - no regressions introduced  
✅ **Prevention in place** - current provisioning logic is correct

### Outstanding Work

⚠️ **Financial reconciliation required** - $49,497.50 USD in unverified balances  
⚠️ **Manual investigation needed** - determine authoritative balances  
⚠️ **User communication** - notify affected users about reconciliation process

The immediate technical blocker (missing LedgerAccounts) has been resolved. The financial integrity issue (unverified balances) requires business-level decision-making and manual reconciliation.

---

**Script execution completed:** September 11, 2026  
**Affected accounts:** 14  
**Repair status:** Structural repair complete  
**Next action:** Financial reconciliation and user notification
