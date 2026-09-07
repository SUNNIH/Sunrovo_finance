"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TransactionPinCardProps {
  initialPinSet: boolean;
}

export function TransactionPinCard({ initialPinSet }: TransactionPinCardProps) {
  const [pinSet, setPinSet] = React.useState(initialPinSet);
  const [editing, setEditing] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [confirmPin, setConfirmPin] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/security/transaction-pin", { pin, confirmPin, currentPassword });
      setPinSet(true);
      setEditing(false);
      setPin("");
      setConfirmPin("");
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
          <CardTitle>Transaction PIN</CardTitle>
          <CardDescription>Required to confirm transfers and other sensitive actions.</CardDescription>
        </div>
        <Badge variant={pinSet ? "success" : "neutral"}>{pinSet ? "Set" : "Not set"}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        {!editing && (
          <Button onClick={() => setEditing(true)} className="w-fit">
            <KeyRound className="h-4 w-4" /> {pinSet ? "Change PIN" : "Set a transaction PIN"}
          </Button>
        )}

        {editing && (
          <form onSubmit={onSubmit} className="flex max-w-xs flex-col gap-3">
            <TextField
              id="new-pin"
              label="New PIN (4-6 digits)"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
            <TextField
              id="confirm-pin"
              label="Confirm PIN"
              inputMode="numeric"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
            />
            <PasswordField
              id="pin-current-password"
              label="Current password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save PIN"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
