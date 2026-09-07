import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { withdrawalSchema } from "@/lib/validation/treasury";
import { createWithdrawal, listWithdrawals } from "@/features/treasury/withdrawals";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { assertPlatformOperational } from "@/lib/maintenance";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const withdrawals = await listWithdrawals(user.id);
  return apiSuccess({ withdrawals });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return apiError("MISSING_IDEMPOTENCY_KEY", "This request requires an Idempotency-Key header.", 400);
  }

  const meta = getRequestMeta(request);
  const rateLimit = checkRateLimit({ action: "withdrawal", limit: 10, windowMs: 60 * 60 * 1000 }, `${meta.ipAddress ?? "unknown"}:${user.id}`);
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many withdrawal attempts. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = withdrawalSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    await assertPlatformOperational(user.role);
    const withdrawal = await createWithdrawal(user.id, parsed.data, idempotencyKey);
    return apiSuccess({ withdrawal }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("withdrawal failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
