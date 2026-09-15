# Withdrawal Source/Destination Mapping Fix

**Status:** ✅ RESOLVED  
**Date:** Phase 9 Withdrawal Runtime Failure Investigation  
**Issue:** "Account cmtn8f2hy000x10i0z359db6g has no ledger account"

---

## Root Cause Analysis

### The Problem

**A user is withdrawing FROM an FHT account TO an external bank account.**

The error occurred because:

1. **Client Issue:** The withdrawal UI displayed an account selector (`selectedAccountId`) but **did NOT send** the selected account ID to the backend
2. **Backend Issue:** The backend used `findFirst({ userId, currencySymbol })` to locate the source account
3. **Wrong Account Selected:** `findFirst()` returned ANY account matching the user + currency, which could be:
   - A Foreign Currency account without a ledger account
   - A Fixed Deposit account without a ledger account
   - ANY same-currency account other than the one the user selected

4. **External Destination Was NOT the Problem:** The external bank account was correctly treated as a string destination, not an FHT account

### The Impact

- Users with multiple same-currency accounts (e.g., Current + Savings both in USD) could not control which account was debited
- The backend silently substituted a different account, breaking financial provenance
- If the substituted account had no ledger account, the withdrawal failed with the reported error

---

## The Fix

### 1. Added `sourceAccountId` to Withdrawal Schema

**File:** `lib/validation/treasury.ts`

```typescript
export const withdrawalSchema = z.object({
  sourceAccountId: z.string().min(1, "Select a source account"), // NEW
  assetSymbol: z.string().trim().toUpperCase(),
  amount: amountSchema,
  destination: z.string().trim().min(4, "Enter a valid destination").max(120),
  transactionPin: z.string().regex(/^\d{4,6}$/, "Enter your 4-6 digit transaction PIN"),
});
```

### 2. Client Sends Selected Account ID

**File:** `app/(platform)/withdraw/withdraw-client.tsx`

```typescript
const response = await postJsonIdempotent<{ withdrawal: WithdrawalReceipt }>(
  "/api/withdrawals",
  {
    sourceAccountId: selectedAccountId, // NEW - sends the exact account selected by user
    assetSymbol: activeAssetSymbol,
    amount: amount,
    destination: destination.trim(),
    transactionPin: pin,
  },
  idempotencyKeyRef.current
);
```

### 3. Backend Uses Exact Account ID

**File:** `features/treasury/withdrawals.ts`

**Before:**
```typescript
// WRONG: Used findFirst which could return ANY matching account
const account = await tx.bankAccount.findFirst({ 
  where: { userId, currencySymbol: input.assetSymbol } 
});
```

**After:**
```typescript
// CORRECT: Uses exact account ID with full validation
const account = await tx.bankAccount.findFirst({
  where: {
    id: input.sourceAccountId,        // Exact account user selected
    userId,                            // Must belong to this user
    currencySymbol: input.assetSymbol, // Must match asset symbol
  },
});
```

---

## Final Request Mapping

### Client → API Payload

```json
{
  "sourceAccountId": "clx123abc456def789",  // Exact FHT source account
  "assetSymbol": "USD",
  "amount": "100.00",
  "destination": "External Bank •••• 1234",  // External destination string
  "transactionPin": "1234"
}
```

### Backend Processing

1. ✅ Validate `sourceAccountId` is provided (schema)
2. ✅ Find exact account by `id` + `userId` + `currencySymbol`
3. ✅ Verify account belongs to requesting user (ownership)
4. ✅ Verify account currency matches asset symbol (consistency)
5. ✅ Verify account has ledger account (requirement)
6. ✅ Process withdrawal from EXACT selected account
7. ✅ External destination treated as string (not resolved as FHT account)

---

## Regression Test

**File:** `tests/unit/withdrawal-source-destination-mapping.test.ts`

### Test Coverage

✅ **User can have multiple same-currency accounts**
- Creates both Current and Savings accounts in USD
- Each with separate balances and ledger accounts

✅ **Selected sourceAccountId is the account actually debited**
- Test withdraws from Current → only Current is debited
- Test withdraws from Savings → only Savings is debited
- Other account balance remains unchanged

✅ **Backend cannot silently substitute another account**
- Wrong account ID → rejects with "No USD account found"
- Another user's account ID → rejects (ownership check)

✅ **External destination is treated only as destination**
- Destination is stored as string (e.g., "Chase •••• 5678")
- No BankAccount lookup for destination
- Proves external bank accounts are NOT resolved as FHT accounts

✅ **Source account must belong to the user**
- Attempting to use another user's account → rejected

✅ **Source account currency must match assetSymbol**
- Account lookup requires matching currency

### Test Results

```
✅ withdraws from EXACT source account selected by user (Current Account)
✅ withdraws from EXACT source account selected by user (Savings Account)
✅ rejects withdrawal if wrong account ID provided
✅ rejects withdrawal if account belongs to different user
✅ external destination is NOT resolved as FHT account

5/5 PASS
```

---

## Files Changed

### Modified Files

1. **lib/validation/treasury.ts**
   - Added `sourceAccountId` field to `withdrawalSchema`

2. **app/(platform)/withdraw/withdraw-client.tsx**
   - Client now sends `sourceAccountId: selectedAccountId` in withdrawal request

3. **features/treasury/withdrawals.ts**
   - Backend uses exact account lookup: `id` + `userId` + `currencySymbol`
   - Removed `findFirst({ userId, currencySymbol })` which could return wrong account

4. **tests/unit/withdrawal-approval-policy.test.ts**
   - Updated all 9 `createWithdrawal()` calls to include `sourceAccountId: accountId`

5. **tests/unit/withdrawal-minimum-policy.test.ts**
   - Updated all 8 `createWithdrawal()` calls to include correct `sourceAccountId`
   - USD tests use `accountId`
   - GBP tests use `gbpAccountId`
   - Crypto rejection tests use placeholder (rejected before account lookup)

### Created Files

6. **tests/unit/withdrawal-source-destination-mapping.test.ts**
   - New regression test suite (5 tests)
   - Proves exact source account selection
   - Proves external destination handling

7. **WITHDRAWAL-SOURCE-FIX.md**
   - This documentation file

---

## Validation Results

### Focused Tests

```bash
npm run test -- --run tests/unit/withdrawal-source-destination-mapping.test.ts
✅ 5/5 PASS

npm run test -- --run tests/unit/withdrawal-minimum-policy.test.ts
✅ 8/8 PASS

npm run test -- --run tests/unit/withdrawal-approval-policy.test.ts
✅ 8/8 PASS
```

### Full Test Suite

```bash
npm run test -- --run
✅ 237/237 PASS
✅ 39 test files
```

### Type Safety

```bash
npm run typecheck
✅ Exit 0 - No TypeScript errors
```

### Linting

```bash
npm run lint
✅ Exit 0 - No ESLint warnings or errors
```

---

## No Remaining Blockers

✅ **Root cause identified and fixed**
- Client now sends exact source account ID
- Backend uses exact account lookup with ownership validation

✅ **Regression test proves fix**
- Multiple same-currency accounts work correctly
- Exact account selection is enforced
- External destinations handled properly

✅ **All tests pass**
- No new regressions introduced
- Existing withdrawal functionality preserved

✅ **Ledger account requirement NOT weakened**
- Source account must have ledger account
- Error message remains clear: "Account X has no ledger account"
- Fix resolves lookup issue, does not bypass validation

---

## Technical Summary

**Root Cause:** Wrong source/destination mapping - client did NOT send `sourceAccountId`, backend used `findFirst()` which could resolve wrong same-currency account

**Fix Type:** A - Wrong source/destination mapping introduced in earlier phases (not Phase 8 specific)

**Solution:** Added `sourceAccountId` to schema, client sends selected account, backend uses exact ID lookup

**Safety:** All ledger checks preserved, no weakening of financial controls

**Testing:** Comprehensive regression suite + all existing tests pass

**Impact:** Users can now reliably withdraw from their selected FHT account to external bank destinations

---

**Withdrawal Source/Destination Mapping - RESOLVED ✅**
