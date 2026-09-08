"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  ListPlus,
  Loader2,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deleteJson, postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { cn } from "@/lib/utilities/cn";

export interface AllowlistEntry {
  id: string;
  destination: string;
  assetSymbol: string | null;
  network: string | null;
  label: string | null;
}

interface WithdrawalAllowlistCardProps {
  initialEnabled: boolean;
}

export function WithdrawalAllowlistCard({ initialEnabled }: WithdrawalAllowlistCardProps) {
  const [enabled, setEnabled] = React.useState(initialEnabled);
  const [toggling, setToggling] = React.useState(false);
  const [entries, setEntries] = React.useState<AllowlistEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);

  // Form inputs
  const [destination, setDestination] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [assetSymbol, setAssetSymbol] = React.useState("");
  const [network, setNetwork] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const loadEntries = React.useCallback(async () => {
    try {
      const response = await fetch("/api/security/withdrawal-allowlist");
      const payload = await response.json();
      if (response.ok) {
        setEntries(payload.data?.entries ?? []);
      }
    } catch {
      // Primary controls remain functional
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  React.useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setToggling(true);
    try {
      await postJson("/api/security/withdrawal-allowlist", { enabled: next });
    } catch {
      setEnabled(!next);
    } finally {
      setToggling(false);
    }
  }

  async function handleAddEntry(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await postJson("/api/security/withdrawal-allowlist/entries", {
        destination: destination.trim(),
        label: label.trim() || undefined,
        assetSymbol: assetSymbol.trim().toUpperCase() || undefined,
        network: network.trim() || undefined,
      });
      setDestination("");
      setLabel("");
      setAssetSymbol("");
      setNetwork("");
      setShowAddForm(false);
      await loadEntries();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Failed to add destination to allowlist.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveEntry(id: string) {
    setDeletingId(id);
    try {
      await deleteJson(`/api/security/withdrawal-allowlist/entries/${id}`);
      await loadEntries();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.message : "Failed to remove allowlist entry.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCopy(text: string, id: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <ListPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Withdrawal Address Allowlist</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              When active, withdrawals can only be processed to approved destinations on this list.
            </CardDescription>
          </div>
        </div>
        <div className="shrink-0">
          <Badge
            variant={enabled ? "success" : "neutral"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
          >
            {enabled ? (
              <>
                <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <span>Active</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-3.5 w-3.5 text-text-tertiary" aria-hidden="true" />
                <span>Disabled</span>
              </>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* Toggle Switch Bar */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-surface-elevated p-4">
          <div className="pr-4">
            <p className="text-sm font-semibold text-text-primary">Enforce Allowlist Restriction</p>
            <p className="text-xs text-text-secondary mt-0.5">
              {enabled
                ? "Withdrawals to destinations not on this list will be rejected by backend security policy."
                : "Allowlist restriction is currently off. Withdrawals may proceed to any valid destination format."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Enforce withdrawal allowlist restriction"
            onClick={handleToggle}
            disabled={toggling}
            className={cn(
              "touch-target relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              enabled ? "bg-primary" : "bg-border-strong"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
                enabled ? "translate-x-5" : "translate-x-0"
              )}
            />
          </button>
        </div>

        {formError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{formError}</span>
          </div>
        )}

        {/* Section Header & Add Button */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Approved Destinations ({entries.length})
          </p>
          {!showAddForm && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowAddForm(true)}
              className="touch-target gap-1.5 text-xs font-medium"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Destination</span>
            </Button>
          )}
        </div>

        {/* Add Entry Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddEntry}
            className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-4 sm:p-5 animate-fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Add Approved Destination</span>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
                className="text-xs text-text-tertiary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>

            <TextField
              id="allowlist-destination"
              label="Destination Address or Account"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="e.g. bc1q... or Chase •••• 1234"
              required
              className="font-mono text-xs"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TextField
                id="allowlist-label"
                label="Label (Optional)"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Hardware Wallet"
              />
              <TextField
                id="allowlist-asset"
                label="Asset Symbol (Optional)"
                value={assetSymbol}
                onChange={(e) => setAssetSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. BTC, USD"
              />
              <TextField
                id="allowlist-network"
                label="Network (Optional)"
                value={network}
                onChange={(e) => setNetwork(e.target.value)}
                placeholder="e.g. Bitcoin"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddForm(false);
                  setFormError(null);
                }}
                className="touch-target"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting || destination.trim().length < 4}
                className="touch-target gap-1.5 font-medium"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Save to Allowlist</span>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Entries List */}
        {loadingEntries ? (
          <p className="text-xs text-text-tertiary">Loading approved destinations...</p>
        ) : entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-xs text-text-secondary">No approved withdrawal destinations configured.</p>
            <p className="text-[11px] text-text-tertiary mt-1">
              Add verified addresses or bank accounts to safely restrict withdrawals.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors hover:bg-surface-hover/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {entry.label && (
                      <span className="font-semibold text-text-primary">{entry.label}</span>
                    )}
                    {entry.assetSymbol && (
                      <Badge variant="neutral" className="text-[10px] uppercase">
                        {entry.assetSymbol}
                      </Badge>
                    )}
                    {entry.network && (
                      <span className="text-[11px] text-text-tertiary">({entry.network})</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="font-mono text-xs text-text-secondary break-all financial-value">
                      {entry.destination}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(entry.destination, entry.id)}
                      className="touch-target inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                      title={copiedId === entry.id ? "Copied" : "Copy Destination"}
                      aria-label={copiedId === entry.id ? "Copied Destination" : "Copy Destination"}
                    >
                      {copiedId === entry.id ? (
                        <Check className="h-3 w-3 text-success" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="shrink-0 pt-1 sm:pt-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deletingId === entry.id}
                    onClick={() => handleRemoveEntry(entry.id)}
                    className="touch-target text-xs text-danger hover:text-danger hover:border-danger/40 gap-1"
                  >
                    {deletingId === entry.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    <span>Remove</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
