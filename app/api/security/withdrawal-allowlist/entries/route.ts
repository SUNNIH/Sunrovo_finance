import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { addWithdrawalAllowlistEntry } from "@/features/authentication/account-security";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const createSchema = z.object({
  destination: z.string().trim().min(4).max(160),
  assetSymbol: z.string().trim().min(2).max(12).optional(),
  network: z.string().trim().min(1).max(60).optional(),
  label: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid allowlist entry.", 422);
  try {
    const entry = await addWithdrawalAllowlistEntry(user.id, parsed.data);
    return apiSuccess({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    if ((error as { code?: string }).code === "P2002") return apiError("DUPLICATE_ALLOWLIST_ENTRY", "That destination is already allowlisted.", 409);
    return apiError("INTERNAL_ERROR", "Could not add the allowlist entry.", 500);
  }
}
