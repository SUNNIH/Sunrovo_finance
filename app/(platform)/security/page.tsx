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
import { WithdrawalAllowlistCard } from "./withdrawal-allowlist-card";
import { PrivacySettingsCard } from "./privacy-settings-card";
import { TrustedDevicesCard } from "./trusted-devices-card";
import { ActiveSessionsCard } from "./active-sessions-card";
import { LoginHistoryCard } from "./login-history-card";
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
    <div className="flex flex-col gap-8 max-w-4xl animate-fade-in-up">
      {/* Page Header */}
      <div>
        <h1 className="text-page-title-mobile font-semibold tracking-tight text-text-primary sm:text-page-title">
          Security &amp; Privacy
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your authentication credentials, transaction PIN, withdrawal restrictions, and active sessions.
        </p>
      </div>

      {/* SECTION 1: Authentication & Access Protection */}
      <section className="flex flex-col gap-4" aria-labelledby="section-auth-title">
        <div>
          <h2 id="section-auth-title" className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Authentication &amp; Access Protection
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Credentials and multi-factor verification required to sign in to your PLT account.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <MfaSetupCard initialMfaEnabled={user.securitySetting?.mfaEnabled ?? false} />
          <ChangePasswordCard />
        </div>
      </section>

      {/* SECTION 2: Financial Authorization & Safeguards */}
      <section className="flex flex-col gap-4" aria-labelledby="section-financial-title">
        <div>
          <h2 id="section-financial-title" className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Financial Authorization &amp; Safeguards
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Security controls protecting withdrawals, fund transfers, and anti-phishing verification.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <TransactionPinCard initialPinSet={Boolean(user.securitySetting?.transactionPinHash)} />
          <WithdrawalAllowlistCard initialEnabled={user.securitySetting?.withdrawalAllowlistEnabled ?? false} />
          <PrivacySettingsCard initialPhrase={user.securitySetting?.antiPhishingPhrase ?? null} />
        </div>
      </section>

      {/* SECTION 3: Devices & Session Activity */}
      <section className="flex flex-col gap-4" aria-labelledby="section-devices-title">
        <div>
          <h2 id="section-devices-title" className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Devices &amp; Session Activity
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Monitor active sign-in sessions, trusted devices, and authentication history.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <ActiveSessionsCard
            initialSessions={sessions.map((s) => ({
              id: s.id,
              userAgent: s.userAgent,
              ipAddress: s.ipAddress,
              createdAt: s.createdAt.toISOString(),
              isCurrent: s.isCurrent,
            }))}
          />
          <TrustedDevicesCard
            initialDevices={devices.map((d) => ({
              id: d.id,
              deviceName: d.deviceName,
              lastSeenAt: d.lastSeenAt.toISOString(),
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
        </div>
      </section>

      {/* SECTION 4: Account Management */}
      <section className="flex flex-col gap-4" aria-labelledby="section-danger-title">
        <div>
          <h2 id="section-danger-title" className="text-sm font-semibold uppercase tracking-wider text-text-tertiary">
            Account Management
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Actions affecting account status and access permissions.
          </p>
        </div>
        <DangerZoneCard />
      </section>
    </div>
  );
}
