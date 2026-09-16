import { z } from "zod";
import { NextRequest } from "next/server";
import { getCurrentAdmin } from "@/lib/auth/admin-api";
import { verifyCsrf } from "@/lib/auth/csrf";
import { listPendingTransfers, reviewTransfer } from "@/features/admin/transfers";
import { checkRateLimit } from "@/lib/rate-limit/limiter";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const reviewSchema = z.object({
  transferId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  rejectionReason: z.string().trim().min(3).max(500).optional(),
});

export async function GET() {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  return apiSuccess({ transfers: await listPendingTransfers() });
}

export async function POST(request: NextRequest) {
  const admin = await getCurrentAdmin();
  if (!admin) return apiError("FORBIDDEN", "Administrator access is required.", 403);
  if (!(await verifyCsrf(request)))
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);

  const limited = checkRateLimit({ action: "admin-transfer-review", limit: 60, windowMs: 60 * 60 * 1000 }, admin.id);
  if (!limited.allowed) return apiError("RATE_LIMITED", "Too many review actions. Please try again later.", 429);

  const parsed = reviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid review action.", 422);

  try {
    const result = await reviewTransfer(
      admin.id,
      parsed.data.transferId,
      parsed.data.decision,
      parsed.data.rejectionReason
    );
    return apiSuccess({ transfer: result });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("admin transfer review failed", error);
    return apiError("INTERNAL_ERROR", "Unable to review transfer.", 500);
  }
}
