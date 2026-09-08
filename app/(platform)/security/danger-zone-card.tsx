"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, AlertTriangle, Loader2 } from "lucide-react";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

export function DangerZoneCard() {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function deactivate(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/security/deactivate", { currentPassword: password });
      router.push("/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to deactivate account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/40 bg-danger-soft/10 shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-danger-soft text-danger">
            <AlertOctagon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-danger">Danger Zone</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Deactivating your account immediately revokes access and signs you out of all sessions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!confirming ? (
          <div>
            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
              If you deactivate your account, your access will be suspended and all active sessions will be terminated immediately.
            </p>
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirming(true)}
              className="touch-target font-medium"
            >
              Deactivate Account
            </Button>
          </div>
        ) : (
          <form onSubmit={deactivate} className="flex max-w-sm flex-col gap-3.5 animate-fade-in">
            <div className="rounded-xl border border-danger/30 bg-danger-soft/20 p-3.5 text-xs text-danger">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  Please enter your password to confirm account deactivation. This action cannot be undone automatically.
                </span>
              </div>
            </div>

            <PasswordField
              label="Confirm Current Password"
              id="deactivate-password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3 text-xs font-medium text-danger animate-fade-in"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                  setPassword("");
                  setError(null);
                }}
                className="touch-target"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={busy || !password}
                className="touch-target gap-1.5 font-medium"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Deactivating...</span>
                  </>
                ) : (
                  <span>Confirm Deactivation</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
