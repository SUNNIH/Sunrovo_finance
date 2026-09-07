"use client";

import * as React from "react";
import { Copy, QrCode } from "lucide-react";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";

interface AccountView {
  id: string;
  nickname: string | null;
  type: string;
  currencySymbol: string;
}

const CRYPTO_ASSETS = ["USDT", ...SUPPORTED_PAIRS.map((p) => p.baseAsset)];

export function DepositClient({ accounts }: { accounts: AccountView[] }) {
  const [tab, setTab] = React.useState<"fiat" | "crypto">("fiat");

  return (
    <div className="max-w-md">
      <div className="mb-4 flex gap-1 rounded-md border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setTab("fiat")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${tab === "fiat" ? "bg-primary text-primary-foreground" : "text-text-secondary"}`}
        >
          Fiat
        </button>
        <button
          type="button"
          onClick={() => setTab("crypto")}
          className={`flex-1 rounded px-3 py-1.5 text-sm font-medium ${tab === "crypto" ? "bg-primary text-primary-foreground" : "text-text-secondary"}`}
        >
          Crypto
        </button>
      </div>

      {tab === "fiat" ? <FiatDeposit accounts={accounts} /> : <CryptoDeposit />}
    </div>
  );
}

function FiatDeposit({ accounts }: { accounts: AccountView[] }) {
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await postJsonIdempotent("/api/deposits/fiat", { accountId, amount }, generateClientId());
      setSuccess(`Deposited ${amount} successfully.`);
      setAmount("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (accounts.length === 0) {
    return <p className="text-sm text-text-secondary">No accounts available.</p>;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <Badge variant="warning" className="w-fit">
          Demo Environment — simulated funding action
        </Badge>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deposit-account" className="text-sm font-medium text-text-primary">
            Account
          </label>
          <select
            id="deposit-account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nickname ?? BANK_ACCOUNT_TYPE_LABELS[a.type]} ({a.currencySymbol})
              </option>
            ))}
          </select>
        </div>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextField
            label="Amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="financial-value"
          />
          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}
          {success && <p className="text-body-sm text-success">{success}</p>}
          <Button type="submit" size="lg" disabled={busy || !amount}>
            {busy ? "Depositing..." : "Deposit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function CryptoDeposit() {
  const [asset, setAsset] = React.useState("USDT");
  const [address, setAddress] = React.useState<{ address: string; network: string } | null>(null);
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setAddress(null);
    fetch(`/api/deposits/crypto?asset=${asset}`)
      .then((r) => r.json())
      .then((payload) => setAddress(payload.data))
      .catch(() => undefined);
  }, [asset]);

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address.address).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function simulateDeposit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await postJsonIdempotent("/api/deposits/crypto", { assetSymbol: asset, amount }, generateClientId());
      setSuccess(`Simulated deposit of ${amount} ${asset} received.`);
      setAmount("");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <Badge variant="warning" className="w-fit">
          Demo Environment — non-production address
        </Badge>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deposit-asset" className="text-sm font-medium text-text-primary">
            Asset
          </label>
          <select
            id="deposit-asset"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary"
          >
            {CRYPTO_ASSETS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {address && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-border p-4 text-center">
            <div className="flex h-32 w-32 items-center justify-center rounded-md border border-dashed border-border-strong text-text-tertiary">
              <QrCode className="h-16 w-16" aria-hidden="true" />
            </div>
            <p className="break-all font-mono text-xs text-text-secondary financial-value">{address.address}</p>
            <Button type="button" variant="outline" size="sm" onClick={copyAddress}>
              <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy address"}
            </Button>
            <p className="text-body-sm text-text-tertiary">
              Network: {address.network}. Test address only — do not send real funds.
            </p>
          </div>
        )}

        <form onSubmit={simulateDeposit} className="flex flex-col gap-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-text-primary">Simulate an incoming deposit</p>
          <TextField
            label={`Amount (${asset})`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="financial-value"
          />
          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}
          {success && <p className="text-body-sm text-success">{success}</p>}
          <Button type="submit" disabled={busy || !amount}>
            {busy ? "Simulating..." : "Simulate deposit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
