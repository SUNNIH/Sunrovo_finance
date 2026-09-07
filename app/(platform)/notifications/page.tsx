import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { listNotifications } from "@/features/notifications/notifications";
import { NotificationsClient } from "./notifications-client";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const notifications = await listNotifications(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Notifications</h1>
        <p className="mt-1 text-sm text-text-secondary">Security alerts and account activity.</p>
      </div>
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
