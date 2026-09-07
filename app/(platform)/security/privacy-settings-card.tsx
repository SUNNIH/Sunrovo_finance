"use client";

import * as React from "react";
import { Fingerprint } from "lucide-react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { deleteJson, postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface PrivacySettingsCardProps {
  initialPhrase: string | null;
  initialAllowlistEnabled: boolean;
}

export function PrivacySettingsCard({ initialPhrase, initialAllowlistEnabled }: PrivacySettingsCardProps) {
  const [phrase, setPhrase] = React.useState(initialPhrase ?? "");
  const [savedPhrase, setSavedPhrase] = React.useState(initialPhrase);
  const [allowlistEnabled, setAllowlistEnabled] = React.useState(initialAllowlistEnabled);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [entries, setEntries] = React.useState<Array<{ id: string; destination: string; assetSymbol: string | null; network: string | null; label: string | null }>>([]);
  const [destination, setDestination] = React.useState("");
  const [assetSymbol, setAssetSymbol] = React.useState("");
  const [network, setNetwork] = React.useState("");

  const loadEntries = React.useCallback(async () => {
    try {
      const response = await fetch("/api/security/withdrawal-allowlist");
      const payload = await response.json();
      if (response.ok) setEntries(payload.data?.entries ?? []);
    } catch { /* the primary security controls remain usable */ }
  }, []);

  React.useEffect(() => { void loadEntries(); }, [loadEntries]);

  async function savePhrase(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await postJson("/api/security/anti-phishing-phrase", { phrase });
      setSavedPhrase(phrase);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAllowlist() {
    const next = !allowlistEnabled;
    setAllowlistEnabled(next);
    try {
      await postJson("/api/security/withdrawal-allowlist", { enabled: next });
    } catch {
      setAllowlistEnabled(!next);
    }
  }

  async function addEntry(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await postJson("/api/security/withdrawal-allowlist/entries", { destination, assetSymbol: assetSymbol || undefined, network: network || undefined });
      setDestination(""); setAssetSymbol(""); setNetwork("");
      await loadEntries();
    } catch (err) { setError(err instanceof ApiRequestError ? err.message : "Could not add allowlist entry."); }
  }

  async function removeEntry(id: string) {
    try { await deleteJson(`/api/security/withdrawal-allowlist/entries/${id}`); await loadEntries(); }
    catch (err) { setError(err instanceof ApiRequestError ? err.message : "Could not remove allowlist entry."); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4" /> Anti-phishing &amp; withdrawal protection
        </CardTitle>
        <CardDescription>
          Your anti-phishing phrase appears on genuine PLT emails so you can spot fakes.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={savePhrase} className="flex max-w-sm items-end gap-2">
          <TextField
            label="Anti-phishing phrase"
            id="anti-phishing-phrase"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder={savedPhrase ?? "e.g. Blue Lighthouse"}
          />
          <Button type="submit" variant="outline" disabled={saving || !phrase}>
            Save
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div>
            <p className="text-sm font-medium text-text-primary">Withdrawal address allowlist</p>
            <p className="text-body-sm text-text-secondary">
              When enabled, withdrawals are restricted to pre-approved destinations.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={allowlistEnabled}
            onClick={toggleAllowlist}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${allowlistEnabled ? "bg-primary" : "bg-border-strong"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${allowlistEnabled ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
        <form onSubmit={addEntry} className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-sm font-medium text-text-primary">Approved withdrawal destinations</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={destination} onChange={(e) => setDestination(e.target.value)} required minLength={4} placeholder="Destination" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <input value={assetSymbol} onChange={(e) => setAssetSymbol(e.target.value.toUpperCase())} placeholder="Asset (optional)" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
            <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Network (optional)" className="rounded-md border border-border bg-surface px-3 py-2 text-sm" />
          </div>
          <div><Button type="submit" variant="outline">Add destination</Button></div>
          {entries.length === 0 ? <p className="text-body-sm text-text-secondary">No destinations approved yet.</p> : <ul className="flex flex-col gap-1">{entries.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-2 text-sm"><span className="break-all text-text-secondary">{entry.destination} {entry.assetSymbol ? `· ${entry.assetSymbol}` : ""} {entry.network ? `· ${entry.network}` : ""}</span><Button size="sm" variant="ghost" onClick={() => removeEntry(entry.id)}>Remove</Button></li>)}</ul>}
        </form>
      </CardContent>
    </Card>
  );
}
