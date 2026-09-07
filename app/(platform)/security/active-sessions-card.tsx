"use client";

import * as React from "react";
import { Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteJson, postJson } from "@/lib/utilities/api-client";

interface SessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export function ActiveSessionsCard({ initialSessions }: { initialSessions: SessionView[] }) {
  const [sessions, setSessions] = React.useState(initialSessions);

  async function revoke(id: string) {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    await deleteJson(`/api/security/sessions/${id}`).catch(() => undefined);
  }

  async function revokeOthers() {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
    await postJson("/api/security/sessions/revoke-others", {}).catch(() => undefined);
  }

  const hasOthers = sessions.some((s) => !s.isCurrent);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Active sessions</CardTitle>
          <CardDescription>Everywhere you&rsquo;re currently signed in.</CardDescription>
        </div>
        {hasOthers && (
          <Button size="sm" variant="outline" onClick={revokeOthers}>
            Sign out other sessions
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col divide-y divide-border">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                <div>
                  <p className="flex items-center gap-2 text-sm text-text-primary">
                    {session.userAgent?.slice(0, 50) ?? "Unknown device"}
                    {session.isCurrent && <Badge variant="success">This device</Badge>}
                  </p>
                  <p className="text-body-sm text-text-secondary">
                    {session.ipAddress ?? "Unknown IP"} · {new Date(session.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <Button size="sm" variant="outline" onClick={() => revoke(session.id)}>
                  Sign out
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
