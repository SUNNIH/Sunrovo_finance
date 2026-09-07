import { mfaVerifySchema } from "@/lib/validation/auth";
import { verifyMfaAndLogin } from "@/features/authentication/login";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

export async function POST(request: Request) {
  const meta = getRequestMeta(request);

  const body = await request.json().catch(() => null);
  const parsed = mfaVerifySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  const rateLimit = checkRateLimit(RATE_LIMIT_RULES.mfaVerify, meta.ipAddress ?? "unknown");
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  try {
    await verifyMfaAndLogin(parsed.data, meta);
    return apiSuccess({ status: "success" });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("mfa verify failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
