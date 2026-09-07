import { History } from "lucide-react";
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-4 w-4" /> Login history
        </CardTitle>
        <CardDescription>Recent sign-in attempts on your account.</CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-text-secondary">No login history yet.</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <p className="text-text-primary">{event.ipAddress ?? "Unknown IP"}</p>
                  <p className="text-body-sm text-text-secondary">{new Date(event.createdAt).toLocaleString()}</p>
                </div>
                <div className="flex gap-1.5">
                  {event.riskFlag && <Badge variant="warning">{event.riskFlag.replace(/_/g, " ")}</Badge>}
                  <Badge variant={event.success ? "success" : "danger"}>{event.success ? "Success" : "Failed"}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
