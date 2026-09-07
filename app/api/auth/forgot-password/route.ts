import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/features/authentication/password-reset";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

export async function POST(request: Request) {
  const meta = getRequestMeta(request);
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Enter a valid email address.", 422);
  }

  const rateLimit = checkRateLimit(
    RATE_LIMIT_RULES.forgotPassword,
    `${meta.ipAddress ?? "unknown"}:${parsed.data.email}`
  );
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  await requestPasswordReset(parsed.data.email);
  // Always a generic success response — never reveals account existence.
  return apiSuccess({ sent: true });
}
