import { getCurrentUser } from "@/lib/auth/session";
import { verifyCsrf } from "@/lib/auth/csrf";
import { markAllNotificationsRead } from "@/features/notifications/notifications";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  if (!(await verifyCsrf(request))) {
    return apiError("CSRF_INVALID", "Your session could not be verified. Refresh the page and try again.", 403);
  }

  await markAllNotificationsRead(user.id);
  return apiSuccess({ done: true });
}
