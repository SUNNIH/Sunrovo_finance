/**
 * Phase 5: Check for existing OPEN crypto orders
 * 
 * This script inspects the database to identify any OPEN orders
 * that need to be cleaned up before trading retirement.
 * 
 * Run: npx tsx scripts/check-open-orders.ts
 * 
 * For cleanup execution, use the admin API endpoint:
 * GET  /api/admin/orders/cleanup - verify state
 * POST /api/admin/orders/cleanup - execute cleanup (requires admin auth + CSRF)
 */

import { prisma } from "../lib/db/prisma";

async function checkOpenOrders() {
  console.log("Checking for OPEN crypto orders...\n");

  const openOrders = await prisma.cryptoOrder.findMany({
    where: { status: "OPEN" },
    include: {
      user: {
        select: { id: true, email: true },
      },
    },
  });

  console.log(`Found ${openOrders.length} OPEN orders`);

  if (openOrders.length > 0) {
    console.log("\nOPEN Orders Details:");
    console.log("=".repeat(80));

    for (const order of openOrders) {
      console.log(`\nOrder ID: ${order.id}`);
      console.log(`User: ${order.user.email} (${order.userId})`);
      console.log(`Symbol: ${order.symbol}`);
      console.log(`Side: ${order.side}`);
      console.log(`Type: ${order.type}`);
      console.log(`Quantity: ${order.quantity.toString()}`);
      console.log(`Limit Price: ${order.limitPrice?.toString() ?? "N/A"}`);
      console.log(`Created: ${order.createdAt.toISOString()}`);
    }

    console.log("\n" + "=".repeat(80));
  }

  // Check for any locked balances
  const lockedBalances = await prisma.assetBalance.findMany({
    where: {
      locked: { gt: 0 },
    },
    include: {
      wallet: {
        include: {
          user: {
            select: { id: true, email: true },
          },
        },
      },
    },
  });

  console.log(`\nFound ${lockedBalances.length} asset balances with locked funds`);

  if (lockedBalances.length > 0) {
    console.log("\nLocked Balances:");
    console.log("=".repeat(80));

    for (const balance of lockedBalances) {
      console.log(`\nAsset: ${balance.assetSymbol}`);
      console.log(`User: ${balance.wallet.user.email}`);
      console.log(`Available: ${balance.available.toString()}`);
      console.log(`Locked: ${balance.locked.toString()}`);
    }

    console.log("\n" + "=".repeat(80));
  }

  console.log("\nSummary:");
  console.log(`- OPEN orders: ${openOrders.length}`);
  console.log(`- Locked balances: ${lockedBalances.length}`);

  await prisma.$disconnect();
}

checkOpenOrders().catch((error) => {
  console.error("Error checking OPEN orders:", error);
  process.exit(1);
});
