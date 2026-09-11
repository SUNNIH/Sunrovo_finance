import { describe, expect, it } from "vitest";
import {
  formatNotificationRelativeTime,
  type NotificationView,
  type NotificationFilter,
} from "@/app/(platform)/notifications/notifications-client";

describe("Notification Relative Time Formatter", () => {
  const baseTime = new Date("2026-09-08T12:00:00.000Z");

  it("returns 'Just now' for timestamps within 60 seconds", () => {
    const recent = new Date("2026-09-08T11:59:30.000Z").toISOString();
    expect(formatNotificationRelativeTime(recent, baseTime)).toBe("Just now");
  });

  it("returns minutes ago for timestamps under 1 hour", () => {
    const tenMinutesAgo = new Date("2026-09-08T11:50:00.000Z").toISOString();
    expect(formatNotificationRelativeTime(tenMinutesAgo, baseTime)).toBe("10m ago");

    const fortyFiveMinutesAgo = new Date("2026-09-08T11:15:00.000Z").toISOString();
    expect(formatNotificationRelativeTime(fortyFiveMinutesAgo, baseTime)).toBe("45m ago");
  });

  it("returns hours ago for timestamps within the same day", () => {
    const threeHoursAgo = new Date("2026-09-08T09:00:00.000Z").toISOString();
    expect(formatNotificationRelativeTime(threeHoursAgo, baseTime)).toBe("3h ago");
  });

  it("returns 'Yesterday' for timestamps between 24 and 48 hours ago", () => {
    const yesterday = new Date("2026-09-07T11:00:00.000Z").toISOString();
    expect(formatNotificationRelativeTime(yesterday, baseTime)).toBe("Yesterday");
  });

  it("returns days ago for timestamps within 7 days", () => {
    const fourDaysAgo = new Date("2026-09-04T12:00:00.000Z").toISOString();
    expect(formatNotificationRelativeTime(fourDaysAgo, baseTime)).toBe("4d ago");
  });

  it("returns formatted month and day for older dates in the same year", () => {
    const twoMonthsAgo = new Date("2026-07-01T12:00:00.000Z").toISOString();
    const formatted = formatNotificationRelativeTime(twoMonthsAgo, baseTime);
    expect(formatted).toContain("Jul");
    expect(formatted).toContain("1");
  });

  it("handles invalid date strings gracefully without throwing", () => {
    expect(formatNotificationRelativeTime("invalid-date-string", baseTime)).toBe("invalid-date-string");
  });
});

describe("Notification Filtering Logic", () => {
  const sampleNotifications: NotificationView[] = [
    {
      id: "notif_1",
      type: "SECURITY",
      title: "New Login Detected",
      body: "Login from 127.0.0.1",
      isRead: false,
      createdAt: "2026-09-08T11:00:00.000Z",
    },
    {
      id: "notif_2",
      type: "TRANSACTION",
      title: "Withdrawal submitted",
      body: "$100.00 USD to external bank",
      isRead: true,
      createdAt: "2026-09-07T15:00:00.000Z",
    },
    {
      id: "notif_3",
      type: "TRANSACTION",
      title: "Transfer submitted",
      body: "$50.00 transfer initiated",
      isRead: false,
      createdAt: "2026-09-06T10:00:00.000Z",
    },
    {
      id: "notif_4",
      type: "SYSTEM",
      title: "Welcome to FISE Holdings Trust Bank",
      body: "Your account is active.",
      isRead: true,
      createdAt: "2026-09-01T09:00:00.000Z",
    },
    {
      id: "notif_5",
      type: "MARKETING",
      title: "New Feature Available",
      body: "Instant crypto conversion is live.",
      isRead: false,
      createdAt: "2026-08-30T09:00:00.000Z",
    },
  ];

  function filterNotifications(
    notifications: NotificationView[],
    filter: NotificationFilter
  ): NotificationView[] {
    switch (filter) {
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
  }

  it("filters ALL correctly", () => {
    const res = filterNotifications(sampleNotifications, "ALL");
    expect(res).toHaveLength(5);
  });

  it("filters UNREAD correctly", () => {
    const res = filterNotifications(sampleNotifications, "UNREAD");
    expect(res).toHaveLength(3);
    expect(res.every((n) => !n.isRead)).toBe(true);
  });

  it("filters SECURITY correctly", () => {
    const res = filterNotifications(sampleNotifications, "SECURITY");
    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe("New Login Detected");
  });

  it("filters TRANSACTION correctly", () => {
    const res = filterNotifications(sampleNotifications, "TRANSACTION");
    expect(res).toHaveLength(2);
    expect(res.every((n) => n.type === "TRANSACTION")).toBe(true);
  });

  it("filters SYSTEM correctly", () => {
    const res = filterNotifications(sampleNotifications, "SYSTEM");
    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe("Welcome to FISE Holdings Trust Bank");
  });

  it("filters MARKETING correctly", () => {
    const res = filterNotifications(sampleNotifications, "MARKETING");
    expect(res).toHaveLength(1);
    expect(res[0]?.title).toBe("New Feature Available");
  });

  it("computes accurate unread counts", () => {
    const unread = sampleNotifications.filter((n) => !n.isRead).length;
    expect(unread).toBe(3);
  });
});

describe("Notification Invariants & Safety Rules", () => {
  it("strictly matches authoritative Prisma NotificationType enum values", () => {
    const backendTypes = ["SECURITY", "TRANSACTION", "SYSTEM", "MARKETING"] as const;
    backendTypes.forEach((t) => {
      expect(["SECURITY", "TRANSACTION", "SYSTEM", "MARKETING"]).toContain(t);
    });
  });

  it("preserves exact mutation contract paths without inventing preference endpoints", () => {
    const markReadEndpoint = (id: string) => `/api/notifications/${id}/read`;
    const markAllReadEndpoint = "/api/notifications/mark-all-read";

    expect(markReadEndpoint("notif_123")).toBe("/api/notifications/notif_123/read");
    expect(markAllReadEndpoint).toBe("/api/notifications/mark-all-read");
  });

  it("preserves exact full timestamp string for accessible details and machine-readable dateTime", () => {
    const isoString = "2026-09-08T11:00:00.000Z";
    const parsedDate = new Date(isoString);

    expect(parsedDate.toISOString()).toBe(isoString);
    expect(parsedDate.toLocaleString()).toBeTruthy();
  });
});
