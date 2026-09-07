import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { transferSchema } from "@/lib/validation/banking";
import { createTransfer } from "@/features/banking/transfers";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";
import { assertPlatformOperational } from "@/lib/maintenance";

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
  const rateLimit = checkRateLimit(RATE_LIMIT_RULES.transfer, `${meta.ipAddress ?? "unknown"}:${user.id}`);
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many transfer attempts. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    await assertPlatformOperational(user.role);
    const transfer = await createTransfer(user.id, parsed.data, idempotencyKey, meta);
    return apiSuccess({ transfer }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("transfer failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
