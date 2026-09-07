import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { convertExecuteSchema } from "@/lib/validation/crypto";
import { executeConversion } from "@/features/crypto/convert";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
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

  const body = await request.json().catch(() => null);
  const parsed = convertExecuteSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "A quote ID is required.", 422);
  }

  try {
    await assertPlatformOperational(user.role);
    const conversion = await executeConversion(user.id, parsed.data.quoteId, idempotencyKey);
    return apiSuccess({ conversion }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("conversion execution failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
