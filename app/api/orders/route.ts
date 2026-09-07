import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { marketOrderSchema, limitOrderSchema } from "@/lib/validation/crypto";
import { placeMarketOrder, placeLimitOrder, listOrders, evaluateAndFillOpenOrders } from "@/features/crypto/trading";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { assertPlatformOperational } from "@/lib/maintenance";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  // Opportunistic lazy-fill check for open limit orders (see
  // features/crypto/trading.ts#evaluateAndFillOpenOrders for why there's
  // no background worker).
  await evaluateAndFillOpenOrders(user.id).catch(() => undefined);

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam === "OPEN" || statusParam === "FILLED" || statusParam === "CANCELLED" ? statusParam : undefined;

  const orders = await listOrders(user.id, status);
  return apiSuccess({ orders });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return apiError("MISSING_IDEMPOTENCY_KEY", "This request requires an Idempotency-Key header.", 400);
  }

  const meta = getRequestMeta(request);
  const rateLimit = checkRateLimit({ action: "place-order", limit: 30, windowMs: 60 * 60 * 1000 }, `${meta.ipAddress ?? "unknown"}:${user.id}`);
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many order attempts. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const orderType = (body as { orderType?: string } | null)?.orderType;

  try {
    await assertPlatformOperational(user.role);
    if (orderType === "LIMIT") {
      const parsed = limitOrderSchema.safeParse(body);
      if (!parsed.success) {
        return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
      }
      const order = await placeLimitOrder(user.id, parsed.data, idempotencyKey);
      return apiSuccess({ order }, { status: 201 });
    }

    const parsed = marketOrderSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
    }
    const order = await placeMarketOrder(user.id, parsed.data, idempotencyKey);
    return apiSuccess({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("order placement failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
