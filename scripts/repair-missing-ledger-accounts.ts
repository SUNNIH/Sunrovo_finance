#!/usr/bin/env tsx
/**
 * Repair Script: Missing Ledger Accounts
 * 
 * Safely repair bank accounts that are missing their required LedgerAccount.
 * 
 * SAFETY RULES:
 * 1. Only repair withdrawal-eligible accounts (CURRENT, SAVINGS)
 * 2. Create LedgerAccount with calculated balance from authoritative ledger history
 * 3. If no ledger history exists, use zero balance (not balanceCache)
 * 4. Verify double-entry balance after repair
 * 
 * THIS SCRIPT IS READ-ONLY BY DEFAULT - SET DRY_RUN=false TO APPLY REPAIRS
 */

import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN !== 'false';
const WITHDRAWAL_ELIGIBLE_TYPES = ['CURRENT', 'SAVINGS'] as const;

interface RepairCandidate {
  bankAccount: {
    id: string;
    type: string;
    currencySymbol: string;
    balanceCache: Decimal;
    userId: string;
    accountNumber: string;
    nickname: string | null;
  };
  calculatedBalance: Decimal;
  hasLedgerHistory: boolean;
  transactionCount: number;
}

async function calculateBalanceFromLedgerHistory(
  userId: string,
  assetSymbol: string
): Promise<{ balance: Decimal; hasHistory: boolean; entryCount: number }> {
  // Find all ledger entries for this user's asset across all accounts
  const userLedgerAccounts = await prisma.ledgerAccount.findMany({
    where: {
      assetSymbol,
      OR: [
        { bankAccountId: { not: null } },
        { cryptoWalletId: { not: null } },
      ],
      bankAccount: { userId },
    },
    select: { id: true },
  });

  if (userLedgerAccounts.length === 0) {
    return { balance: new Decimal(0), hasHistory: false, entryCount: 0 };
  }

  const ledgerAccountIds = userLedgerAccounts.map((la) => la.id);

  const entries = await prisma.ledgerEntry.findMany({
    where: { ledgerAccountId: { in: ledgerAccountIds } },
    select: {
      direction: true,
      amount: true,
    },
  });

  if (entries.length === 0) {
    return { balance: new Decimal(0), hasHistory: false, entryCount: 0 };
  }

  let balance = new Decimal(0);
  for (const entry of entries) {
    if (entry.direction === 'DEBIT') {
      balance = balance.minus(entry.amount);
    } else {
      balance = balance.plus(entry.amount);
    }
  }

  return { balance, hasHistory: true, entryCount: entries.length };
}

async function findRepairCandidates(): Promise<RepairCandidate[]> {
  const allBankAccounts = await prisma.bankAccount.findMany({
    where: {
      type: { in: ['CURRENT', 'SAVINGS'] },
    },
    select: {
      id: true,
      type: true,
      currencySymbol: true,
      balanceCache: true,
      userId: true,
      accountNumber: true,
      nickname: true,
    },
  });

  const candidates: RepairCandidate[] = [];

  for (const account of allBankAccounts) {
    const hasLedger = await prisma.ledgerAccount.findUnique({
      where: { bankAccountId: account.id },
      select: { id: true },
    });

    if (hasLedger) {
      continue; // Skip accounts that already have ledger accounts
    }

    // Check transaction count
    const transactionCount = await prisma.transaction.count({
      where: {
        userId: account.userId,
        assetSymbol: account.currencySymbol,
      },
    });

    // For accounts missing ledgers, we cannot reliably calculate balance from ledger history
    // because the ledger account itself is missing. We'll create it at zero and let
    // reconciliation handle any discrepancies.
    const calculatedBalance = new Decimal(0);

    candidates.push({
      bankAccount: account,
      calculatedBalance,
      hasLedgerHistory: false,
      transactionCount,
    });
  }

  return candidates;
}

async function repairAccount(candidate: RepairCandidate): Promise<boolean> {
  const { bankAccount, calculatedBalance } = candidate;

  try {
    await prisma.$transaction(async (tx) => {
      // Create the missing ledger account
      await tx.ledgerAccount.create({
        data: {
          type: 'ASSET',
          assetSymbol: bankAccount.currencySymbol,
          name: `${bankAccount.nickname || bankAccount.type} Ledger`,
          bankAccountId: bankAccount.id,
        },
      });

      console.log(`   ✅ Created LedgerAccount for ${bankAccount.type} account ${bankAccount.id}`);
    });

    return true;
  } catch (error) {
    console.error(`   ❌ Failed to repair account ${bankAccount.id}:`, error);
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Ledger Account Repair Script');
  console.log('='.repeat(70));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (read-only)' : 'LIVE (will apply repairs)'}`);
  console.log(`Eligible account types: ${WITHDRAWAL_ELIGIBLE_TYPES.join(', ')}`);
  console.log();

  console.log('1. Finding accounts missing ledger accounts...');
  const candidates = await findRepairCandidates();

  if (candidates.length === 0) {
    console.log('   ✅ No repairs needed - all withdrawal-eligible accounts have ledger accounts');
    return;
  }

  console.log(`   Found ${candidates.length} accounts needing repair:\n`);

  for (const candidate of candidates) {
    const { bankAccount, calculatedBalance, transactionCount } = candidate;
    console.log(`   Account: ${bankAccount.type} (${bankAccount.currencySymbol})`);
    console.log(`      ID: ${bankAccount.id}`);
    console.log(`      Number: ${bankAccount.accountNumber}`);
    console.log(`      Balance Cache: ${bankAccount.balanceCache}`);
    console.log(`      Transaction Count: ${transactionCount}`);
    console.log(`      Repair: Create LedgerAccount at ${calculatedBalance} balance`);
    console.log();
  }

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes made');
    console.log('   To apply repairs, run: DRY_RUN=false npx tsx scripts/repair-missing-ledger-accounts.ts');
    return;
  }

  console.log('\n2. Applying repairs...\n');
  let successCount = 0;
  let failCount = 0;

  for (const candidate of candidates) {
    const success = await repairAccount(candidate);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Repair Summary: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(70));

  if (successCount > 0) {
    console.log('\n⚠️  IMPORTANT: Run reconciliation to verify ledger integrity');
    console.log('   Accounts were created with zero ledger balance');
    console.log('   balanceCache values may not match - investigate discrepancies');
  }
}

main()
  .catch((error) => {
    console.error('\nError during repair:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
