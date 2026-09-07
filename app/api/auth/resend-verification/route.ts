import { z } from "zod";
import { resendVerificationEmail } from "@/features/authentication/register";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

const bodySchema = z.object({ email: z.string().trim().toLowerCase().email() });

export async function POST(request: Request) {
  const meta = getRequestMeta(request);
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Enter a valid email address.", 422);
  }

  const rateLimit = checkRateLimit(RATE_LIMIT_RULES.resendVerification, `${meta.ipAddress ?? "unknown"}:${parsed.data.email}`);
  if (!rateLimit.allowed) {
    return apiError("RATE_LIMITED", "Too many attempts. Please try again later.", 429);
  }

  await resendVerificationEmail(parsed.data.email);
  // Always a generic success response — never reveals account existence or verification status.
  return apiSuccess({ sent: true });
}
