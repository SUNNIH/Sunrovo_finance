#!/usr/bin/env tsx
/**
 * Investigate how transactions create ledger entries
 * when the source bank account has no ledger account
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const userId = 'cmtgu3xq1000218213v4c9jgc';
  
  console.log('Investigating deposit transaction for user:', userId);
  console.log('='.repeat(70));

  // Find a deposit transaction
  const depositTx = await prisma.transaction.findFirst({
    where: {
      userId,
      type: 'DEPOSIT',
    },
  });

  if (depositTx) {
    console.log('\nDEPOSIT TRANSACTION:');
    console.log(`  ID: ${depositTx.id}`);
    console.log(`  Type: ${depositTx.type}`);
    console.log(`  Amount: ${depositTx.amount} ${depositTx.assetSymbol}`);
    console.log(`  Status: ${depositTx.status}`);
    console.log(`  ledgerGroupId: ${depositTx.ledgerGroupId || '(none)'}`);
    console.log(`  Created: ${depositTx.createdAt}`);
    
    if (depositTx.ledgerGroupId) {
      const entries = await prisma.ledgerEntry.findMany({
        where: { groupId: depositTx.ledgerGroupId },
        include: {
          ledgerAccount: {
            include: {
              bankAccount: true,
              cryptoWallet: true,
            },
          },
        },
      });
      
      console.log(`\n  Ledger Entries (${entries.length}):`);
      for (const entry of entries) {
        console.log(`    - ${entry.direction} ${entry.amount} ${entry.assetSymbol}`);
        console.log(`      Ledger Account: ${entry.ledgerAccount.name} (${entry.ledgerAccount.type})`);
        if (entry.ledgerAccount.bankAccount) {
          console.log(`      -> BankAccount: ${entry.ledgerAccount.bankAccount.id} (${entry.ledgerAccount.bankAccount.type})`);
        }
        if (entry.ledgerAccount.cryptoWallet) {
          console.log(`      -> CryptoWallet: ${entry.ledgerAccount.cryptoWallet.id}`);
        }
        if (!entry.ledgerAccount.bankAccount && !entry.ledgerAccount.cryptoWallet) {
          console.log(`      -> Platform/Treasury account`);
        }
      }
    }
  }

  // Find a transfer transaction
  const transferTx = await prisma.transaction.findFirst({
    where: {
      userId,
      type: 'TRANSFER',
    },
  });

  if (transferTx) {
    console.log('\n\nTRANSFER TRANSACTION:');
    console.log(`  ID: ${transferTx.id}`);
    console.log(`  Type: ${transferTx.type}`);
    console.log(`  Amount: ${transferTx.amount} ${transferTx.assetSymbol}`);
    console.log(`  Status: ${transferTx.status}`);
    console.log(`  ledgerGroupId: ${transferTx.ledgerGroupId || '(none)'}`);
    console.log(`  Created: ${transferTx.createdAt}`);
    
    if (transferTx.ledgerGroupId) {
      const entries = await prisma.ledgerEntry.findMany({
        where: { groupId: transferTx.ledgerGroupId },
        include: {
          ledgerAccount: {
            include: {
              bankAccount: true,
              cryptoWallet: true,
            },
          },
        },
      });
      
      console.log(`\n  Ledger Entries (${entries.length}):`);
      for (const entry of entries) {
        console.log(`    - ${entry.direction} ${entry.amount} ${entry.assetSymbol}`);
        console.log(`      Ledger Account: ${entry.ledgerAccount.name} (${entry.ledgerAccount.type})`);
        if (entry.ledgerAccount.bankAccount) {
          console.log(`      -> BankAccount: ${entry.ledgerAccount.bankAccount.id} (${entry.ledgerAccount.bankAccount.type})`);
        }
        if (entry.ledgerAccount.cryptoWallet) {
          console.log(`      -> CryptoWallet: ${entry.ledgerAccount.cryptoWallet.id}`);
        }
        if (!entry.ledgerAccount.bankAccount && !entry.ledgerAccount.cryptoWallet) {
          console.log(`      -> Platform/Treasury account`);
        }
      }
    }
  }

  // Check all ledger accounts in the system
  console.log('\n\nALL LEDGER ACCOUNTS:');
  console.log('='.repeat(70));
  
  const allLedgerAccounts = await prisma.ledgerAccount.findMany({
    include: {
      bankAccount: {
        select: {
          id: true,
          type: true,
          userId: true,
        },
      },
      cryptoWallet: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  for (const la of allLedgerAccounts) {
    console.log(`\nLedgerAccount: ${la.name} (${la.type})`);
    console.log(`  ID: ${la.id}`);
    console.log(`  Asset: ${la.assetSymbol}`);
    if (la.bankAccount) {
      console.log(`  -> BankAccount: ${la.bankAccount.id} (${la.bankAccount.type}) - User: ${la.bankAccount.userId}`);
    }
    if (la.cryptoWallet) {
      console.log(`  -> CryptoWallet: ${la.cryptoWallet.id} - User: ${la.cryptoWallet.userId}`);
    }
    if (!la.bankAccount && !la.cryptoWallet) {
      console.log(`  -> Platform/Treasury account (no user association)`);
    }
  }
}

main()
  .catch((error) => {
    console.error('\nError:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
