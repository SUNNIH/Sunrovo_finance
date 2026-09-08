import * as React from "react";
import { CheckCircle2, History, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface LoginEventView {
  id: string;
  success: boolean;
  ipAddress: string | null;
  riskFlag: string | null;
  createdAt: string;
}

export function LoginHistoryCard({ events }: { events: LoginEventView[] }) {
  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Login History</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Recent authentication events recorded for your account.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {events.length === 0 ? (
          <p className="text-xs text-text-secondary">No recent login events recorded.</p>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden bg-surface">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between p-3.5 text-xs transition-colors hover:bg-surface-hover/50"
              >
                <div>
                  <p className="font-semibold text-text-primary">
                    {event.ipAddress ? `IP: ${event.ipAddress}` : "Authentication Attempt"}
                  </p>
                  <p className="text-[11px] text-text-tertiary mt-0.5">
                    {new Date(event.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Risk flag displayed ONLY when provided by backend data */}
                  {event.riskFlag && (
                    <Badge variant="warning" className="text-[10px] uppercase font-medium">
                      {event.riskFlag.replace(/_/g, " ")}
                    </Badge>
                  )}

                  {/* Status indicated with both icon and text, never color alone */}
                  {event.success ? (
                    <Badge variant="success" className="flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      <span>Success</span>
                    </Badge>
                  ) : (
                    <Badge variant="danger" className="flex items-center gap-1 text-[11px]">
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                      <span>Failed</span>
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
