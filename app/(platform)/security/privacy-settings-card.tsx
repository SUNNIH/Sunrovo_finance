"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, Loader2 } from "lucide-react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface PrivacySettingsCardProps {
  initialPhrase: string | null;
  initialAllowlistEnabled?: boolean;
}

export function PrivacySettingsCard({ initialPhrase }: PrivacySettingsCardProps) {
  const [phrase, setPhrase] = React.useState(initialPhrase ?? "");
  const [savedPhrase, setSavedPhrase] = React.useState(initialPhrase);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function savePhrase(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      await postJson("/api/security/anti-phishing-phrase", { phrase: phrase.trim() });
      setSavedPhrase(phrase.trim());
      setSuccess("Anti-phishing code phrase updated successfully.");
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to save anti-phishing phrase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Fingerprint className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Anti-Phishing Protection</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Configure a personal verification phrase for your account security profile.
            </CardDescription>
          </div>
        </div>
        <div className="shrink-0">
          <Badge
            variant={savedPhrase ? "success" : "neutral"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
          >
            {savedPhrase ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <span>Configured</span>
              </>
            ) : (
              <span>Not Set</span>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {success && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft/30 p-3.5 text-xs font-medium text-success animate-fade-in"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={savePhrase} className="flex flex-col gap-3 max-w-sm">
          <TextField
            label="Personal Anti-Phishing Phrase"
            id="anti-phishing-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={savedPhrase ?? "e.g. Blue Lighthouse 42"}
            maxLength={40}
          />
          <p className="text-[11px] text-text-tertiary">
            Use 3 to 40 characters that only you know.
          </p>

          <Button
            type="submit"
            disabled={saving || !phrase.trim() || phrase.trim() === savedPhrase}
            className="touch-target mt-1 w-fit gap-2 font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Phrase</span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
