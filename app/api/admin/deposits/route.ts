import { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import {
  listPendingFiatDeposits,
  approveFiatDeposit,
  rejectFiatDeposit,
} from "@/features/admin/deposits";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

import { adminDepositReviewSchema } from "@/lib/validation/treasury";
export { adminDepositReviewSchema };

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  return apiSuccess({ deposits: await listPendingFiatDeposits() });
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  if (!(await verifyCsrf(request)))
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);

  const limited = checkRateLimit({ action: "admin-deposit-review", limit: 60, windowMs: 60 * 60 * 1000 }, admin.id);
  if (!limited.allowed) return apiError("RATE_LIMITED", "Too many review actions. Please try again later.", 429);

  const parsed = adminDepositReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid review action.", 422);

  try {
    if (parsed.data.action === "APPROVE") {
      const result = await approveFiatDeposit(admin.id, parsed.data.depositId);
      return apiSuccess({ deposit: result.deposit });
    } else {
      const result = await rejectFiatDeposit(
        admin.id,
        parsed.data.depositId,
        parsed.data.rejectionReason!
      );
      return apiSuccess({ deposit: result.deposit });
    }
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("admin deposit review failed", error);
    return apiError("INTERNAL_ERROR", "Unable to review deposit.", 500);
  }
}

