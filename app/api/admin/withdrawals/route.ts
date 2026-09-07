import { z } from "zod";
import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { listPendingWithdrawals, reviewWithdrawal } from "@/features/admin/withdrawals";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";
import { checkRateLimit } from "@/lib/rate-limit/limiter";

const reviewSchema = z.object({
  withdrawalId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
}).superRefine((input, ctx) => {
  if (input.decision === "REJECT" && !input.rejectionReason) ctx.addIssue({ code: "custom", path: ["rejectionReason"], message: "Provide a rejection reason." });
});

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  return apiSuccess({ withdrawals: await listPendingWithdrawals() });
}

export async function PATCH(request: Request) {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);
  const limited = checkRateLimit({ action: "admin-withdrawal-review", limit: 60, windowMs: 60 * 60 * 1000 }, admin.id);
  if (!limited.allowed) return apiError("RATE_LIMITED", "Too many review actions. Please try again later.", 429);
  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid review action.", 422);
  try {
    const result = await reviewWithdrawal(admin.id, parsed.data.withdrawalId, parsed.data.decision, parsed.data.rejectionReason);
    return apiSuccess({ withdrawal: result });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("admin withdrawal review failed", error);
    return apiError("INTERNAL_ERROR", "Unable to review withdrawal.", 500);
  }
}
