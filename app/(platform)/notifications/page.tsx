import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { listNotifications, getUnreadCount } from "@/features/notifications/notifications";
import { NotificationsClient } from "./notifications-client";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [notifications, unreadCount] = await Promise.all([
    listNotifications(user.id),
    getUnreadCount(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Notifications</h1>
            {unreadCount > 0 ? (
              <Badge variant="primary" className="font-semibold">
                {unreadCount} unread
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-text-tertiary">
                All caught up
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Security alerts and account activity.
          </p>
        </div>
      </header>
      <NotificationsClient
        initialNotifications={notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          isRead: n.isRead,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}

