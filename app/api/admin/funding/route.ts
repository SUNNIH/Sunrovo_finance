import { randomUUID } from "node:crypto";
import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { adminFundingSchema } from "@/lib/validation/treasury";
import { fundUserAccount, listUsersForFunding } from "@/features/admin/funding";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { checkRateLimit } from "@/lib/rate-limit/limiter";

/**
 * GET /api/admin/funding?email=<optional search>
 * List users with their accounts and wallets for funding selection.
 */
export async function GET(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return apiError("FORBIDDEN", "Administrator access is required.", 403);
  }

  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email") || undefined;

  const users = await listUsersForFunding(email);
  return apiSuccess({ users });
}

/**
 * POST /api/admin/funding
 * Fund a user's bank account or crypto wallet from the platform treasury.
 */
export async function POST(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return apiError("FORBIDDEN", "Administrator access is required.", 403);
  }

  if (!(await verifyCsrf(request))) {
    return apiError(
      "CSRF_INVALID",
      "Your session could not be verified. Refresh and try again.",
      403
    );
  }

  const limited = checkRateLimit(
    { action: "admin-funding", limit: 30, windowMs: 60 * 60 * 1000 },
    admin.id
  );
  if (!limited.allowed) {
    return apiError(
      "RATE_LIMITED",
      "Too many funding operations. Please try again later.",
      429
    );
  }

  const parsed = adminFundingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Invalid funding request.",
      422
    );
  }

  try {
    const idempotencyKey = randomUUID();
    const result = await fundUserAccount(admin.id, parsed.data, idempotencyKey);
    return apiSuccess({
      transactionId: result.transactionId,
      ledgerGroupId: result.ledgerGroupId,
      alreadyProcessed: result.alreadyProcessed,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    console.error("admin funding failed", error);
    return apiError("INTERNAL_ERROR", "Unable to complete funding operation.", 500);
  }
}
