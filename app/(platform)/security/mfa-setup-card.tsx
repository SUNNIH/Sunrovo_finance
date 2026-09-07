"use client";

import * as React from "react";
import { KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
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
  const [otpauthUrl, setOtpauthUrl] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function beginEnrollment() {
    setError(null);
    setBusy(true);
    try {
      const result = await postJson<{ secret: string; otpauthUrl: string }>("/api/auth/mfa/setup", {});
      setSecret(result.secret);
      setOtpauthUrl(result.otpauthUrl);
      setStage("confirming");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrollment(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/auth/mfa/enable", { code });
      setMfaEnabled(true);
      setStage("idle");
      setCode("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
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
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Two-factor authentication</CardTitle>
          <CardDescription>Require a 6-digit code from an authenticator app at sign-in.</CardDescription>
        </div>
        <Badge variant={mfaEnabled ? "success" : "neutral"}>
          {mfaEnabled ? "Enabled" : "Disabled"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        {!mfaEnabled && stage === "idle" && (
          <Button onClick={beginEnrollment} disabled={busy} className="w-fit">
            <ShieldCheck className="h-4 w-4" /> Set up two-factor authentication
          </Button>
        )}

        {!mfaEnabled && stage === "confirming" && secret && (
          <form onSubmit={confirmEnrollment} className="flex flex-col gap-3">
            <div className="rounded-md border border-border bg-surface p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
                <KeyRound className="h-4 w-4" /> Manual entry key
              </p>
              <p className="mt-1 break-all font-mono text-sm text-text-secondary financial-value">{secret}</p>
              <p className="mt-2 text-body-sm text-text-tertiary break-all">{otpauthUrl}</p>
            </div>
            <TextField
              label="Enter the 6-digit code from your app"
              id="mfa-code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStage("idle")}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Confirm and enable
              </Button>
            </div>
          </form>
        )}

        {mfaEnabled && (
          <form onSubmit={disable} className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              Disabling two-factor authentication requires your password and will sign you out
              everywhere.
            </p>
            <PasswordField
              label="Current password"
              id="mfa-disable-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <Button type="submit" variant="danger" disabled={busy} className="w-fit">
              <ShieldOff className="h-4 w-4" /> Disable two-factor authentication
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
