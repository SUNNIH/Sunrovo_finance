import { getCurrentUser } from "@/lib/auth/session";
import { listNotifications, getUnreadCount } from "@/features/notifications/notifications";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id),
    getUnreadCount(user.id),
  ]);
  return apiSuccess({ notifications, unreadCount });
}
