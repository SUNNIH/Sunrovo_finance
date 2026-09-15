# Build Fix: Node.js Crypto Module in Browser Bundle

**Status:** ✅ RESOLVED  
**Date:** Production Build Failure Fix  
**Issue:** Client component importing `node:crypto` causing build failure

---

## Root Cause

**deposit-client.tsx** (a Client Component with `"use client"` directive) was importing `NETWORK_BY_ASSET` from `features/treasury/demo-address.ts`, which uses `node:crypto` for deterministic address generation.

### The Problem Chain

```
node:crypto (Node.js only)
  ↓ imported by
features/treasury/demo-address.ts
  ↓ imported by
app/(platform)/deposit/deposit-client.tsx ("use client")
  ↓ bundled for
Browser (no node:crypto available)
  ↓ result
Build Failure
```

**Why this happened:**
- `demo-address.ts` contained both:
  - Server-only logic: `getDemoDepositAddress()` using `node:crypto`
  - Browser-safe config: `NETWORK_BY_ASSET` constants
- Client component only needed the constants, but importing from the module pulled in the `node:crypto` dependency
- Next.js build correctly detected this as a bundling violation

---

## The Fix

### Strategy: Separate Browser-Safe Configuration

Created a shared module containing ONLY browser-safe constants with NO `node:*` imports.

### 1. Created Browser-Safe Module

**File:** `features/treasury/deposit-networks.ts` (NEW)

```typescript
/**
 * Deposit Network Configuration (Browser-Safe)
 *
 * Shared configuration for supported crypto assets and their networks.
 * NO node:* imports - safe for client components.
 */

export const NETWORK_BY_ASSET: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum (ERC-20)",
  SOL: "Solana",
  XRP: "XRP Ledger",
  USDT: "Ethereum (ERC-20)",
  PLT: "PLT Demo Network",
};

export const PREFIX_BY_ASSET: Record<string, string> = {
  BTC: "bc1demo",
  ETH: "0xdemo",
  SOL: "SoLDemo",
  XRP: "rDemo",
  USDT: "0xdemo",
  PLT: "pltdemo",
};
```

### 2. Updated Server Module to Import Shared Config

**File:** `features/treasury/demo-address.ts` (MODIFIED)

**Before:**
```typescript
import { createHash } from "node:crypto";

export const NETWORK_BY_ASSET: Record<string, string> = { /* ... */ };
const PREFIX_BY_ASSET: Record<string, string> = { /* ... */ };

export function getDemoDepositAddress(/*...*/) { /* ... */ }
```

**After:**
```typescript
import { createHash } from "node:crypto";
import { NETWORK_BY_ASSET, PREFIX_BY_ASSET } from "./deposit-networks";

/**
 * SERVER-ONLY: Uses node:crypto for deterministic hash generation.
 */
export function getDemoDepositAddress(/*...*/) { /* ... */ }
```

### 3. Updated Client Component to Import from Browser-Safe Module

**File:** `app/(platform)/deposit/deposit-client.tsx` (MODIFIED)

**Before:**
```typescript
import { NETWORK_BY_ASSET } from "@/features/treasury/demo-address";
```

**After:**
```typescript
import { NETWORK_BY_ASSET } from "@/features/treasury/deposit-networks";
```

### 4. Updated Test Files

**Files:** `tests/unit/deposit-qr.test.ts`, `tests/unit/withdraw-ui.test.ts` (MODIFIED)

Updated imports to use browser-safe module for constants:
```typescript
import { getDemoDepositAddress } from "@/features/treasury/demo-address";
import { NETWORK_BY_ASSET } from "@/features/treasury/deposit-networks";
```

---

## Import Boundary After Fix

### Client Components (Browser Bundle)
```
app/(platform)/deposit/deposit-client.tsx
  ↓ imports
features/treasury/deposit-networks.ts (browser-safe)
  ✅ NO node:* imports
```

### Server Components/API Routes
```
app/api/deposits/crypto/route.ts
features/treasury/deposits.ts
  ↓ imports
features/treasury/demo-address.ts (server-only)
  ↓ imports
node:crypto (Node.js built-in) ✅
features/treasury/deposit-networks.ts (browser-safe) ✅
```

### Test Files (Node.js Environment)
```
tests/unit/demo-address.test.ts
tests/unit/deposit-qr.test.ts
  ↓ imports
features/treasury/demo-address.ts ✅ (server function)
features/treasury/deposit-networks.ts ✅ (constants)
```

---

## Files Changed

### Created
1. **features/treasury/deposit-networks.ts** - Browser-safe constants module

### Modified
2. **features/treasury/demo-address.ts** - Imports shared config, keeps only server logic
3. **app/(platform)/deposit/deposit-client.tsx** - Imports from browser-safe module
4. **tests/unit/deposit-qr.test.ts** - Separate imports for function vs constants
5. **tests/unit/withdraw-ui.test.ts** - Imports constants from browser-safe module

### Not Modified
- No polyfills added
- No webpack config changes
- No `node:*` modules moved to client
- Server-side address generation preserved intact

---

## Validation Results

### Build Result
```bash
npm run build
✅ Exit 0
✅ Compiled successfully in 28.6s
✅ Generating static pages (70/70)
✅ Build complete - no errors
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

### Tests
```bash
npm run test -- --run
✅ 237/237 PASS (39 test files)
```

---

## Behavior Preserved

✅ **Deposit QR functionality unchanged**
- Client still displays correct asset/network labels
- QR codes still encode actual deposit addresses
- Supported crypto assets list unchanged

✅ **Server-side address generation unchanged**
- `getDemoDepositAddress()` still uses `node:crypto`
- Deterministic hashing still works correctly
- Address format/prefixes unchanged

✅ **Test coverage maintained**
- All 13 deposit QR tests pass
- All 5 demo address tests pass
- All withdrawal UI tests pass

---

## Why This Approach is Correct

### ✅ Proper Separation of Concerns
- Configuration (browser-safe) separated from logic (server-only)
- Client gets only what it needs
- Server keeps full functionality

### ✅ No Security Compromises
- No `node:crypto` polyfills that could expose weak implementations
- Server-side cryptographic operations remain server-side
- No secrets or sensitive logic moved to client

### ✅ Maintainable
- Clear import boundaries
- Single source of truth for asset/network config
- TypeScript enforces correct usage

### ✅ No Workarounds
- No webpack fallbacks
- No dynamic imports to hide the issue
- No build config hacks

---

## Technical Details

### Next.js App Router Client/Server Boundary

Next.js 15 with App Router enforces strict bundling rules:
- Client Components (`"use client"`) → Browser bundle (no Node.js APIs)
- Server Components (default) → Server-only (can use Node.js APIs)
- API Routes → Server-only (can use Node.js APIs)

### Why `node:crypto` Cannot Be in Browser Bundle

1. **Not available:** Browsers don't have `node:crypto`
2. **Polyfills are inappropriate:** Crypto polyfills for browsers use different APIs (Web Crypto) with different semantics
3. **Security:** Deterministic server-side hashing should not be replicated client-side

### The Correct Solution

Extract shared **data** (constants, types, configs) into a module with no Node.js dependencies. Keep **logic** that requires Node.js APIs in server-only modules.

---

## Summary

**Problem:** Client component importing server-only module with `node:crypto`  
**Solution:** Created browser-safe shared config module  
**Result:** Build succeeds, all tests pass, no behavior changes  

**Import boundary is now correct:**
- Client: imports only browser-safe constants
- Server: imports constants + uses `node:crypto` for logic
- Tests: can access both as needed (Node.js environment)

---

**Build Fix Complete - Production Ready ✅**
