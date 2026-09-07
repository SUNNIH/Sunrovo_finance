import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listTrustedDevices,
  listActiveSessions,
  listLoginHistory,
} from "@/features/authentication/account-security";
import { MfaSetupCard } from "./mfa-setup-card";
import { TransactionPinCard } from "./transaction-pin-card";
import { ChangePasswordCard } from "./change-password-card";
import { TrustedDevicesCard } from "./trusted-devices-card";
import { ActiveSessionsCard } from "./active-sessions-card";
import { LoginHistoryCard } from "./login-history-card";
import { PrivacySettingsCard } from "./privacy-settings-card";
import { DangerZoneCard } from "./danger-zone-card";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [devices, sessions, loginEvents] = await Promise.all([
    listTrustedDevices(user.id),
    listActiveSessions(user.id),
    listLoginHistory(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Security</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage how you sign in and how PLT protects your account.
        </p>
      </div>

      <TransactionPinCard initialPinSet={Boolean(user.securitySetting?.transactionPinHash)} />
      <MfaSetupCard initialMfaEnabled={user.securitySetting?.mfaEnabled ?? false} />
      <ChangePasswordCard />
      <PrivacySettingsCard
        initialPhrase={user.securitySetting?.antiPhishingPhrase ?? null}
        initialAllowlistEnabled={user.securitySetting?.withdrawalAllowlistEnabled ?? false}
      />
      <TrustedDevicesCard
        initialDevices={devices.map((d) => ({
          id: d.id,
          deviceName: d.deviceName,
          lastSeenAt: d.lastSeenAt.toISOString(),
        }))}
      />
      <ActiveSessionsCard
        initialSessions={sessions.map((s) => ({
          id: s.id,
          userAgent: s.userAgent,
          ipAddress: s.ipAddress,
          createdAt: s.createdAt.toISOString(),
          isCurrent: s.isCurrent,
        }))}
      />
      <LoginHistoryCard
        events={loginEvents.map((e) => ({
          id: e.id,
          success: e.success,
          ipAddress: e.ipAddress,
          riskFlag: e.riskFlag,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
      <DangerZoneCard />
    </div>
  );
}
