import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/features/authentication/password-reset";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

export async function POST(request: Request) {
  const meta = getRequestMeta(request);
  const body = await request.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  const rateLimit = checkRateLimit(RATE_LIMIT_RULES.resetPassword, meta.ipAddress ?? "unknown");
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  try {
    await resetPassword(parsed.data.token, parsed.data.password);
    return apiSuccess({ reset: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("reset-password failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
