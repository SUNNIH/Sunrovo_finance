/**
 * Phase 5: Admin Order Cleanup API
 * 
 * Provides verification and cleanup capabilities for OPEN crypto orders
 * during trading retirement transition.
 */

import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { verifyNoLockedBalances, cancelAllOpenOrders } from "@/features/crypto/order-cleanup";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/admin/orders/cleanup
 * 
 * Verify current state: count OPEN orders and locked balances
 */
export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return apiError("FORBIDDEN", "Administrator access is required.", 403);
  }

  const openOrderCount = await prisma.cryptoOrder.count({
    where: { status: "OPEN" },
  });

  const lockedBalanceCount = await prisma.assetBalance.count({
    where: { locked: { gt: 0 } },
  });

  const verification = await verifyNoLockedBalances();

  return apiSuccess({
    openOrders: openOrderCount,
    lockedBalances: lockedBalanceCount,
    verification,
  });
}

/**
 * POST /api/admin/orders/cleanup
 * 
 * Execute cleanup: cancel all OPEN orders and release locked funds
 * Requires CSRF token
 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return apiError("FORBIDDEN", "Administrator access is required.", 403);
  }

  if (!(await verifyCsrf(request))) {
    return apiError(
      "CSRF_INVALID",
      "Your session could not be verified. Refresh and try again.",
      403
    );
  }

  const result = await cancelAllOpenOrders();

  const verification = await verifyNoLockedBalances();

  return apiSuccess({
    cleanup: result,
    verification,
  });
}
