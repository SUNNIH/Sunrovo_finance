"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
  Smartphone,
} from "lucide-react";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { FiseLoader } from "@/components/brand/fise-loader";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MfaSetupCardProps {
  initialMfaEnabled: boolean;
}

type Stage = "idle" | "enrolling" | "confirming";

export function MfaSetupCard({ initialMfaEnabled }: MfaSetupCardProps) {
  const [mfaEnabled, setMfaEnabled] = React.useState(initialMfaEnabled);
  const [stage, setStage] = React.useState<Stage>("idle");
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = React.useState(false);

  async function beginEnrollment() {
    setError(null);
    setBusy(true);
    try {
      const result = await postJson<{ secret: string; otpauthUrl: string }>("/api/auth/mfa/setup", {});
      setSecret(result.secret);
      setStage("confirming");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to initiate two-factor setup.");
    } finally {
      setBusy(false);
    }
  }

  // Show FiseLoader during MFA enrollment initiation
  const isEnrolling = busy && stage === "enrolling";

  async function confirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/auth/mfa/enable", { code: code.trim() });
      setMfaEnabled(true);
      setStage("idle");
      setSecret(null);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Invalid verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/auth/mfa/disable", { currentPassword });
      setMfaEnabled(false);
      setCurrentPassword("");
      setShowDisableConfirm(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to disable two-factor authentication.");
    } finally {
      setBusy(false);
    }
  }

  async function copyManualKey() {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Smartphone className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Two-Factor Authentication (2FA)</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Requires a 6-digit verification code from an authenticator app when signing in.
            </CardDescription>
          </div>
        </div>
        <div className="shrink-0">
          <Badge
            variant={mfaEnabled ? "success" : "neutral"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
          >
            {mfaEnabled ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <span>Active</span>
              </>
            ) : (
              <>
                <ShieldOff className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                <span>Disabled</span>
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!mfaEnabled && stage === "idle" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary mb-1 leading-relaxed">
              Enhance account security by pairing with an authenticator app such as Google Authenticator, Microsoft Authenticator, or 1Password.
            </p>

            {isEnrolling && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/30 p-3 animate-fade-in">
                <FiseLoader variant="inline" size="sm" text="Preparing 2FA setup..." />
              </div>
            )}

            <Button
              type="button"
              onClick={beginEnrollment}
              disabled={busy}
              className="touch-target gap-2 font-medium w-fit"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Preparing Setup...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Set Up Authenticator App</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Enrollment Flow (Secret only available during active enrollment) */}
        {!mfaEnabled && stage === "confirming" && secret && (
          <form onSubmit={confirmEnrollment} className="flex flex-col gap-4 max-w-md animate-fade-in">
            <div className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Manual Setup Key</span>
              </div>
              <p className="text-xs text-text-secondary">
                Enter this key into your authenticator app to generate verification codes:
              </p>
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-elevated p-2.5">
                <span className="font-mono text-xs sm:text-sm font-semibold tracking-wider text-text-primary break-all financial-value">
                  {secret}
                </span>
                <button
                  type="button"
                  onClick={copyManualKey}
                  className="touch-target inline-flex items-center justify-center rounded-md px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
                  title={copiedKey ? "Copied" : "Copy Setup Key"}
                  aria-label={copiedKey ? "Copied Setup Key" : "Copy Setup Key"}
                >
                  {copiedKey ? (
                    <span className="flex items-center gap-1 text-success">
                      <Check className="h-3.5 w-3.5" /> Copied
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Copy className="h-3.5 w-3.5" /> Copy
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <TextField
                label="6-Digit Verification Code"
                id="mfa-code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="font-mono text-center tracking-widest text-lg financial-value max-w-[180px]"
                autoComplete="one-time-code"
              />
              <p className="text-[11px] text-text-tertiary">
                Enter the current code displayed in your authenticator app.
              </p>
            </div>

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStage("idle");
                  setSecret(null);
                  setCode("");
                  setError(null);
                }}
                className="touch-target"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={busy || code.trim().length !== 6}
                className="touch-target gap-2 font-medium"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify and Enable</span>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Enabled State & Disable Flow */}
        {mfaEnabled && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-text-secondary">
              Two-factor authentication is active on your account. You will be prompted for a 6-digit code upon signing in from untrusted devices.
            </p>

            {!showDisableConfirm ? (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDisableConfirm(true)}
                  className="touch-target text-xs text-danger hover:text-danger hover:border-danger/40"
                >
                  <ShieldOff className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  <span>Disable Two-Factor Authentication</span>
                </Button>
              </div>
            ) : (
              <form onSubmit={disable} className="flex max-w-sm flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft/20 p-4 animate-fade-in">
                <div className="flex items-start gap-2 text-xs text-danger font-medium">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    Disabling 2FA reduces account security and will sign you out of all active sessions immediately.
                  </span>
                </div>
                <PasswordField
                  label="Confirm Current Password"
                  id="mfa-disable-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDisableConfirm(false);
                      setCurrentPassword("");
                      setError(null);
                    }}
                    className="touch-target"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    size="sm"
                    disabled={busy || !currentPassword}
                    className="touch-target gap-1.5 font-medium"
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Disabling...</span>
                      </>
                    ) : (
                      <span>Confirm &amp; Disable 2FA</span>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
