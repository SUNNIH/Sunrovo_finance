import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  Info,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemePreferenceCard } from "./theme-preference-card";

export const metadata: Metadata = { title: "Profile & Settings" };

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PL";
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? "PL";
  const first = parts[0]?.[0] ?? "";
  const last = parts[parts.length - 1]?.[0] ?? "";
  return `${first}${last}`.toUpperCase();
}

function getKycBadge(status: string) {
  switch (status) {
    case "VERIFIED":
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          <span>Identity Verified</span>
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="warning" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          <span>Verification Pending</span>
        </Badge>
      );
    case "REJECTED":
      return (
        <Badge variant="danger" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" aria-hidden="true" />
          <span>Verification Rejected</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" className="flex items-center gap-1">
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          <span>Identity Not Started</span>
        </Badge>
      );
  }
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const fullName = user.profile?.fullName ?? "Valued Client";
  const initials = getInitials(fullName);
  const kycStatus = user.profile?.kycStatus ?? "NOT_STARTED";
  const isEmailVerified = Boolean(user.emailVerifiedAt);
  const isPhoneVerified = Boolean(user.phoneVerifiedAt);

  const memberSince = new Date(user.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const dobFormatted = user.profile?.dateOfBirth
    ? new Date(user.profile.dateOfBirth).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <div className="flex flex-col gap-8 max-w-4xl animate-fade-in-up">
      {/* ── PAGE HEADER ────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-page-title-mobile font-semibold tracking-tight text-text-primary sm:text-page-title">
          Profile &amp; Settings
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          View your verified account profile, identity status, contact details, and display preferences.
        </p>
      </div>

      {/* ── SECTION 1: PROFILE SUMMARY HERO ────────────────────────────────── */}
      <Card className="border-border/80 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-primary-soft/40 via-surface to-surface p-6 sm:p-7 border-b border-border/70">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {/* Initials Avatar Ring */}
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-xl shadow-xs ring-4 ring-primary/20"
                aria-hidden="true"
              >
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold tracking-tight text-text-primary truncate">
                    {fullName}
                  </h2>
                  <Badge variant="neutral" className="text-xs uppercase font-medium">
                    {user.role === "ADMIN" ? "Administrator" : "Client"}
                  </Badge>
                </div>

                <p className="text-xs font-mono text-text-secondary truncate mt-0.5">
                  {user.email}
                </p>

                <p className="text-[11px] text-text-tertiary mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" aria-hidden="true" />
                  <span>Member since {memberSince}</span>
                </p>
              </div>
            </div>

            {/* Status Badges Group */}
            <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
              {getKycBadge(kycStatus)}
              <Badge
                variant={user.status === "ACTIVE" ? "success" : "warning"}
                className="text-xs"
              >
                Account: {user.status}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* ── SECTION 2: VERIFIED PERSONAL DETAILS (READ-ONLY) ───────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <User className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-text-primary">Personal Details</CardTitle>
                <CardDescription className="text-xs text-text-secondary mt-0.5">
                  Verified legal identity information registered with Platinum Trust Bank.
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] text-text-tertiary bg-surface-elevated px-2.5 py-1 rounded-md border border-border/80 shrink-0">
              <Lock className="h-3 w-3" aria-hidden="true" />
              <span>Read-Only Record</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-border/80 bg-surface p-3.5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Legal Full Name</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">{fullName}</p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Date of Birth</p>
              <p className="mt-1 text-sm font-semibold text-text-primary font-mono">
                {dobFormatted ?? "Not Provided"}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Country of Residence</p>
              <p className="mt-1 text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                <span>{user.profile?.country ?? "—"}</span>
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Account Classification</p>
              <p className="mt-1 text-sm font-semibold text-text-primary capitalize">
                {user.profile?.accountType ?? "individual"}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Base Currency</p>
              <p className="mt-1 text-sm font-semibold text-text-primary font-mono">
                {user.profile?.preferredFiatCurrency ?? "USD"}
              </p>
            </div>

            <div className="rounded-xl border border-border/80 bg-surface p-3.5">
              <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">Identity Verification</p>
              <div className="mt-1">
                {getKycBadge(kycStatus)}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/60 p-3 text-xs text-text-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
            <span className="leading-relaxed">
              Legal identity details were confirmed during account onboarding. To request corrections or submit updated KYC documentation, please contact Platinum Trust Bank compliance.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 3: CONTACT & COMMUNICATION ─────────────────────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-text-primary">Contact &amp; Communication</CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Communication channels registered for security notices and transaction receipts.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Primary Email */}
            <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-surface p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <Mail className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                  <span>Email Address</span>
                </div>
                {isEmailVerified ? (
                  <Badge variant="success" className="flex items-center gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    <span>Verified</span>
                  </Badge>
                ) : (
                  <Badge variant="neutral" className="text-[10px]">
                    Unverified
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm font-semibold font-mono text-text-primary break-all">
                {user.email}
              </p>
            </div>

            {/* Phone Number */}
            <div className="flex flex-col justify-between rounded-xl border border-border/80 bg-surface p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                  <Phone className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                  <span>Phone Number</span>
                </div>
                {user.profile?.phoneNumber ? (
                  isPhoneVerified ? (
                    <Badge variant="success" className="flex items-center gap-1 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Verified</span>
                    </Badge>
                  ) : (
                    <Badge variant="neutral" className="text-[10px]">
                      Unverified
                    </Badge>
                  )
                ) : null}
              </div>
              <p className="mt-2 text-sm font-semibold font-mono text-text-primary">
                {user.profile?.phoneNumber || "No phone number registered"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 4: APPEARANCE & DISPLAY PREFERENCES ────────────────────── */}
      <ThemePreferenceCard />

      {/* ── SECTION 5: SECURITY & AUTHORIZATION QUICK STATUS ───────────────── */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-text-primary">Security &amp; Authorization</CardTitle>
              <CardDescription className="text-xs text-text-secondary mt-0.5">
                Overview of authentication safeguards protecting your funds.
              </CardDescription>
            </div>
          </div>

          <Link href="/security">
            <Button variant="outline" size="sm" className="touch-target gap-1.5 text-xs font-medium">
              <span>Security Settings</span>
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-xs text-text-tertiary">Two-Factor Auth</p>
              <div className="mt-1 flex justify-center">
                <Badge
                  variant={user.securitySetting?.mfaEnabled ? "success" : "neutral"}
                  className="text-[11px]"
                >
                  {user.securitySetting?.mfaEnabled ? "Active" : "Disabled"}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-xs text-text-tertiary">Transaction PIN</p>
              <div className="mt-1 flex justify-center">
                <Badge
                  variant={user.securitySetting?.transactionPinHash ? "success" : "warning"}
                  className="text-[11px]"
                >
                  {user.securitySetting?.transactionPinHash ? "Configured" : "Not Set"}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-xs text-text-tertiary">Withdrawal Allowlist</p>
              <div className="mt-1 flex justify-center">
                <Badge
                  variant={user.securitySetting?.withdrawalAllowlistEnabled ? "success" : "neutral"}
                  className="text-[11px]"
                >
                  {user.securitySetting?.withdrawalAllowlistEnabled ? "Enforced" : "Disabled"}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-xs text-text-tertiary">Anti-Phishing Phrase</p>
              <div className="mt-1 flex justify-center">
                <Badge
                  variant={user.securitySetting?.antiPhishingPhrase ? "success" : "neutral"}
                  className="text-[11px]"
                >
                  {user.securitySetting?.antiPhishingPhrase ? "Active" : "Not Set"}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
