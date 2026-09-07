import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { changePasswordSchema } from "@/lib/validation/treasury";
import { changePassword } from "@/features/authentication/account-security";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input.", 422);
  }

  try {
    await changePassword(user.id, parsed.data);
    return apiSuccess({ changed: true });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("change password failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
