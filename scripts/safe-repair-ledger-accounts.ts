#!/usr/bin/env tsx
/**
 * Safe Repair Script for Missing Ledger Accounts
 * 
 * This script repairs bank accounts that are missing their required LedgerAccounts.
 * 
 * STRATEGY:
 * - Create missing LedgerAccounts linked to the correct BankAccount
 * - DO NOT try to reconstruct historical ledger balances
 * - Create ledger accounts at ZERO balance
 * - Mark the system for reconciliation
 * - The discrepancy between balanceCache and ledger will need manual admin review
 * 
 * SAFETY:
 * - Read-only by default (DRY_RUN=true)
 * - Only repairs withdrawal-eligible account types (CURRENT, SAVINGS)
 * - Creates ledger accounts with proper foreign key relationships
 * - Does not modify balanceCache
 * - Does not create ledger entries
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN !== 'false';
const WITHDRAWAL_ELIGIBLE_TYPES = ['CURRENT', 'SAVINGS'] as const;

interface RepairAction {
  bankAccountId: string;
  accountType: string;
  currencySymbol: string;
  accountNumber: string;
  balanceCache: string;
  userId: string;
  nickname: string | null;
}

async function findAccountsNeedingRepair(): Promise<RepairAction[]> {
  const actions: RepairAction[] = [];

  // Find all withdrawal-eligible bank accounts
  const accounts = await prisma.bankAccount.findMany({
    where: {
      type: { in: ['CURRENT', 'SAVINGS'] },
    },
    select: {
      id: true,
      type: true,
      currencySymbol: true,
      accountNumber: true,
      balanceCache: true,
      userId: true,
      nickname: true,
    },
  });

  for (const account of accounts) {
    // Check if ledger account exists
    const ledgerAccount = await prisma.ledgerAccount.findUnique({
      where: { bankAccountId: account.id },
    });

    if (!ledgerAccount) {
      actions.push({
        bankAccountId: account.id,
        accountType: account.type,
        currencySymbol: account.currencySymbol,
        accountNumber: account.accountNumber,
        balanceCache: account.balanceCache.toString(),
        userId: account.userId,
        nickname: account.nickname,
      });
    }
  }

  return actions;
}

async function repairAccount(action: RepairAction): Promise<boolean> {
  try {
    await prisma.ledgerAccount.create({
      data: {
        type: 'ASSET',
        assetSymbol: action.currencySymbol,
        name: action.nickname || `${action.accountType} Account Ledger`,
        bankAccountId: action.bankAccountId,
      },
    });

    console.log(`  ✅ Created LedgerAccount for ${action.accountType} ${action.accountNumber}`);
    console.log(`     Bank Account ID: ${action.bankAccountId}`);
    console.log(`     Currency: ${action.currencySymbol}`);
    console.log(`     Balance Cache: ${action.balanceCache} (NOT transferred to ledger)`);
    return true;
  } catch (error) {
    console.error(`  ❌ Failed to repair ${action.accountType} ${action.accountNumber}:`);
    console.error(`     ${error}`);
    return false;
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log('Safe Ledger Account Repair');
  console.log('='.repeat(70));
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (read-only)' : 'LIVE (will apply repairs)'}`);
  console.log(`Eligible types: ${WITHDRAWAL_ELIGIBLE_TYPES.join(', ')}\n`);

  console.log('1. Scanning for accounts needing repair...\n');
  
  const actions = await findAccountsNeedingRepair();

  if (actions.length === 0) {
    console.log('✅ No repairs needed - all withdrawal-eligible accounts have ledger accounts\n');
    return;
  }

  console.log(`Found ${actions.length} accounts needing repair:\n`);

  let totalBalanceCacheUSD = 0;
  
  for (const action of actions) {
    console.log(`  ${action.accountType} ${action.accountNumber}`);
    console.log(`    ID: ${action.bankAccountId}`);
    console.log(`    Currency: ${action.currencySymbol}`);
    console.log(`    Balance Cache: ${action.balanceCache}`);
    console.log(`    User: ${action.userId}`);
    
    // Track total exposure
    if (action.currencySymbol === 'USD') {
      totalBalanceCacheUSD += parseFloat(action.balanceCache);
    }
    console.log();
  }

  console.log(`Total USD exposure in balance caches: $${totalBalanceCacheUSD.toFixed(2)}`);
  console.log();

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
    console.log('REPAIR PLAN:');
    console.log('  1. Create LedgerAccount for each bank account');
    console.log('  2. Link LedgerAccount to BankAccount via bankAccountId foreign key');
    console.log('  3. Set LedgerAccount type to ASSET');
    console.log('  4. DO NOT create ledger entries');
    console.log('  5. DO NOT modify balanceCache');
    console.log('  6. Ledger accounts start at ZERO balance');
    console.log('\nRESULT:');
    console.log('  - Withdrawals will no longer fail with "no ledger account" error');
    console.log('  - Ledger balance will be ZERO');
    console.log('  - balanceCache will show historical value');
    console.log('  - DISCREPANCY will exist and require reconciliation');
    console.log('\nWARNING:');
    console.log('  This repair creates the structural requirement (LedgerAccount)');
    console.log('  but does NOT reconstruct financial history.');
    console.log('  The system will need manual reconciliation to understand');
    console.log('  where the balanceCache values came from.');
    console.log('\nTo proceed: DRY_RUN=false npx tsx scripts/safe-repair-ledger-accounts.ts');
    return;
  }

  console.log('2. Applying repairs...\n');

  let successCount = 0;
  let failCount = 0;

  for (const action of actions) {
    const success = await repairAccount(action);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Repair Complete: ${successCount} succeeded, ${failCount} failed`);
  console.log('='.repeat(70));

  if (successCount > 0) {
    console.log('\n⚠️  CRITICAL: System now requires financial reconciliation');
    console.log('\nLedger accounts were created at ZERO balance.');
    console.log('balanceCache values represent historical user balances.');
    console.log('\nNext steps:');
    console.log('  1. Audit transaction history for each affected account');
    console.log('  2. Determine authoritative balance for each account');
    console.log('  3. Create corrective ledger entries if provenance is clear');
    console.log('  4. Update withdrawal UI to show ledger balance, not balanceCache');
    console.log('  5. Consider freezing affected accounts until reconciliation complete');
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
