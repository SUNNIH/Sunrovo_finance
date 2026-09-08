"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LogOut,
  Monitor,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { deleteJson, postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface SessionView {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  isCurrent: boolean;
}

export function ActiveSessionsCard({ initialSessions }: { initialSessions: SessionView[] }) {
  const [sessions, setSessions] = React.useState(initialSessions);
  const [revokingId, setRevokingId] = React.useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = React.useState(false);
  const [confirmRevokeOthers, setConfirmRevokeOthers] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function revoke(id: string) {
    setRevokingId(id);
    setError(null);
    try {
      await deleteJson(`/api/security/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to sign out session.");
    } finally {
      setRevokingId(null);
    }
  }

  async function revokeOthers() {
    setRevokingOthers(true);
    setError(null);
    try {
      await postJson("/api/security/sessions/revoke-others", {});
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setConfirmRevokeOthers(false);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Failed to sign out other sessions.");
    } finally {
      setRevokingOthers(false);
    }
  }

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Monitor className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Active Sessions</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Current browser and device sessions authenticated with your account credentials.
            </CardDescription>
          </div>
        </div>

        {otherSessions.length > 0 && !confirmRevokeOthers && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirmRevokeOthers(true)}
            className="touch-target gap-1.5 text-xs text-danger hover:text-danger hover:border-danger/40"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out Other Sessions ({otherSessions.length})</span>
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Confirmation prompt for signing out all other sessions */}
        {confirmRevokeOthers && (
          <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-soft/20 p-4 animate-fade-in">
            <div className="flex items-start gap-2 text-xs font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Are you sure you want to sign out all {otherSessions.length} other active session(s)? You will remain signed in on this device.
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={revokingOthers}
                onClick={() => setConfirmRevokeOthers(false)}
                className="touch-target"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={revokingOthers}
                onClick={revokeOthers}
                className="touch-target gap-1.5 font-medium"
              >
                {revokingOthers ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Signing out...</span>
                  </>
                ) : (
                  <span>Sign Out Others</span>
                )}
              </Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs transition-colors hover:bg-surface-hover/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-hover text-text-secondary">
                  <Monitor className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-text-primary truncate max-w-xs sm:max-w-md">
                      {session.userAgent || "Active Browser Session"}
                    </p>
                    {/* Authoritative backend flag only: session.isCurrent */}
                    {session.isCurrent && (
                      <Badge variant="success" className="flex items-center gap-1 text-[10px] px-1.5 py-0.5">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        <span>Current Session</span>
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    {session.ipAddress ? `IP: ${session.ipAddress} · ` : ""}
                    Signed in: {new Date(session.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              </div>

              {!session.isCurrent && (
                <div className="shrink-0 pt-1 sm:pt-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={revokingId === session.id}
                    onClick={() => revoke(session.id)}
                    className="touch-target text-xs text-text-secondary hover:text-danger hover:border-danger/40 gap-1"
                  >
                    {revokingId === session.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <LogOut className="h-3 w-3" />
                    )}
                    <span>Sign Out</span>
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
