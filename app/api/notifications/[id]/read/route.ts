import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { markNotificationRead } from "@/features/notifications/notifications";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  const { id } = await params;
  try {
    const notification = await markNotificationRead(user.id, id);
    return apiSuccess({ notification });
  } catch (error) {
    if (error instanceof AuthError) return apiError(error.code, error.message, error.status);
    console.error("mark notification read failed", error);
    return apiError("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
  }
}
