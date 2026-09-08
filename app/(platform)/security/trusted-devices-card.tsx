"use client";

import * as React from "react";
import { Laptop, Loader2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteJson, ApiRequestError } from "@/lib/utilities/api-client";

interface DeviceView {
  id: string;
  deviceName: string | null;
  lastSeenAt: string;
}

export function TrustedDevicesCard({ initialDevices }: { initialDevices: DeviceView[] }) {
  const [devices, setDevices] = React.useState(initialDevices);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function revoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      await deleteJson(`/api/security/devices/${id}`);
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to revoke trusted device.");
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Laptop className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Trusted Devices</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Devices remembered during sign-in that skip two-factor verification challenges.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <p className="text-xs text-text-secondary">No trusted devices currently registered.</p>
            <p className="text-[11px] text-text-tertiary mt-1">
              Select &ldquo;Remember this device&rdquo; during sign-in to register a trusted device.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors hover:bg-surface-hover/50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-text-secondary">
                    <Laptop className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary truncate max-w-xs sm:max-w-md">
                      {device.deviceName || "Registered Device"}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      Last active: {new Date(device.lastSeenAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-1 sm:pt-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={revokingId === device.id}
                    onClick={() => revoke(device.id)}
                    className="touch-target text-xs text-danger hover:text-danger hover:border-danger/40 gap-1"
                  >
                    {revokingId === device.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    <span>Revoke</span>
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
