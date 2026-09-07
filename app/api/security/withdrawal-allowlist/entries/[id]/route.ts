import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { removeWithdrawalAllowlistEntry } from "@/features/authentication/account-security";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) return apiError("CSRF_INVALID", "Your session could not be verified. Refresh and try again.", 403);
  try {
    await removeWithdrawalAllowlistEntry(user.id, (await params).id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    return apiError("INTERNAL_ERROR", "Could not remove the allowlist entry.", 500);
  }
}
