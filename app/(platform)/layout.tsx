import { requireOnboardedUser } from "@/lib/auth/session";
import { ensureCsrfCookie } from "@/lib/auth/csrf";
import { AppShell } from "@/components/layout/app-shell";
import { getPlatformSettings } from "@/features/admin/operations";
import { AnnouncementsBanner } from "@/components/layout/announcements-banner";
import { redirect } from "next/navigation";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  // Authoritative auth + onboarding check (middleware only does a cheap
  // cookie-presence redirect; this is the real gate).
  const user = await requireOnboardedUser();
  const platformSettings = await getPlatformSettings();
  if (platformSettings.maintenanceMode && user.role !== "ADMIN") redirect("/maintenance");
  await ensureCsrfCookie();

  const initials = (user.profile?.fullName ?? user.email)
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AppShell userName={user.profile?.fullName ?? user.email} userInitials={initials || "U"}>
      <AnnouncementsBanner />
      {children}
    </AppShell>
  );
}
