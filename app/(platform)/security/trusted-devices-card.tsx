"use client";

import * as React from "react";
import { Laptop } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteJson } from "@/lib/utilities/api-client";

interface DeviceView {
  id: string;
  deviceName: string | null;
  lastSeenAt: string;
}

export function TrustedDevicesCard({ initialDevices }: { initialDevices: DeviceView[] }) {
  const [devices, setDevices] = React.useState(initialDevices);

  async function revoke(id: string) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    await deleteJson(`/api/security/devices/${id}`).catch(() => undefined);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trusted devices</CardTitle>
        <CardDescription>Devices that skip two-factor verification at sign-in.</CardDescription>
      </CardHeader>
      <CardContent>
        {devices.length === 0 ? (
          <p className="text-sm text-text-secondary">No trusted devices yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {devices.map((device) => (
              <div key={device.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Laptop className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-text-primary">{device.deviceName ?? "Unknown device"}</p>
                    <p className="text-body-sm text-text-secondary">
                      Last seen {new Date(device.lastSeenAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => revoke(device.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
