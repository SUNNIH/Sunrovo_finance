"use client";

import * as React from "react";
import { Bell, CheckCheck, Shield, Info as InfoIcon, Receipt, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { postJson, patchJson } from "@/lib/utilities/api-client";
import { cn } from "@/lib/utilities/cn";

interface NotificationView {
  id: string;
  type: "SECURITY" | "TRANSACTION" | "MARKETING" | "SYSTEM";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

const ICON_BY_TYPE: Record<NotificationView["type"], React.ComponentType<{ className?: string }>> = {
  SECURITY: Shield,
  TRANSACTION: Receipt,
  MARKETING: Megaphone,
  SYSTEM: InfoIcon,
};

export function NotificationsClient({ initialNotifications }: { initialNotifications: NotificationView[] }) {
  const [notifications, setNotifications] = React.useState(initialNotifications);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await patchJson(`/api/notifications/${id}/read`, {}).catch(() => undefined);
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await postJson("/api/notifications/mark-all-read", {}).catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        </div>
      )}

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <Bell className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-elevated">
          {notifications.map((n) => {
            const Icon = ICON_BY_TYPE[n.type];
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => markRead(n.id)}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover",
                  !n.isRead && "bg-primary-soft/40"
                )}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm", n.isRead ? "text-text-primary" : "font-semibold text-text-primary")}>
                      {n.title}
                    </p>
                    {!n.isRead && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </div>
                  <p className="mt-0.5 text-sm text-text-secondary">{n.body}</p>
                  <p className="mt-1 text-body-sm text-text-tertiary">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
