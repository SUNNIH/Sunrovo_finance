#!/usr/bin/env tsx
/**
 * Phase 9: Historical data verification script
 * 
 * Checks database for historical records in models being considered for removal:
 * - CryptoOrder
 * - Conversion / ConversionQuote
 * - Watchlist
 * - ApiConnection (Bybit provider)
 * - Withdrawal fields: sourceWalletId, network
 * - WithdrawalAllowlistEntry.network
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Phase 9: Historical Data Check\n');
  console.log('='.repeat(60));

  // CryptoOrder analysis
  console.log('\n1. CryptoOrder Model:');
  const cryptoOrderCount = await prisma.cryptoOrder.count();
  console.log(`   Total records: ${cryptoOrderCount}`);
  
  if (cryptoOrderCount > 0) {
    const statusBreakdown = await prisma.cryptoOrder.groupBy({
      by: ['status'],
      _count: true,
    });
    console.log('   Status breakdown:');
    statusBreakdown.forEach(({ status, _count }) => {
      console.log(`     ${status}: ${_count}`);
    });

    const openOrders = await prisma.cryptoOrder.count({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
    });
    if (openOrders > 0) {
      console.log(`   ⚠️  WARNING: ${openOrders} OPEN/PARTIALLY_FILLED orders exist`);
    }
  }

  // Conversion analysis
  console.log('\n2. Conversion Model:');
  const conversionCount = await prisma.conversion.count();
  console.log(`   Total records: ${conversionCount}`);
  
  if (conversionCount > 0) {
    const statusBreakdown = await prisma.conversion.groupBy({
      by: ['status'],
      _count: true,
    });
    console.log('   Status breakdown:');
    statusBreakdown.forEach(({ status, _count }) => {
      console.log(`     ${status}: ${_count}`);
    });
  }

  // ConversionQuote analysis
  console.log('\n3. ConversionQuote Model:');
  const quoteCount = await prisma.conversionQuote.count();
  console.log(`   Total records: ${quoteCount}`);
  
  if (quoteCount > 0) {
    const consumed = await prisma.conversionQuote.count({
      where: { consumedAt: { not: null } },
    });
    console.log(`   Consumed quotes: ${consumed}`);
    console.log(`   Unconsumed quotes: ${quoteCount - consumed}`);
  }

  // Watchlist analysis
  console.log('\n4. Watchlist Model:');
  const watchlistCount = await prisma.watchlist.count();
  console.log(`   Total records: ${watchlistCount}`);

  // ApiConnection analysis (Bybit)
  console.log('\n5. ApiConnection Model:');
  const apiConnectionCount = await prisma.apiConnection.count();
  console.log(`   Total records: ${apiConnectionCount}`);
  
  if (apiConnectionCount > 0) {
    const connections = await prisma.apiConnection.findMany({
      select: { provider: true, mode: true, status: true },
    });
    console.log('   Providers:');
    connections.forEach(({ provider, mode, status }) => {
      console.log(`     ${provider} (${mode}, ${status})`);
    });
  }

  // Withdrawal.sourceWalletId analysis
  console.log('\n6. Withdrawal.sourceWalletId Field:');
  const totalWithdrawals = await prisma.withdrawal.count();
  const walletSourcedWithdrawals = await prisma.withdrawal.count({
    where: { sourceWalletId: { not: null } },
  });
  console.log(`   Total withdrawals: ${totalWithdrawals}`);
  console.log(`   With sourceWalletId: ${walletSourcedWithdrawals}`);
  console.log(`   Without sourceWalletId: ${totalWithdrawals - walletSourcedWithdrawals}`);

  // Withdrawal.network analysis
  console.log('\n7. Withdrawal.network Field:');
  const networkWithdrawals = await prisma.withdrawal.count({
    where: { network: { not: null } },
  });
  console.log(`   Total withdrawals: ${totalWithdrawals}`);
  console.log(`   With network: ${networkWithdrawals}`);
  console.log(`   Without network: ${totalWithdrawals - networkWithdrawals}`);

  // WithdrawalAllowlistEntry.network analysis
  console.log('\n8. WithdrawalAllowlistEntry.network Field:');
  const totalAllowlistEntries = await prisma.withdrawalAllowlistEntry.count();
  const networkAllowlistEntries = await prisma.withdrawalAllowlistEntry.count({
    where: { network: { not: '' } },
  });
  console.log(`   Total allowlist entries: ${totalAllowlistEntries}`);
  console.log(`   With network (non-empty): ${networkAllowlistEntries}`);
  console.log(`   Without network (empty string): ${totalAllowlistEntries - networkAllowlistEntries}`);

  console.log('\n' + '='.repeat(60));
  console.log('\nAnalysis Complete.');
}

main()
  .catch((error) => {
    console.error('\nError during analysis:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
