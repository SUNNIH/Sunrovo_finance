"use client";

import * as React from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Info as InfoIcon,
  Loader2,
  Megaphone,
  Receipt,
  Shield,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { postJson, patchJson } from "@/lib/utilities/api-client";
import { cn } from "@/lib/utilities/cn";

export interface NotificationView {
  id: string;
  type: "SECURITY" | "TRANSACTION" | "MARKETING" | "SYSTEM";
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export type NotificationFilter = "ALL" | "UNREAD" | "SECURITY" | "TRANSACTION" | "SYSTEM" | "MARKETING";

export function formatNotificationRelativeTime(isoString: string, now: Date = new Date()): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }

  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60 * 1000) {
    return "Just now";
  }

  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }

  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

const TYPE_CONFIG = {
  SECURITY: {
    icon: ShieldAlert,
    label: "Security Alert",
    badgeVariant: "warning" as const,
    iconWrapperClass: "bg-warning-soft text-warning border-warning/30",
  },
  TRANSACTION: {
    icon: Receipt,
    label: "Transaction",
    badgeVariant: "primary" as const,
    iconWrapperClass: "bg-primary-soft text-primary border-primary/25",
  },
  SYSTEM: {
    icon: InfoIcon,
    label: "System Notice",
    badgeVariant: "neutral" as const,
    iconWrapperClass: "bg-surface-hover text-text-secondary border-border",
  },
  MARKETING: {
    icon: Megaphone,
    label: "Platform Update",
    badgeVariant: "info" as const,
    iconWrapperClass: "bg-info-soft text-info border-info/25",
  },
};

export function NotificationsClient({ initialNotifications }: { initialNotifications: NotificationView[] }) {
  const [notifications, setNotifications] = React.useState<NotificationView[]>(initialNotifications);
  const [activeFilter, setActiveFilter] = React.useState<NotificationFilter>("ALL");
  const [markingAll, setMarkingAll] = React.useState(false);
  const [markingId, setMarkingId] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const securityCount = notifications.filter((n) => n.type === "SECURITY").length;
  const transactionCount = notifications.filter((n) => n.type === "TRANSACTION").length;
  const systemCount = notifications.filter((n) => n.type === "SYSTEM").length;
  const marketingCount = notifications.filter((n) => n.type === "MARKETING").length;

  const filterTabs: Array<{ id: NotificationFilter; label: string; count: number }> = [
    { id: "ALL", label: "All", count: notifications.length },
    { id: "UNREAD", label: "Unread", count: unreadCount },
    { id: "SECURITY", label: "Security", count: securityCount },
    { id: "TRANSACTION", label: "Transactions", count: transactionCount },
    { id: "SYSTEM", label: "System", count: systemCount },
  ];

  if (marketingCount > 0) {
    filterTabs.push({ id: "MARKETING", label: "Updates", count: marketingCount });
  }

  const filteredNotifications = React.useMemo(() => {
    switch (activeFilter) {
      case "UNREAD":
        return notifications.filter((n) => !n.isRead);
      case "SECURITY":
        return notifications.filter((n) => n.type === "SECURITY");
      case "TRANSACTION":
        return notifications.filter((n) => n.type === "TRANSACTION");
      case "SYSTEM":
        return notifications.filter((n) => n.type === "SYSTEM");
      case "MARKETING":
        return notifications.filter((n) => n.type === "MARKETING");
      case "ALL":
      default:
        return notifications;
    }
  }, [notifications, activeFilter]);

  async function markRead(id: string) {
    setMarkingId(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setStatusMessage("Notification marked as read.");
    try {
      await patchJson(`/api/notifications/${id}/read`, {});
    } catch {
      // Background failure safe
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    if (unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setStatusMessage("All notifications marked as read.");
    try {
      await postJson("/api/notifications/mark-all-read", {});
    } catch {
      // Background failure safe
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Screen-reader live region for action feedback */}
      <div className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </div>

      {/* Factual Notification Centre Information Card */}
      <div className="rounded-xl border border-border bg-surface-elevated p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-primary/20 bg-primary-soft p-2 text-primary shrink-0">
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">
              Notification Centre
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              Security and account notifications are delivered through your FHT notification centre.
            </p>
          </div>
        </div>
      </div>

      {/* Filter Tabs and Actions Bar */}
      <div className="flex flex-col gap-3">
        {/* Filter chips with smooth horizontal scroll and subtle fade indicator */}
        <div className="relative">
          <div
            role="tablist"
            aria-label="Filter notifications"
            className="flex gap-2 overflow-x-auto scrollbar-none pb-1 scroll-smooth"
          >
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  onClick={() => setActiveFilter(tab.id)}
                  className={cn(
                    "touch-target shrink-0 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight min-w-[20px] text-center",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-surface-hover text-text-tertiary"
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Subtle right-edge fade to indicate more content */}
          <div 
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent sm:hidden" 
            aria-hidden="true"
          />
        </div>

        {/* Mark All Read - better mobile positioning */}
        <div className="flex items-center justify-between sm:justify-end">
          <span className="text-xs text-text-secondary sm:hidden">
            {unreadCount > 0 ? `${unreadCount} unread` : "All read"}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0 || markingAll}
            className="touch-target h-9 gap-1.5 px-3 text-xs shrink-0"
            aria-label="Mark all notifications as read"
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            )}
            <span>Mark all read</span>
          </Button>
        </div>
      </div>

      {/* Notifications List or Contextual Empty State */}
      {filteredNotifications.length === 0 ? (
        <Card className="border-border bg-surface-elevated">
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center sm:p-12">
            {activeFilter === "UNREAD" ? (
              <>
                <div className="rounded-full bg-success-soft p-3 text-success">
                  <CheckCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">All caught up</h3>
                <p className="max-w-sm text-sm text-text-secondary">
                  You have no unread notifications to review.
                </p>
              </>
            ) : activeFilter === "SECURITY" ? (
              <>
                <div className="rounded-full bg-warning-soft p-3 text-warning">
                  <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">No security alerts</h3>
                <p className="max-w-sm text-sm text-text-secondary">
                  No security events currently recorded on your account. Login detection notices will appear here.
                </p>
              </>
            ) : activeFilter === "TRANSACTION" ? (
              <>
                <div className="rounded-full bg-primary-soft p-3 text-primary">
                  <Receipt className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">No transaction alerts</h3>
                <p className="max-w-sm text-sm text-text-secondary">
                  Activity from transfers and withdrawals will appear here.
                </p>
              </>
            ) : activeFilter === "SYSTEM" ? (
              <>
                <div className="rounded-full bg-surface-hover p-3 text-text-secondary">
                  <InfoIcon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">No system notices</h3>
                <p className="max-w-sm text-sm text-text-secondary">
                  No platform notices to display at this time.
                </p>
              </>
            ) : activeFilter === "MARKETING" ? (
              <>
                <div className="rounded-full bg-info-soft p-3 text-info">
                  <Megaphone className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">No updates</h3>
                <p className="max-w-sm text-sm text-text-secondary">
                  No platform updates to display at this time.
                </p>
              </>
            ) : (
              <>
                <div className="rounded-full bg-surface-hover p-3 text-text-tertiary">
                  <Bell className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-text-primary">No notifications yet</h3>
                <p className="max-w-sm text-sm text-text-secondary">
                  Security alerts and account activity will appear here.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated divide-y divide-border/60 shadow-sm">
          {filteredNotifications.map((n) => {
            const config = TYPE_CONFIG[n.type];
            const Icon = config.icon;
            const exactTimestamp = new Date(n.createdAt).toLocaleString();
            const relativeTime = formatNotificationRelativeTime(n.createdAt);

            return (
              <div
                key={n.id}
                role="article"
                aria-labelledby={`notif-title-${n.id}`}
                className={cn(
                  "flex flex-col gap-3 p-3.5 sm:p-4 transition-colors sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                  !n.isRead
                    ? "bg-primary-soft/20 hover:bg-primary-soft/30 dark:bg-primary-soft/10"
                    : "hover:bg-surface-hover/50"
                )}
              >
                {/* Left icon and message contents */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border",
                      config.iconWrapperClass
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Metadata Header: Type Badge + Read/Unread State + Relative Timestamp */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <Badge variant={config.badgeVariant} className="text-[11px] font-medium shrink-0">
                        {config.label}
                      </Badge>

                      {/* Explicit text badge so state is never communicated by color alone */}
                      {!n.isRead ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary shrink-0">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                          <span>Unread</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-tertiary shrink-0">
                          Read
                        </span>
                      )}

                      <time
                        dateTime={n.createdAt}
                        title={exactTimestamp}
                        className="text-xs text-text-tertiary whitespace-nowrap shrink-0 ml-auto"
                      >
                        {relativeTime}
                      </time>
                    </div>

                    {/* Title */}
                    <h3
                      id={`notif-title-${n.id}`}
                      className={cn(
                        "text-sm text-text-primary mb-1",
                        !n.isRead ? "font-semibold" : "font-medium"
                      )}
                    >
                      {n.title}
                    </h3>

                    {/* Body */}
                    <p className="text-sm text-text-secondary leading-relaxed break-words pr-2">
                      {n.body}
                    </p>
                  </div>
                </div>

                {/* Right Action: Explicit Mark as Read control */}
                <div className="flex shrink-0 items-center justify-end sm:self-center sm:justify-start mt-2 sm:mt-0">
                  {!n.isRead ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markRead(n.id)}
                      disabled={markingId === n.id}
                      className="touch-target h-9 gap-1.5 px-3 text-xs w-full sm:w-auto"
                      aria-label={`Mark "${n.title}" as read`}
                    >
                      {markingId === n.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      )}
                      <span>Mark as read</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-text-tertiary px-2 hidden sm:inline-block">
                      Read
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
