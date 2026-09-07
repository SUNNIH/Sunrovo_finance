"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon } from "lucide-react";
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
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <Card className="border-danger/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-danger">
          <AlertOctagon className="h-4 w-4" /> Danger zone
        </CardTitle>
        <CardDescription>Deactivating your account signs you out everywhere immediately.</CardDescription>
      </CardHeader>
      <CardContent>
        {!confirming ? (
          <Button variant="danger" onClick={() => setConfirming(true)}>
            Deactivate account
          </Button>
        ) : (
          <form onSubmit={deactivate} className="flex max-w-sm flex-col gap-3">
            <PasswordField
              label="Confirm your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-body-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="danger" disabled={busy || !password}>
                {busy ? "Deactivating..." : "Confirm deactivation"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
