"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { isFiatAsset } from "@/lib/money/asset-kind";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";

interface WithdrawClientProps {
  fiatAssets: string[];
  cryptoAssets: string[];
}

export function WithdrawClient({ fiatAssets, cryptoAssets }: WithdrawClientProps) {
  const allAssets = [...fiatAssets, ...cryptoAssets];
  const [assetSymbol, setAssetSymbol] = React.useState(allAssets[0] ?? "");
  const [amount, setAmount] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [network, setNetwork] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ status: string; amount: string; assetSymbol: string } | null>(null);

  const fiat = isFiatAsset(assetSymbol);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await postJsonIdempotent<{ withdrawal: { status: string; amount: string; assetSymbol: string } }>(
        "/api/withdrawals",
        { assetSymbol, amount, destination, network: fiat ? undefined : network || undefined, transactionPin: pin },
        generateClientId()
      );
      setResult(response.withdrawal);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (allAssets.length === 0) {
    return <p className="text-sm text-text-secondary">No funded accounts or wallets to withdraw from yet.</p>;
  }

  if (result) {
    const pending = result.status === "PENDING";
    return (
      <Card className="max-w-md">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          {pending ? (
            <Clock className="h-10 w-10 text-warning" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
          )}
          <h2 className="text-section-title text-text-primary">
            {pending ? "Withdrawal pending review" : "Withdrawal complete"}
          </h2>
          <p className="text-sm text-text-secondary">
            {result.amount} {result.assetSymbol} —{" "}
            {pending
              ? "this amount exceeds the instant-approval limit and will be reviewed."
              : "processed instantly in this demo environment."}
          </p>
          <Badge variant="warning">Demo — no real funds were transferred</Badge>
          <Link href="/wallets">
            <Button variant="outline">Back to wallets</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-md">
      <CardContent className="p-5">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="withdraw-asset" className="text-sm font-medium text-text-primary">
              Asset
            </label>
            <select
              id="withdraw-asset"
              value={assetSymbol}
              onChange={(e) => setAssetSymbol(e.target.value)}
              className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
            >
              {allAssets.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <TextField
            label="Amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="financial-value"
          />

          <TextField
            label={fiat ? "Destination bank account" : "Destination address"}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={fiat ? "e.g. Chase •••• 1234" : "e.g. bc1q..."}
          />

          {!fiat && (
            <TextField
              label="Network (optional)"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              placeholder="e.g. Bitcoin, Ethereum (ERC-20)"
            />
          )}

          <TextField
            label="Transaction PIN"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="max-w-[160px] financial-value"
          />

          <p className="flex items-start gap-2 text-body-sm text-text-tertiary">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            A 0.5% demo fee applies. Withdrawals above the instant-approval limit are held for review.
          </p>

          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={busy || !amount || !destination || pin.length < 4}>
            {busy ? "Submitting..." : "Withdraw"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
