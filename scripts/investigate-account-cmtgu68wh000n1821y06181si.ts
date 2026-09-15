#!/usr/bin/env tsx
/**
 * Investigation Script: Account cmtgu68wh000n1821y06181si
 * 
 * Diagnose why this account has no ledger account.
 * Determine if this is an eligibility or provisioning issue.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const accountId = 'cmtgu68wh000n1821y06181si';
  
  console.log('='.repeat(70));
  console.log('Account Investigation: cmtgu68wh000n1821y06181si');
  console.log('='.repeat(70));

  // 1. Inspect the BankAccount
  const account = await prisma.bankAccount.findUnique({
    where: { id: accountId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
        },
      },
    },
  });

  if (!account) {
    console.log('\n❌ Account NOT FOUND');
    return;
  }

  console.log('\n1. BANK ACCOUNT DETAILS:');
  console.log(`   ID: ${account.id}`);
  console.log(`   Type: ${account.type}`);
  console.log(`   Currency: ${account.currencySymbol}`);
  console.log(`   Account Number: ${account.accountNumber}`);
  console.log(`   Balance Cache: ${account.balanceCache}`);
  console.log(`   Is Primary: ${account.isPrimary}`);
  console.log(`   Nickname: ${account.nickname || '(none)'}`);
  console.log(`   Created At: ${account.createdAt}`);
  console.log(`   Updated At: ${account.updatedAt}`);

  console.log('\n2. ACCOUNT OWNER:');
  console.log(`   User ID: ${account.user.id}`);
  console.log(`   Email: ${account.user.email}`);
  console.log(`   Role: ${account.user.role}`);
  console.log(`   Status: ${account.user.status}`);

  // 2. Check for LedgerAccount
  const ledgerAccount = await prisma.ledgerAccount.findUnique({
    where: { bankAccountId: accountId },
  });

  console.log('\n3. LEDGER ACCOUNT:');
  if (ledgerAccount) {
    console.log(`   ✅ EXISTS`);
    console.log(`   ID: ${ledgerAccount.id}`);
    console.log(`   Type: ${ledgerAccount.type}`);
    console.log(`   Asset: ${ledgerAccount.assetSymbol}`);
    console.log(`   Name: ${ledgerAccount.name}`);
  } else {
    console.log(`   ❌ MISSING`);
  }

  // 3. Check transaction history
  const transactions = await prisma.transaction.findMany({
    where: {
      userId: account.userId,
      assetSymbol: account.currencySymbol,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('\n4. TRANSACTION HISTORY (last 10):');
  if (transactions.length === 0) {
    console.log(`   No transactions found`);
  } else {
    transactions.forEach((tx, i) => {
      console.log(`   ${i + 1}. ${tx.type} ${tx.direction} ${tx.amount} ${tx.assetSymbol} - ${tx.status} (${tx.createdAt})`);
    });
  }

  // 4. Check ledger entries if ledger account exists
  if (ledgerAccount) {
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: { ledgerAccountId: ledgerAccount.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log('\n5. LEDGER ENTRIES (last 10):');
    if (ledgerEntries.length === 0) {
      console.log(`   No ledger entries found`);
    } else {
      ledgerEntries.forEach((entry, i) => {
        console.log(`   ${i + 1}. ${entry.direction} ${entry.amount} ${entry.assetSymbol} (${entry.createdAt})`);
      });
    }
  }

  // 5. Check admin funding history
  console.log('\n6. ADMIN FUNDING HISTORY:');
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: 'admin.fund_user',
      targetType: 'BankAccount',
      targetId: accountId,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (auditLogs.length === 0) {
    console.log(`   No admin funding found`);
  } else {
    auditLogs.forEach((log, i) => {
      console.log(`   ${i + 1}. Admin: ${log.actorUserId} - ${log.createdAt}`);
      console.log(`      Metadata: ${JSON.stringify(log.metadata)}`);
    });
  }

  // 6. Check all user's bank accounts
  console.log('\n7. USER\'S ALL BANK ACCOUNTS:');
  const allAccounts = await prisma.bankAccount.findMany({
    where: { userId: account.userId },
    select: {
      id: true,
      type: true,
      currencySymbol: true,
      balanceCache: true,
      isPrimary: true,
      createdAt: true,
    },
  });

  for (const acc of allAccounts) {
    const hasLedger = await prisma.ledgerAccount.findUnique({
      where: { bankAccountId: acc.id },
      select: { id: true },
    });
    console.log(`   ${acc.type} (${acc.currencySymbol}) - Balance: ${acc.balanceCache} - Ledger: ${hasLedger ? '✅' : '❌'} - Primary: ${acc.isPrimary}`);
  }

  // 7. Search for other accounts missing ledger accounts
  console.log('\n8. DATABASE-WIDE LEDGER ACCOUNT GAPS:');
  const allBankAccounts = await prisma.bankAccount.findMany({
    select: {
      id: true,
      type: true,
      currencySymbol: true,
      balanceCache: true,
      userId: true,
    },
  });

  const missingLedgers: Array<{ id: string; type: string; currency: string; balance: string }> = [];
  
  for (const acc of allBankAccounts) {
    const hasLedger = await prisma.ledgerAccount.findUnique({
      where: { bankAccountId: acc.id },
      select: { id: true },
    });
    if (!hasLedger) {
      missingLedgers.push({
        id: acc.id,
        type: acc.type,
        currency: acc.currencySymbol,
        balance: acc.balanceCache.toString(),
      });
    }
  }

  if (missingLedgers.length === 0) {
    console.log(`   ✅ All bank accounts have ledger accounts`);
  } else {
    console.log(`   ❌ ${missingLedgers.length} bank accounts missing ledger accounts:`);
    missingLedgers.forEach((acc, i) => {
      console.log(`   ${i + 1}. ${acc.type} (${acc.currency}) - Balance: ${acc.balance} - ID: ${acc.id}`);
    });
  }

  // 8. Determine eligibility
  console.log('\n9. ELIGIBILITY ANALYSIS:');
  const withdrawalEligibleTypes = ['CURRENT', 'SAVINGS'];
  const isEligible = withdrawalEligibleTypes.includes(account.type);
  
  if (!isEligible) {
    console.log(`   ❌ Account type "${account.type}" is NOT withdrawal-eligible`);
    console.log(`   ✅ Eligible types: ${withdrawalEligibleTypes.join(', ')}`);
    console.log(`   DIAGNOSIS: ELIGIBILITY ISSUE (Case A)`);
  } else {
    console.log(`   ✅ Account type "${account.type}" IS withdrawal-eligible`);
    if (!ledgerAccount) {
      console.log(`   DIAGNOSIS: PROVISIONING ISSUE (Case B)`);
      
      const hasBalance = parseFloat(account.balanceCache.toString()) !== 0;
      const hasHistory = transactions.length > 0;
      
      if (!hasBalance && !hasHistory) {
        console.log(`   REPAIR SAFETY: ✅ SAFE (zero balance + no history)`);
      } else if (hasBalance && hasHistory) {
        console.log(`   REPAIR SAFETY: ⚠️  REQUIRES INVESTIGATION (balance + history)`);
      } else {
        console.log(`   REPAIR SAFETY: ❌ FAIL SAFE (balance without history)`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
}

main()
  .catch((error) => {
    console.error('\nError during investigation:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
