"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  History,
  Landmark,
  Loader2,
  QrCode,
  RotateCcw,
  Wallet,
} from "lucide-react";
import Decimal from "decimal.js";
import { SUPPORTED_PAIRS } from "@/lib/bybit/instruments";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CryptoAssetIcon, getCryptoAssetMeta } from "@/components/financial/crypto-asset-icon";
import { TransactionStatusBadge } from "@/components/financial/transaction-status-badge";
import { CurrencyValue } from "@/components/financial/currency-value";
import { postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { accountDisplayName } from "@/lib/utilities/format-account";
import { formatMoney } from "@/lib/money/format";
import { cn } from "@/lib/utilities/cn";

export interface AccountView {
  id: string;
  nickname: string | null;
  type: string;
  currencySymbol: string;
  accountNumber?: string;
  balanceCache?: string;
}

const CRYPTO_ASSETS = ["USDT", ...SUPPORTED_PAIRS.map((p) => p.baseAsset)];

const FIAT_PRESETS = ["500", "1000", "5000", "10000"];

const CRYPTO_PRESETS: Record<string, string[]> = {
  USDT: ["100", "500", "1000", "5000"],
  BTC: ["0.01", "0.05", "0.1", "0.5"],
  ETH: ["0.1", "0.5", "1.0", "2.5"],
  SOL: ["1", "5", "10", "25"],
  XRP: ["100", "500", "1000", "2500"],
  PLT: ["500", "1000", "5000", "10000"],
};

function isValidAmount(val: string): boolean {
  try {
    return new Decimal(val).gt(0);
  } catch {
    return false;
  }
}

interface DepositReceiptData {
  id: string;
  amount: string;
  assetSymbol: string;
  status: string;
  createdAt: string;
  destinationLabel: string;
  destinationDetail?: string;
  network?: string;
}

export function DepositClient({ accounts }: { accounts: AccountView[] }) {
  const [tab, setTab] = React.useState<"fiat" | "crypto">("fiat");

  return (
    <div className="w-full max-w-xl">
      {/* ── Segmented Tab Switcher ─────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Deposit type"
        className="mb-6 flex rounded-xl border border-border/80 bg-surface p-1.5 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          id="tab-fiat"
          aria-selected={tab === "fiat"}
          aria-controls="panel-fiat"
          onClick={() => setTab("fiat")}
          className={cn(
            "touch-target flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm transition-all cursor-pointer",
            tab === "fiat"
              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
              : "font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover"
          )}
        >
          <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Fiat Banking</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-crypto"
          aria-selected={tab === "crypto"}
          aria-controls="panel-crypto"
          onClick={() => setTab("crypto")}
          className={cn(
            "touch-target flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm transition-all cursor-pointer",
            tab === "crypto"
              ? "bg-primary font-semibold text-primary-foreground shadow-xs"
              : "font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover"
          )}
        >
          <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Crypto Spot</span>
        </button>
      </div>

      {/* ── Tab Content Panels ─────────────────────────────────────────────── */}
      <div
        id="panel-fiat"
        role="tabpanel"
        aria-labelledby="tab-fiat"
        hidden={tab !== "fiat"}
      >
        {tab === "fiat" && <FiatDeposit accounts={accounts} />}
      </div>

      <div
        id="panel-crypto"
        role="tabpanel"
        aria-labelledby="tab-crypto"
        hidden={tab !== "crypto"}
      >
        {tab === "crypto" && <CryptoDeposit />}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * FIAT DEPOSIT FLOW
 * ───────────────────────────────────────────────────────────────────────────── */
function FiatDeposit({ accounts }: { accounts: AccountView[] }) {
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [step, setStep] = React.useState<"input" | "review" | "receipt">("input");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<DepositReceiptData | null>(null);

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-10">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-surface-hover text-text-tertiary">
            <Landmark className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">No Accounts Available</h2>
          <p className="mt-1 text-sm text-text-secondary">
            You do not have any active fiat accounts to deposit funds into.
          </p>
          <Link href="/accounts" className="mt-5">
            <Button variant="outline" size="sm">
              View Accounts
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const selectedAccount = accounts.find((a) => a.id === accountId) ?? accounts[0]!;
  const selectedAccountDisplayName = accountDisplayName(
    selectedAccount.nickname,
    selectedAccount.type
  );

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setStep("review");
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      const response = await postJsonIdempotent<{
        deposit: {
          id: string;
          amount: string;
          assetSymbol: string;
          status: string;
          completedAt?: string;
          createdAt: string;
        };
      }>("/api/deposits/fiat", { accountId, amount }, generateClientId());

      const deposit = response.deposit;
      setReceipt({
        id: deposit.id,
        amount: deposit.amount.toString(),
        assetSymbol: deposit.assetSymbol,
        status: deposit.status,
        createdAt: deposit.completedAt ?? deposit.createdAt,
        destinationLabel: selectedAccountDisplayName,
        destinationDetail: selectedAccount.accountNumber
          ? `Acc: ${selectedAccount.accountNumber}`
          : undefined,
      });
      setStep("receipt");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Deposit failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setAmount("");
    setError(null);
    setReceipt(null);
    setStep("input");
  }

  // ── Receipt Step ──
  if (step === "receipt" && receipt) {
    return (
      <DepositReceiptCard
        receipt={receipt}
        onReset={handleReset}
        viewActionHref="/accounts"
        viewActionLabel="View Accounts"
      />
    );
  }

  // ── Review Step ──
  if (step === "review") {
    return (
      <Card className="rounded-2xl border-border bg-surface-elevated shadow-xs animate-fade-in">
        <CardContent className="flex flex-col gap-6 p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
                Review Fiat Deposit
              </h2>
              <p className="text-xs text-text-secondary">
                Review deposit details before crediting your account.
              </p>
            </div>
          </div>

          {/* Amount Overview */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-surface/50 p-4 text-center">
            <span className="text-label uppercase tracking-wider text-text-tertiary font-medium">
              Deposit Amount
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="financial-value text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                {formatMoney(amount, selectedAccount.currencySymbol)}
              </span>
            </div>
          </div>

          {/* Detail Breakdown */}
          <dl className="flex flex-col divide-y divide-border/60 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Destination Account</dt>
              <dd className="font-medium text-text-primary text-right">
                {selectedAccountDisplayName}
                {selectedAccount.accountNumber && (
                  <span className="block text-xs font-mono text-text-tertiary">
                    {selectedAccount.accountNumber}
                  </span>
                )}
              </dd>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Currency</dt>
              <dd className="font-semibold text-text-primary">
                {selectedAccount.currencySymbol}
              </dd>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Funding Method</dt>
              <dd className="font-medium text-text-primary">
                Account Credit
              </dd>
            </div>
          </dl>

          {/* Safety Notice */}

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setStep("input")}
              disabled={busy}
              className="flex-1 gap-1.5 font-medium"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Edit</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleConfirm}
              disabled={busy}
              className="flex-1 gap-1.5 font-medium shadow-xs"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Crediting...</span>
                </>
              ) : (
                <>
                  <span>Confirm Deposit</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Input Step ──
  return (
    <Card className="rounded-2xl border-border bg-surface-elevated shadow-xs">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-7">
        {/* Environment Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">Step 1 of 2</span>
        </div>

        <form onSubmit={handleReview} className="flex flex-col gap-5">
          {/* Account Selector */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="deposit-account"
              className="text-sm font-medium text-text-primary"
            >
              Destination Account
            </label>
            <select
              id="deposit-account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-11 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-text-primary transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {accountDisplayName(a.nickname, a.type)} ({a.currencySymbol})
                  {a.accountNumber ? ` — ${a.accountNumber}` : ""}
                </option>
              ))}
            </select>

            {/* Read-only balance hint (does not calculate client-side) */}
            {selectedAccount?.balanceCache && (
              <p className="mt-0.5 text-xs text-text-secondary">
                Current Balance:{" "}
                <CurrencyValue
                  amount={selectedAccount.balanceCache}
                  assetSymbol={selectedAccount.currencySymbol}
                  className="font-medium text-text-primary"
                />
              </p>
            )}
          </div>

          {/* Amount Input */}
          <div className="flex flex-col gap-2">
            <TextField
              label={`Amount (${selectedAccount?.currencySymbol ?? "USD"})`}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="financial-value font-mono text-base font-semibold"
            />

            {/* Quick Amount Presets (UI helpers only, string-safe) */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-text-tertiary mr-1">Quick:</span>
              {FIAT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setError(null);
                  }}
                  className="touch-target inline-flex items-center rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  +{Number(preset).toLocaleString()} {selectedAccount?.currencySymbol}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!amount.trim()}
            className="w-full font-semibold shadow-xs mt-1"
          >
            Review Deposit
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CRYPTO DEPOSIT FLOW
 * ───────────────────────────────────────────────────────────────────────────── */
function CryptoDeposit() {
  const [asset, setAsset] = React.useState("USDT");
  const [address, setAddress] = React.useState<{ address: string; network: string } | null>(null);
  const [loadingAddress, setLoadingAddress] = React.useState(true);
  const [amount, setAmount] = React.useState("");
  const [step, setStep] = React.useState<"input" | "review" | "receipt">("input");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [receipt, setReceipt] = React.useState<DepositReceiptData | null>(null);

  const copyResetRef = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (copyResetRef.current !== undefined) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    setLoadingAddress(true);
    fetch(`/api/deposits/crypto?asset=${asset}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load deposit address");
        return r.json();
      })
      .then((payload) => {
        setAddress(payload.data);
      })
      .catch(() => {
        setAddress(null);
      })
      .finally(() => {
        setLoadingAddress(false);
      });
  }, [asset]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address.address);
      setCopied(true);
      if (copyResetRef.current !== undefined) {
        window.clearTimeout(copyResetRef.current);
      }
      copyResetRef.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidAmount(amount)) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setStep("review");
  }

  async function handleConfirm() {
    setError(null);
    setBusy(true);
    try {
      const response = await postJsonIdempotent<{
        deposit: {
          id: string;
          amount: string;
          assetSymbol: string;
          network?: string;
          status: string;
          completedAt?: string;
          createdAt: string;
        };
      }>("/api/deposits/crypto", { assetSymbol: asset, amount }, generateClientId());

      const deposit = response.deposit;
      setReceipt({
        id: deposit.id,
        amount: deposit.amount.toString(),
        assetSymbol: deposit.assetSymbol,
        status: deposit.status,
        createdAt: deposit.completedAt ?? deposit.createdAt,
        destinationLabel: "Spot Wallet",
        destinationDetail: address?.address ? `To: ${address.address.slice(0, 10)}...${address.address.slice(-6)}` : undefined,
        network: deposit.network ?? address?.network,
      });
      setStep("receipt");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Deposit could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setAmount("");
    setError(null);
    setReceipt(null);
    setStep("input");
  }

  const assetMeta = getCryptoAssetMeta(asset);
  const presets = CRYPTO_PRESETS[asset] ?? ["1", "5", "10", "50"];

  // ── Receipt Step ──
  if (step === "receipt" && receipt) {
    return (
      <DepositReceiptCard
        receipt={receipt}
        onReset={handleReset}
        viewActionHref="/wallets"
        viewActionLabel="View Wallets"
      />
    );
  }

  // ── Review Step ──
  if (step === "review") {
    return (
      <Card className="rounded-2xl border-border bg-surface-elevated shadow-xs animate-fade-in">
        <CardContent className="flex flex-col gap-6 p-5 sm:p-7">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
                Review Crypto Deposit
              </h2>
              <p className="text-xs text-text-secondary">
                Review deposit details for your spot wallet.
              </p>
            </div>
          </div>

          {/* Amount Overview */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-border/80 bg-surface/50 p-4 text-center">
            <span className="text-label uppercase tracking-wider text-text-tertiary font-medium">
              Deposit Amount
            </span>
            <div className="mt-1 flex items-center gap-2">
              <CryptoAssetIcon symbol={asset} size="sm" showBadge />
              <span className="financial-value font-mono text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
                {amount} {asset}
              </span>
            </div>
          </div>

          {/* Detail Breakdown */}
          <dl className="flex flex-col divide-y divide-border/60 text-sm">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Asset</dt>
              <dd className="font-semibold text-text-primary">
                {assetMeta.name} ({asset})
              </dd>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Network</dt>
              <dd className="font-medium text-text-primary">
                {address?.network ?? "Network unavailable"}
              </dd>
            </div>

            <div className="flex items-center justify-between py-2.5">
              <dt className="text-text-secondary">Destination Wallet</dt>
              <dd className="font-medium text-text-primary">
                Spot Wallet
              </dd>
            </div>

            {address?.address && (
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-text-secondary">Deposit Address</dt>
                <dd className="font-mono text-xs text-text-primary break-all max-w-[200px] text-right truncate" title={address.address}>
                  {address.address}
                </dd>
              </div>
            )}
          </dl>

          {/* Notice */}

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setStep("input")}
              disabled={busy}
              className="flex-1 gap-1.5 font-medium"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back to Edit</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleConfirm}
              disabled={busy}
              className="flex-1 gap-1.5 font-medium shadow-xs"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Simulating...</span>
                </>
              ) : (
                <>
                  <span>Confirm Deposit</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Input Step ──
  return (
    <Card className="rounded-2xl border-border bg-surface-elevated shadow-xs">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-7">
        {/* Environment Badge */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-tertiary">Spot Wallet</span>
        </div>

        {/* Asset Selector */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="deposit-asset" className="text-sm font-medium text-text-primary">
            Select Asset
          </label>
          <select
            id="deposit-asset"
            value={asset}
            onChange={(e) => {
              setAsset(e.target.value);
              setAmount("");
              setError(null);
            }}
            className="h-11 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-text-primary transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CRYPTO_ASSETS.map((a) => {
              const meta = getCryptoAssetMeta(a);
              return (
                <option key={a} value={a}>
                  {meta.name} ({a})
                </option>
              );
            })}
          </select>
        </div>

        {/* Deposit Address Presentation Card */}
        <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-surface/60 p-4 text-center">
          {/* QR Code Container (presentation only) */}
          <div
            className="relative flex h-36 w-36 items-center justify-center rounded-xl border-2 border-dashed border-border-strong bg-surface-elevated text-text-tertiary shadow-2xs"
            aria-label={`QR Code representation for ${asset} deposit address`}
          >
            <QrCode className="h-20 w-20 text-text-primary/70" aria-hidden="true" />
          </div>

          {/* Network label from backend */}
          {loadingAddress ? (
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Loading deposit address...</span>
            </div>
          ) : address ? (
            <div className="w-full flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                  Network:
                </span>
                <Badge variant="neutral" className="font-semibold text-text-primary">
                  {address.network}
                </Badge>
              </div>

              {/* Address string with safe word-wrap */}
              <div className="w-full rounded-lg border border-border/80 bg-surface px-3 py-2.5">
                <p className="break-all font-mono text-xs font-medium text-text-primary select-all">
                  {address.address}
                </p>
              </div>

              {/* Copy Address Action */}
              <Button
                type="button"
                variant={copied ? "secondary" : "outline"}
                size="sm"
                onClick={() => void copyAddress()}
                className="gap-1.5 font-medium mt-0.5"
                aria-label={copied ? "Address copied" : "Copy deposit address"}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copied ? "Copied to Clipboard" : "Copy Address"}</span>
              </Button>

              <p className="text-[11px] text-text-tertiary max-w-sm mt-1">
                Send only <strong className="text-text-secondary">{asset}</strong> on{" "}
                <strong className="text-text-secondary">{address.network}</strong>. Confirm the asset and network before continuing.
              </p>
            </div>
          ) : (
            <p className="text-xs text-danger">Failed to generate deposit address.</p>
          )}
        </div>

        {/* Deposit form */}
        <form onSubmit={handleReview} className="flex flex-col gap-4 border-t border-border/80 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Simulate Incoming Deposit
            </h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Enter an amount to simulate receiving on-chain {asset} into your spot wallet.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <TextField
              label={`Amount (${asset})`}
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              className="financial-value font-mono text-base font-semibold"
            />

            {/* Quick Amount Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-text-tertiary mr-1">Quick:</span>
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setAmount(preset);
                    setError(null);
                  }}
                  className="touch-target inline-flex items-center rounded-lg border border-border/80 bg-surface px-2.5 py-1 text-xs font-semibold text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  +{preset} {asset}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={!amount.trim() || !address}
            className="w-full font-semibold shadow-xs"
          >
            Review Deposit
          </Button>
        </form>

        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Deposit address copied to clipboard" : ""}
        </p>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * REUSABLE DEPOSIT RECEIPT CARD
 * ───────────────────────────────────────────────────────────────────────────── */
function DepositReceiptCard({
  receipt,
  onReset,
  viewActionHref,
  viewActionLabel,
}: {
  receipt: DepositReceiptData;
  onReset: () => void;
  viewActionHref: string;
  viewActionLabel: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(receipt.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const formattedDate = receipt.createdAt
    ? new Date(receipt.createdAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <Card className="rounded-2xl border-border bg-surface shadow-xs animate-fade-in-up">
      <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
        {/* Header */}
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success-soft text-success shadow-xs ring-4 ring-success/10">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="text-section-title text-text-primary">Deposit Confirmed</h2>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">
            Your deposit has been credited to your account.
          </p>
        </div>

        {/* Amount Hero */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface-elevated p-4 text-center">
          <span className="text-label uppercase tracking-wider text-text-tertiary font-medium">
            Credited Amount
          </span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="financial-value font-mono text-2xl font-bold tracking-tight text-success sm:text-3xl">
              +{formatMoney(receipt.amount, receipt.assetSymbol)}
            </span>
          </div>
        </div>

        {/* Details Breakdown */}
        <div className="flex flex-col divide-y divide-border/60 rounded-xl border border-border bg-surface-elevated px-4 py-1 text-xs">
          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-tertiary">Status</span>
            <TransactionStatusBadge status={receipt.status} />
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-tertiary">Destination</span>
            <span className="font-medium text-text-primary text-right">
              {receipt.destinationLabel}
              {receipt.destinationDetail && (
                <span className="block text-[11px] font-mono text-text-tertiary">
                  {receipt.destinationDetail}
                </span>
              )}
            </span>
          </div>

          {receipt.network && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-tertiary">Network</span>
              <span className="font-medium text-text-primary">
                {receipt.network}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2.5">
            <span className="text-text-tertiary">Reference ID</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary select-all">
              <span>{receipt.id}</span>
              <button
                type="button"
                onClick={() => void copyReference()}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:text-text-primary"
                aria-label="Copy reference ID"
                title={copied ? "Copied!" : "Copy reference ID"}
              >
                {copied ? (
                  <Check className="h-3 w-3 text-success" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </span>
          </div>

          {formattedDate && (
            <div className="flex items-center justify-between py-2.5">
              <span className="text-text-tertiary">Timestamp</span>
              <span className="font-mono text-[11px] text-text-secondary">
                {formattedDate}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2.5 pt-1">
          <Button
            type="button"
            variant="primary"
            onClick={onReset}
            size="lg"
            className="touch-target w-full font-semibold cursor-pointer shadow-xs"
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            Make Another Deposit
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Link href={viewActionHref} className="w-full">
              <Button
                type="button"
                variant="outline"
                className="touch-target w-full text-xs font-semibold cursor-pointer"
              >
                <Wallet className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                {viewActionLabel}
              </Button>
            </Link>

            <Link href="/transactions" className="w-full">
              <Button
                type="button"
                variant="outline"
                className="touch-target w-full text-xs font-semibold cursor-pointer"
              >
                <History className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Transactions
              </Button>
            </Link>
          </div>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {copied ? "Deposit reference ID copied to clipboard" : ""}
        </p>
      </CardContent>
    </Card>
  );
}
