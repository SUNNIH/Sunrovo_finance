import { getCurrentUser } from "@/lib/auth/session";
import { recipientLookupSchema } from "@/lib/validation/banking";
import { lookupRecipientAccount } from "@/features/banking/recipient-lookup";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { getRequestMeta } from "@/lib/utilities/request-meta";
import { checkRateLimit, RATE_LIMIT_RULES } from "@/lib/rate-limit/limiter";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const meta = getRequestMeta(request);
  const rateLimit = checkRateLimit(
    RATE_LIMIT_RULES.recipientLookup,
    `${meta.ipAddress ?? "unknown"}:${user.id}`
  );
  if (!rateLimit.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many recipient lookup attempts. Please wait a moment before trying again.",
      429
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = recipientLookupSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid account number.", 422);
  }

  try {
    const result = await lookupRecipientAccount(
      user.id,
      parsed.data.accountNumber,
      parsed.data.sourceAccountId
    );

    return apiSuccess(result);
  } catch (error) {
    console.error("Recipient lookup failed", error);
    return apiError("INTERNAL_ERROR", "Unable to verify recipient at this time.", 500);
  }
}
