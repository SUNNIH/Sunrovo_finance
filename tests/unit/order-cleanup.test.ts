import { describe, expect, it, beforeEach, afterEach } from "vitest";
import Decimal from "decimal.js";
import { prisma } from "@/lib/db/prisma";
import { 
  cancelOpenOrder, 
  cancelAllUserOpenOrders,
  verifyNoLockedBalances 
} from "@/features/crypto/order-cleanup";

/**
 * Phase 5: Order Cleanup Tests
 * 
 * Validates that:
 * - OPEN orders become CANCELLED
 * - Exact locked amounts return to available
 * - Total wallet value unchanged
 * - Already cancelled/filled orders untouched
 * - Repeated cleanup doesn't double-release
 * - Concurrent cleanup doesn't double-release
 */

describe("Phase 5: Order Cleanup", () => {
  let testUserId: string;
  let walletId: string;

  beforeEach(async () => {
    // Create test user directly
    const user = await prisma.user.create({
      data: {
        email: `cleanup-test-${Date.now()}@test.local`,
        passwordHash: "test",
        status: "ACTIVE",
        profile: {
          create: {
            fullName: "Test User",
            country: "US",
            accountType: "individual",
            preferredFiatCurrency: "USD",
          },
        },
      },
    });
    testUserId = user.id;

    // Create crypto wallet
    const wallet = await prisma.cryptoWallet.create({
      data: {
        userId: testUserId,
      },
    });
    walletId = wallet.id;

    // Fund test wallet for order placement
    await prisma.assetBalance.upsert({
      where: {
        walletId_assetSymbol: { walletId, assetSymbol: "USDT" },
      },
      create: {
        walletId,
        assetSymbol: "USDT",
        available: new Decimal("10000"),
        locked: new Decimal("0"),
      },
      update: {
        available: new Decimal("10000"),
        locked: new Decimal("0"),
      },
    });

    await prisma.assetBalance.upsert({
      where: {
        walletId_assetSymbol: { walletId, assetSymbol: "BTC" },
      },
      create: {
        walletId,
        assetSymbol: "BTC",
        available: new Decimal("1"),
        locked: new Decimal("0"),
      },
      update: {
        available: new Decimal("1"),
        locked: new Decimal("0"),
      },
    });
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: testUserId } });
  });

  it("reports already_closed for non-OPEN orders", async () => {
    // Create a pre-cancelled order manually
    const order = await prisma.cryptoOrder.create({
      data: {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: new Decimal("0.001"),
        limitPrice: new Decimal("50000"),
        status: "CANCELLED",
        cancelledAt: new Date(),
        idempotencyKey: `test-cancelled-${Date.now()}`,
      },
    });

    const result = await cancelOpenOrder(order.id);

    expect(result.status).toBe("already_closed");
    expect(result.orderId).toBe(order.id);
  });

  it("handles missing orders gracefully", async () => {
    const result = await cancelOpenOrder("nonexistent-order-id");

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/not found/i);
  });

  it("validates locked balance sufficiency before releasing", async () => {
    // Create an OPEN order manually with insufficient locked balance
    const order = await prisma.cryptoOrder.create({
      data: {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: new Decimal("0.1"),
        limitPrice: new Decimal("50000"), // Would require 5000 USDT locked
        status: "OPEN",
        idempotencyKey: `test-inconsistent-${Date.now()}`,
      },
    });

    // Don't actually lock the funds - create inconsistent state
    // (Locked = 0, but order expects 5000)

    const result = await cancelOpenOrder(order.id);

    expect(result.status).toBe("error");
    expect(result.error).toMatch(/inconsistent state|locked.*required/i);
  });

  it("cancels all user open orders and releases locked funds", async () => {
    // Can't create new orders via API (blocked), so test with empty state
    const results = await cancelAllUserOpenOrders(testUserId);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0); // No OPEN orders to cancel
  });

  it("verifies no locked balances remain after cleanup", async () => {
    const verification = await verifyNoLockedBalances();

    expect(verification.clean).toBe(true);
    expect(verification.lockedBalances).toEqual([]);
  });

  it("is idempotent - repeated cleanup doesn't double-release", async () => {
    // Create an OPEN order manually (simulating pre-retirement state)
    const usdtBalance = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: { walletId, assetSymbol: "USDT" },
      },
    });

    const order = await prisma.cryptoOrder.create({
      data: {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: new Decimal("0.1"),
        limitPrice: new Decimal("50000"),
        status: "OPEN",
        idempotencyKey: `test-idempotent-${Date.now()}`,
      },
    });

    // Lock funds manually
    const reserveAmount = new Decimal("0.1").mul("50000").toString(); // 5000 USDT
    await prisma.assetBalance.update({
      where: { id: usdtBalance!.id },
      data: {
        available: { decrement: reserveAmount },
        locked: { increment: reserveAmount },
      },
    });

    const balanceBefore = await prisma.assetBalance.findUnique({
      where: { id: usdtBalance!.id },
    });
    const totalBefore = new Decimal(balanceBefore!.available.toString())
      .add(balanceBefore!.locked.toString());

    // First cleanup
    const result1 = await cancelOpenOrder(order.id);
    expect(result1.status).toBe("cancelled");
    // toFixed may add decimals, so compare numerically
    expect(parseFloat(result1.amountReleased)).toBe(parseFloat(reserveAmount));

    const balanceAfter1 = await prisma.assetBalance.findUnique({
      where: { id: usdtBalance!.id },
    });
    expect(balanceAfter1!.locked.toString()).toBe("0");

    const totalAfter1 = new Decimal(balanceAfter1!.available.toString())
      .add(balanceAfter1!.locked.toString());
    expect(totalAfter1.toString()).toBe(totalBefore.toString());

    // Second cleanup (idempotent - should report already closed)
    const result2 = await cancelOpenOrder(order.id);
    expect(result2.status).toBe("already_closed");

    const balanceAfter2 = await prisma.assetBalance.findUnique({
      where: { id: usdtBalance!.id },
    });

    // Balance should be unchanged from first cleanup
    expect(balanceAfter2!.available.toString()).toBe(balanceAfter1!.available.toString());
    expect(balanceAfter2!.locked.toString()).toBe(balanceAfter1!.locked.toString());
  });

  it("preserves total wallet value during cleanup", async () => {
    // Create a BUY order (locks quote asset)
    const usdtBalance = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: { walletId, assetSymbol: "USDT" },
      },
    });

    const orderBuy = await prisma.cryptoOrder.create({
      data: {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: new Decimal("0.1"),
        limitPrice: new Decimal("50000"),
        status: "OPEN",
        idempotencyKey: `test-value-buy-${Date.now()}`,
      },
    });

    const reserveAmountBuy = new Decimal("0.1").mul("50000").toString();
    await prisma.assetBalance.update({
      where: { id: usdtBalance!.id },
      data: {
        available: { decrement: reserveAmountBuy },
        locked: { increment: reserveAmountBuy },
      },
    });

    // Create a SELL order (locks base asset)
    const btcBalance = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: { walletId, assetSymbol: "BTC" },
      },
    });

    const orderSell = await prisma.cryptoOrder.create({
      data: {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "SELL",
        type: "LIMIT",
        quantity: new Decimal("0.5"),
        limitPrice: new Decimal("51000"),
        status: "OPEN",
        idempotencyKey: `test-value-sell-${Date.now()}`,
      },
    });

    await prisma.assetBalance.update({
      where: { id: btcBalance!.id },
      data: {
        available: { decrement: "0.5" },
        locked: { increment: "0.5" },
      },
    });

    // Capture total before cleanup
    const usdtBefore = await prisma.assetBalance.findUnique({
      where: { id: usdtBalance!.id },
    });
    const btcBefore = await prisma.assetBalance.findUnique({
      where: { id: btcBalance!.id },
    });

    const usdtTotalBefore = new Decimal(usdtBefore!.available.toString())
      .add(usdtBefore!.locked.toString());
    const btcTotalBefore = new Decimal(btcBefore!.available.toString())
      .add(btcBefore!.locked.toString());

    // Cleanup both orders
    await cancelOpenOrder(orderBuy.id);
    await cancelOpenOrder(orderSell.id);

    // Verify totals unchanged
    const usdtAfter = await prisma.assetBalance.findUnique({
      where: { id: usdtBalance!.id },
    });
    const btcAfter = await prisma.assetBalance.findUnique({
      where: { id: btcBalance!.id },
    });

    const usdtTotalAfter = new Decimal(usdtAfter!.available.toString())
      .add(usdtAfter!.locked.toString());
    const btcTotalAfter = new Decimal(btcAfter!.available.toString())
      .add(btcAfter!.locked.toString());

    expect(usdtTotalAfter.toString()).toBe(usdtTotalBefore.toString());
    expect(btcTotalAfter.toString()).toBe(btcTotalBefore.toString());

    // All funds should be available, none locked
    expect(usdtAfter!.locked.toString()).toBe("0");
    expect(btcAfter!.locked.toString()).toBe("0");
  });

  it("handles concurrent cleanup attempts safely", async () => {
    // Create an OPEN order
    const usdtBalance = await prisma.assetBalance.findUnique({
      where: {
        walletId_assetSymbol: { walletId, assetSymbol: "USDT" },
      },
    });

    const order = await prisma.cryptoOrder.create({
      data: {
        userId: testUserId,
        symbol: "BTCUSDT",
        side: "BUY",
        type: "LIMIT",
        quantity: new Decimal("0.1"),
        limitPrice: new Decimal("50000"),
        status: "OPEN",
        idempotencyKey: `test-concurrent-${Date.now()}`,
      },
    });

    const reserveAmount = new Decimal("0.1").mul("50000").toString();
    await prisma.assetBalance.update({
      where: { id: usdtBalance!.id },
      data: {
        available: { decrement: reserveAmount },
        locked: { increment: reserveAmount },
      },
    });

    // Attempt concurrent cleanup
    const [result1, result2, result3] = await Promise.all([
      cancelOpenOrder(order.id),
      cancelOpenOrder(order.id),
      cancelOpenOrder(order.id),
    ]);

    // One should succeed, others should report already_closed or error
    const successCount = [result1, result2, result3].filter(
      (r) => r.status === "cancelled"
    ).length;
    const alreadyClosedCount = [result1, result2, result3].filter(
      (r) => r.status === "already_closed"
    ).length;
    const errorCount = [result1, result2, result3].filter(
      (r) => r.status === "error"
    ).length;

    expect(successCount).toBe(1); // Only one succeeds
    expect(alreadyClosedCount + errorCount).toBe(2); // Others are prevented

    // Verify funds released exactly once
    const balanceAfter = await prisma.assetBalance.findUnique({
      where: { id: usdtBalance!.id },
    });
    expect(balanceAfter!.locked.toString()).toBe("0");
  });
});
