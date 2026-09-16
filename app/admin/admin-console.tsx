"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { patchJson, postJson, putJson, ApiRequestError } from "@/lib/utilities/api-client";
import { FundingInterface } from "./funding-interface";
import { IncomingDepositsReview } from "./incoming-deposits-review";

type Withdrawal = { id: string; assetSymbol: string; amount: string; feeAmount: string; destination: string; createdAt: string; user: { email: string; profile: { fullName: string } | null } };
type Announcement = { id: string; title: string; body: string; isActive: boolean; publishedAt: string };
type Provider = { id: string; provider: string; status: string; lastHealthCheckAt: string | null };
type Log = { id: string; action: string; targetType: string; targetId: string; createdAt: string; actorUser: { email: string } | null };

export function AdminConsole() {
  const [withdrawals, setWithdrawals] = React.useState<Withdrawal[]>([]);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [providers, setProviders] = React.useState<Provider[]>([]);
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [maintenance, setMaintenance] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [togglingAnnouncement, setTogglingAnnouncement] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [w, a, p, m, l] = await Promise.all([
        fetch("/api/admin/withdrawals").then((r) => r.json()), fetch("/api/admin/announcements").then((r) => r.json()),
        fetch("/api/admin/providers").then((r) => r.json()), fetch("/api/admin/maintenance").then((r) => r.json()),
        fetch("/api/admin/audit-logs?limit=20").then((r) => r.json()),
      ]);
      setWithdrawals(w.data?.withdrawals ?? []); setAnnouncements(a.data?.announcements ?? []); setProviders(p.data?.providers ?? []);
      setMaintenance(Boolean(m.data?.settings?.maintenanceMode)); setMessage(m.data?.settings?.maintenanceMessage ?? ""); setLogs(l.data?.logs ?? []);
    } catch { setError("Could not load administration data."); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  async function review(id: string, decision: "APPROVE" | "REJECT") {
    const rejectionReason = decision === "REJECT" ? window.prompt("Reason for rejection (shown to customer):") ?? "" : undefined;
    if (decision === "REJECT" && !rejectionReason?.trim()) return;
    try { await patchJson("/api/admin/withdrawals", { withdrawalId: id, decision, rejectionReason }); await load(); }
    catch (e) { setError(e instanceof ApiRequestError ? e.message : "Review failed."); }
  }
  async function publish(event: React.FormEvent) {
    event.preventDefault();
    try { await postJson("/api/admin/announcements", { title, body }); setTitle(""); setBody(""); await load(); }
    catch (e) { setError(e instanceof ApiRequestError ? e.message : "Could not publish announcement."); }
  }
  async function toggleAnnouncementVisibility(id: string, currentIsActive: boolean) {
    setTogglingAnnouncement(id);
    try {
      await patchJson("/api/admin/announcements", { id, isActive: !currentIsActive });
      await load();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Could not update announcement visibility.");
    } finally {
      setTogglingAnnouncement(null);
    }
  }
  async function toggleMaintenance() { try { await putJson("/api/admin/maintenance", { enabled: !maintenance, message }); await load(); } catch (e) { setError(e instanceof ApiRequestError ? e.message : "Could not update maintenance mode."); } }

  return <div className="flex flex-col gap-6">
    <div className="flex items-center justify-between"><div><h1 className="text-page-title">Administration</h1><p className="text-text-secondary">Controlled operational tools. Every action is audited.</p></div><Link href="/dashboard"><Button variant="outline">Back to app</Button></Link></div>
    {error && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{error}</p>}
    <FundingInterface />
    <IncomingDepositsReview />
    <Card><CardHeader><CardTitle>Pending withdrawal review ({withdrawals.length})</CardTitle></CardHeader><CardContent className="flex flex-col gap-3">{withdrawals.length === 0 ? <p className="text-sm text-text-secondary">No withdrawals need review.</p> : withdrawals.map((w) => <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"><div><p className="font-medium">{w.amount} {w.assetSymbol} <span className="text-text-secondary">(+ {w.feeAmount} fee)</span></p><p className="text-sm text-text-secondary">{w.user.profile?.fullName ?? w.user.email} · {w.destination}</p></div><div className="flex gap-2"><Button size="sm" onClick={() => review(w.id, "APPROVE")}>Approve</Button><Button size="sm" variant="danger" onClick={() => review(w.id, "REJECT")}>Reject</Button></div></div>)}</CardContent></Card>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Announcements</CardTitle></CardHeader><CardContent><form onSubmit={publish} className="flex flex-col gap-3"><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="rounded-md border border-border bg-surface p-2" required /><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Customer-facing message" className="min-h-24 rounded-md border border-border bg-surface p-2" required /><Button type="submit">Publish announcement</Button></form><div className="mt-4 flex flex-col gap-2">{announcements.map((a) => <div key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface p-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{a.title}</p><p className="text-xs text-text-secondary">{a.isActive ? "Live" : "Hidden"}</p></div><Button size="sm" variant="outline" onClick={() => toggleAnnouncementVisibility(a.id, a.isActive)} disabled={togglingAnnouncement === a.id}>{togglingAnnouncement === a.id ? "..." : a.isActive ? "Hide" : "Show"}</Button></div>)}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Maintenance & provider health</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><label className="text-sm">Maintenance message<input value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-surface p-2" placeholder="Optional customer message" /></label><Button variant={maintenance ? "danger" : "outline"} onClick={toggleMaintenance}>{maintenance ? "Disable maintenance mode" : "Enable maintenance mode"}</Button><div className="border-t border-border pt-4"><p className="mb-2 font-medium">External Providers</p>{providers.length === 0 ? <p className="text-sm text-text-secondary">No external provider connections configured.</p> : providers.map((p) => <p key={p.id} className="text-sm text-text-secondary">{p.provider}: {p.status} {p.lastHealthCheckAt ? `· ${new Date(p.lastHealthCheckAt).toLocaleString()}` : ""}</p>)}</div></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Recent audit activity</CardTitle></CardHeader><CardContent className="flex flex-col gap-2">{logs.map((log) => <p key={log.id} className="text-sm"><span className="font-medium">{log.action}</span> <span className="text-text-secondary">by {log.actorUser?.email ?? "system"} · {new Date(log.createdAt).toLocaleString()}</span></p>)}</CardContent></Card>
  </div>;
}
