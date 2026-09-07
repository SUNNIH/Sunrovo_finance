import { registerSchema } from "@/lib/validation/auth";
import { registerUser } from "@/features/authentication/register";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

export async function POST(request: Request) {
  const meta = getRequestMeta(request);
  const rateLimit = checkRateLimit(RATE_LIMIT_RULES.register, meta.ipAddress ?? "unknown");
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    const result = await registerUser(parsed.data, meta);
    return apiSuccess(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("register failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
