"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  History,
  Landmark,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import Decimal from "decimal.js";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CryptoAssetIcon } from "@/components/financial/crypto-asset-icon";
import { CurrencyValue } from "@/components/financial/currency-value";
import { postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { accountDisplayName, maskAccountNumber } from "@/lib/utilities/format-account";
import { isDestinationAllowlisted } from "@/lib/treasury/withdrawal-allowlist";
import { cn } from "@/lib/utilities/cn";
import { FiseLoader } from "@/components/brand/fise-loader";

export interface BankAccountView {
  id: string;
  nickname: string | null;
  type: string;
  currencySymbol: string;
  accountNumber?: string;
  balanceCache?: string;
}

export interface CryptoAssetView {
  assetSymbol: string;
  available: string;
  locked: string;
}

export interface AllowlistEntryView {
  id: string;
  destination: string;
  assetSymbol: string;
  network: string;
  label: string | null;
}

export interface WithdrawClientProps {
  accounts: BankAccountView[];
  cryptoAssets: CryptoAssetView[];
  hasPin: boolean;
  allowlistEnabled: boolean;
  allowlistEntries: AllowlistEntryView[];
  supportedNetworks?: Record<string, string>;
}

interface WithdrawalReceipt {
  id: string;
  assetSymbol: string;
  amount: string;
  feeAmount: string;
  destination: string;
  network?: string | null;
  status: string;
  createdAt?: string;
}

function isValidPositiveDecimal(val: string): boolean {
  try {
    return new Decimal(val).gt(0);
  } catch {
    return false;
  }
}

const FIAT_PRESET_AMOUNTS = ["50", "100", "250", "500", "1000"];

const CRYPTO_PRESET_AMOUNTS: Record<string, string[]> = {
  USDT: ["50", "100", "250", "500"],
  BTC: ["0.005", "0.01", "0.05", "0.1"],
  ETH: ["0.05", "0.1", "0.5", "1.0"],
  SOL: ["0.5", "1", "5", "10"],
  XRP: ["50", "100", "250", "500"],
  PLT: ["100", "500", "1000", "5000"],
};

export function WithdrawClient({
  accounts,
  cryptoAssets,
  hasPin,
  allowlistEnabled,
  allowlistEntries,
  supportedNetworks = {},
}: WithdrawClientProps) {
  const [tab, setTab] = React.useState<"fiat" | "crypto">(accounts.length > 0 ? "fiat" : "crypto");
  const [step, setStep] = React.useState<"form" | "review" | "receipt">("form");

  // Fiat form state
  const [selectedAccountId, setSelectedAccountId] = React.useState(accounts[0]?.id ?? "");
  const [fiatAmount, setFiatAmount] = React.useState("");
  const [fiatDestination, setFiatDestination] = React.useState("");

  // Crypto form state
  const [selectedCryptoSymbol, setSelectedCryptoSymbol] = React.useState(cryptoAssets[0]?.assetSymbol ?? "USDT");
  const [cryptoAmount, setCryptoAmount] = React.useState("");
  const [cryptoDestination, setCryptoDestination] = React.useState("");

  // Authorization & execution state
  const [pin, setPin] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [receipt, setReceipt] = React.useState<WithdrawalReceipt | null>(null);
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  // Keep a stable client idempotency key per withdrawal draft
  const idempotencyKeyRef = React.useRef(generateClientId());

  // Derive active account / asset
  const activeAccount = accounts.find((a) => a.id === selectedAccountId) ?? accounts[0];
  const activeCrypto = cryptoAssets.find((a) => a.assetSymbol === selectedCryptoSymbol) ?? cryptoAssets[0];

  const activeAssetSymbol = tab === "fiat" ? (activeAccount?.currencySymbol ?? "USD") : selectedCryptoSymbol;
  const activeAmount = tab === "fiat" ? fiatAmount : cryptoAmount;
  const activeDestination = tab === "fiat" ? fiatDestination : cryptoDestination;
  const activeNetwork = tab === "fiat" ? undefined : (supportedNetworks[selectedCryptoSymbol] ?? undefined);

  // Available balance
  const activeBalance =
    tab === "fiat"
      ? (activeAccount?.balanceCache ?? "0")
      : (activeCrypto?.available ?? "0");

  // Allowlist checking using official FHT helper
  const matchingAllowlistEntry = React.useMemo(() => {
    if (!activeDestination.trim()) return null;
    return (
      allowlistEntries.find((entry) =>
        isDestinationAllowlisted(entry, {
          destination: activeDestination.trim(),
          assetSymbol: activeAssetSymbol,
          network: activeNetwork,
        })
      ) ?? null
    );
  }, [allowlistEntries, activeDestination, activeAssetSymbol, activeNetwork]);

  const isAllowlisted = Boolean(matchingAllowlistEntry);

  // Filter allowlist entries relevant for quick-selection
  const availableAllowlistOptions = React.useMemo(() => {
    return allowlistEntries.filter((entry) => {
      const scopeAsset = entry.assetSymbol?.trim().toUpperCase();
      return !scopeAsset || scopeAsset === activeAssetSymbol.toUpperCase();
    });
  }, [allowlistEntries, activeAssetSymbol]);

  // Destination format validity
  const isDestinationValid = React.useMemo(() => {
    const trimmed = activeDestination.trim();
    if (tab === "fiat") return trimmed.length >= 4;
    return trimmed.length >= 10 && !/\s/.test(trimmed);
  }, [tab, activeDestination]);

  // Form validity for proceeding to review
  const canProceedToReview =
    Boolean(activeAmount) &&
    isValidPositiveDecimal(activeAmount) &&
    isDestinationValid &&
    (!allowlistEnabled || isAllowlisted);

  function resetToForm() {
    setStep("form");
    setPin("");
    setError(null);
  }

  function resetFull() {
    idempotencyKeyRef.current = generateClientId();
    setStep("form");
    setFiatAmount("");
    setFiatDestination("");
    setCryptoAmount("");
    setCryptoDestination("");
    setPin("");
    setError(null);
    setReceipt(null);
  }

  async function handleCopy(text: string, field: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Ignore clipboard error
    }
  }

  async function submitWithdrawal() {
    if (!canProceedToReview || pin.length < 4) return;
    setError(null);
    setSubmitting(true);

    try {
      const response = await postJsonIdempotent<{ withdrawal: WithdrawalReceipt }>(
        "/api/withdrawals",
        {
          assetSymbol: activeAssetSymbol,
          amount: activeAmount,
          destination: activeDestination.trim(),
          network: activeNetwork,
          transactionPin: pin,
        },
        idempotencyKeyRef.current
      );

      setReceipt(response.withdrawal);
      setStep("receipt");
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError("Withdrawal request failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── EMPTY STATE: No accounts and no crypto assets ──────────────────────────
  if (accounts.length === 0 && cryptoAssets.length === 0) {
    return (
      <Card className="max-w-xl">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-hover text-text-tertiary">
            <Wallet className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-section-title font-semibold text-text-primary">
              No Funded Accounts or Wallets
            </h2>
            <p className="text-sm text-text-secondary">
              You do not currently have any accounts or assets available for withdrawal.
            </p>
          </div>
          <Link href="/deposit">
            <Button className="mt-2 gap-2">
              <span>Make a Deposit</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-xl">
      {/* ── Segmented Tab Switcher ─────────────────────────────────────────── */}
      {step !== "receipt" && (
        <div
          role="tablist"
          aria-label="Withdrawal type"
          className="mb-6 flex rounded-xl border border-border/80 bg-surface p-1.5 shadow-xs"
        >
          <button
            type="button"
            role="tab"
            id="tab-fiat"
            aria-selected={tab === "fiat"}
            aria-controls="panel-withdraw-fiat"
            onClick={() => {
              setTab("fiat");
              setStep("form");
              setError(null);
            }}
            className={cn(
              "touch-target flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm transition-all cursor-pointer",
              tab === "fiat"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            )}
          >
            <Landmark className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Fiat Withdrawal</span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-crypto"
            aria-selected={tab === "crypto"}
            aria-controls="panel-withdraw-crypto"
            onClick={() => {
              setTab("crypto");
              setStep("form");
              setError(null);
            }}
            className={cn(
              "touch-target flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm transition-all cursor-pointer",
              tab === "crypto"
                ? "bg-primary font-semibold text-primary-foreground shadow-xs"
                : "font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover"
            )}
          >
            <Wallet className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Crypto Withdrawal</span>
          </button>
        </div>
      )}

      {/* ── STEP 1: FORM ─────────────────────────────────────────────────── */}
      {step === "form" && (
        <Card className="border border-border/80 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <form
              id="withdraw-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (canProceedToReview) setStep("review");
              }}
              className="flex flex-col gap-5"
            >
              {/* Security Allowlist Banner if Enabled */}
              {allowlistEnabled && (
                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary-soft/30 p-3.5 text-xs text-text-secondary">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <div className="flex-1 leading-relaxed">
                    <span className="font-semibold text-text-primary">Allowlist Security Active: </span>
                    Withdrawals are restricted to authorized addresses on your allowlist. Unapproved destinations will be rejected.
                  </div>
                </div>
              )}

              {/* ── FIAT TAB CONTENT ── */}
              {tab === "fiat" && (
                <>
                  {accounts.length === 0 ? (
                    <p className="text-sm text-text-secondary">No fiat bank accounts found.</p>
                  ) : (
                    <>
                      {/* Source Account Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="withdraw-source-account" className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                          Source Bank Account
                        </label>
                        <select
                          id="withdraw-source-account"
                          value={selectedAccountId}
                          onChange={(e) => setSelectedAccountId(e.target.value)}
                          className="h-11 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-text-primary focus:border-primary focus:ring-1 focus:ring-primary"
                        >
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {accountDisplayName(a.nickname, a.type)} ({a.currencySymbol}) — Bal: {a.balanceCache ?? "0.00"}
                            </option>
                          ))}
                        </select>
                        {activeAccount && (
                          <div className="flex items-center justify-between text-xs text-text-tertiary pt-0.5">
                            <span>
                              {activeAccount.accountNumber ? maskAccountNumber(activeAccount.accountNumber) : "FHT Account"}
                            </span>
                            <span className="flex items-center gap-1 font-medium text-text-secondary">
                              Available:{" "}
                              <CurrencyValue
                                amount={activeAccount.balanceCache ?? "0"}
                                assetSymbol={activeAccount.currencySymbol}
                                className="font-semibold financial-value text-text-primary"
                              />
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Destination Bank Account */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="fiat-destination" className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                            Destination Bank Account
                          </label>
                          {allowlistEnabled && fiatDestination.trim() && (
                            <Badge
                              variant={isAllowlisted ? "success" : "warning"}
                              className="text-[11px] font-medium"
                            >
                              {isAllowlisted
                                ? matchingAllowlistEntry?.label
                                  ? `Allowlisted (${matchingAllowlistEntry.label})`
                                  : "Allowlisted"
                                : "Not allowlisted"}
                            </Badge>
                          )}
                        </div>

                        <TextField
                          id="fiat-destination"
                          label="Recipient Account / Bank Identifier"
                          value={fiatDestination}
                          onChange={(e) => setFiatDestination(e.target.value)}
                          placeholder="e.g. Chase •••• 1234 or GB29NWBK60161331926819"
                        />

                        {/* Allowlist Quick Select */}
                        {allowlistEnabled && availableAllowlistOptions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-text-tertiary">Saved destinations:</span>
                            {availableAllowlistOptions.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => setFiatDestination(entry.destination)}
                                className="rounded-md border border-border bg-surface-hover px-2 py-0.5 text-xs text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors"
                              >
                                {entry.label || entry.destination.slice(0, 14)}
                              </button>
                            ))}
                          </div>
                        )}

                        {allowlistEnabled && fiatDestination.trim() && !isAllowlisted && (
                          <p className="flex items-start gap-1.5 text-xs text-warning pt-0.5" role="alert">
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>This destination is not on your allowlist and will be rejected.</span>
                          </p>
                        )}
                      </div>

                      {/* Amount Entry */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="fiat-amount" className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                            Withdrawal Amount ({activeAssetSymbol})
                          </label>
                          <span className="text-[11px] text-text-tertiary">Min: $100 USD equiv.</span>
                        </div>
                        <TextField
                          id="fiat-amount"
                          label="Amount"
                          inputMode="decimal"
                          value={fiatAmount}
                          onChange={(e) => setFiatAmount(e.target.value)}
                          placeholder="0.00"
                          className="financial-value font-mono text-base"
                        />

                        {/* Preset Buttons */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {FIAT_PRESET_AMOUNTS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setFiatAmount(preset)}
                              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:border-primary/40 hover:text-text-primary hover:bg-surface-hover transition-colors"
                            >
                              +{preset}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* ── CRYPTO TAB CONTENT ── */}
              {tab === "crypto" && (
                <>
                  {cryptoAssets.length === 0 ? (
                    <p className="text-sm text-text-secondary">No crypto assets found in your wallet.</p>
                  ) : (
                    <>
                      {/* Asset Selector */}
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="withdraw-crypto-asset" className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                          Select Crypto Asset
                        </label>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {cryptoAssets.map((asset) => {
                            const isSelected = asset.assetSymbol === selectedCryptoSymbol;
                            return (
                              <button
                                key={asset.assetSymbol}
                                type="button"
                                onClick={() => setSelectedCryptoSymbol(asset.assetSymbol)}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-all cursor-pointer",
                                  isSelected
                                    ? "border-primary bg-primary-soft/30 ring-1 ring-primary/30"
                                    : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover"
                                )}
                              >
                                <CryptoAssetIcon symbol={asset.assetSymbol} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-semibold text-text-primary">
                                    {asset.assetSymbol}
                                  </p>
                                  <p className="truncate font-mono text-[11px] text-text-tertiary financial-value">
                                    {asset.available}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Supported Network Display */}
                      <div className="rounded-lg border border-border bg-surface-elevated p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-secondary">Transfer Network</span>
                          <span className="text-xs font-semibold text-text-primary">
                            {supportedNetworks[selectedCryptoSymbol] ?? "FHT Supported Network"}
                          </span>
                        </div>
                      </div>

                      {/* Destination Address */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="crypto-destination" className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                            Destination Address
                          </label>
                          {allowlistEnabled && cryptoDestination.trim() && (
                            <Badge
                              variant={isAllowlisted ? "success" : "warning"}
                              className="text-[11px] font-medium"
                            >
                              {isAllowlisted
                                ? matchingAllowlistEntry?.label
                                  ? `Allowlisted (${matchingAllowlistEntry.label})`
                                  : "Allowlisted"
                                : "Not allowlisted"}
                            </Badge>
                          )}
                        </div>

                        <TextField
                          id="crypto-destination"
                          label="Recipient Address"
                          value={cryptoDestination}
                          onChange={(e) => setCryptoDestination(e.target.value)}
                          placeholder="e.g. bc1q... or 0x..."
                          className="font-mono text-xs break-all"
                        />

                        {/* Allowlist Quick Select */}
                        {allowlistEnabled && availableAllowlistOptions.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-text-tertiary">Saved destinations:</span>
                            {availableAllowlistOptions.map((entry) => (
                              <button
                                key={entry.id}
                                type="button"
                                onClick={() => setCryptoDestination(entry.destination)}
                                className="rounded-md border border-border bg-surface-hover px-2 py-0.5 text-xs text-text-secondary hover:text-text-primary hover:border-primary/50 transition-colors"
                              >
                                {entry.label || entry.destination.slice(0, 10) + "..."}
                              </button>
                            ))}
                          </div>
                        )}

                        {allowlistEnabled && cryptoDestination.trim() && !isAllowlisted && (
                          <p className="flex items-start gap-1.5 text-xs text-warning pt-0.5" role="alert">
                            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>This address is not on your allowlist and will be rejected.</span>
                          </p>
                        )}
                      </div>

                      {/* Crypto Amount */}
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <label htmlFor="crypto-amount" className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                            Withdrawal Amount ({selectedCryptoSymbol})
                          </label>
                          <span className="text-[11px] text-text-tertiary">Min: $100 USD equiv.</span>
                        </div>

                        <TextField
                          id="crypto-amount"
                          label="Amount"
                          inputMode="decimal"
                          value={cryptoAmount}
                          onChange={(e) => setCryptoAmount(e.target.value)}
                          placeholder="0.00"
                          className="financial-value font-mono text-base"
                        />

                        <div className="flex items-center justify-between text-xs text-text-tertiary pt-0.5">
                          <span>Available: <span className="font-mono font-semibold text-text-primary financial-value">
                            {activeCrypto?.available ?? "0"} {selectedCryptoSymbol}
                          </span></span>
                        </div>

                        {/* Preset Chips */}
                        {CRYPTO_PRESET_AMOUNTS[selectedCryptoSymbol] && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {CRYPTO_PRESET_AMOUNTS[selectedCryptoSymbol].map((preset) => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setCryptoAmount(preset)}
                                className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:border-primary/40 hover:text-text-primary hover:bg-surface-hover transition-colors"
                              >
                                +{preset}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Informational Policy Notice (Adhering to safety constraints 1 & 2) */}
              <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface/70 p-3.5 text-xs text-text-tertiary">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" aria-hidden="true" />
                <span className="leading-relaxed">
                  A processing fee may apply. Some withdrawals may require review before completion.
                </span>
              </div>

              {/* Action: Continue to Review */}
              <Button
                type="submit"
                size="lg"
                disabled={!canProceedToReview}
                className="mt-1 gap-2 font-medium"
              >
                <span>Continue to Review</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 2: REVIEW & PIN AUTHORIZATION ────────────────────────────── */}
      {step === "review" && (
        <Card className="border border-border/80 shadow-sm animate-fade-in">
          <CardContent className="p-5 sm:p-6 flex flex-col gap-5">
            <div>
              <h2 className="text-section-title font-semibold tracking-tight text-text-primary">
                Review Withdrawal
              </h2>
              <p className="mt-0.5 text-sm text-text-secondary">
                Confirm all withdrawal details and authorize with your transaction PIN.
              </p>
            </div>

            {/* Hero Amount Display */}
            <div className="rounded-2xl border border-border bg-surface/60 p-5 text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                Withdrawal Amount
              </p>
              <div className="mt-1">
                <span className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary font-mono financial-value">
                  {activeAmount} {activeAssetSymbol}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-text-secondary">
                Withdrawal from your {tab === "fiat" ? "fiat bank account" : "crypto spot wallet"}
              </p>
            </div>

            {/* Authoritative Breakdown Details */}
            <div className="overflow-hidden rounded-xl border border-border divide-y divide-border/80 bg-surface/40">
              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-text-secondary text-xs sm:text-sm">Source</span>
                <div className="text-right">
                  <span className="font-semibold text-text-primary text-xs sm:text-sm">
                    {tab === "fiat"
                      ? (activeAccount ? accountDisplayName(activeAccount.nickname, activeAccount.type) : "Bank Account")
                      : `${selectedCryptoSymbol} Spot Balance`}
                  </span>
                  <p className="font-mono text-xs text-text-tertiary financial-value">
                    Available: {activeBalance} {activeAssetSymbol}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-text-secondary text-xs sm:text-sm">Destination</span>
                <div className="text-right max-w-[220px] sm:max-w-xs">
                  <span className="font-mono text-xs text-text-primary break-all financial-value">
                    {activeDestination}
                  </span>
                  {allowlistEnabled && (
                    <div className="mt-0.5">
                      <Badge
                        variant={isAllowlisted ? "success" : "warning"}
                        className="text-[10px]"
                      >
                        {isAllowlisted
                          ? matchingAllowlistEntry?.label
                            ? `Allowlisted (${matchingAllowlistEntry.label})`
                            : "Allowlisted"
                          : "Not allowlisted"}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {activeNetwork && (
                <div className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-text-secondary text-xs sm:text-sm">Network</span>
                  <span className="font-semibold text-text-primary text-xs sm:text-sm">
                    {activeNetwork}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-text-secondary text-xs sm:text-sm">Processing Fee</span>
                <span className="text-xs text-text-secondary italic">
                  Applied on ledger posting
                </span>
              </div>
            </div>

            {/* Processing Indicator for Withdrawal */}
              {submitting && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/30 bg-primary-soft/30 p-4 animate-fade-in">
                  <FiseLoader variant="inline" size="sm" text="Processing withdrawal..." />
                </div>
              )}

            {/* PIN Authorization Section */}
            {!hasPin ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft/30 p-4 text-xs text-text-primary"
              >
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-text-primary">Transaction PIN Required</p>
                  <p className="text-text-secondary leading-relaxed">
                    You must set up a 4-6 digit transaction PIN in your Security settings before making a withdrawal.
                  </p>
                  <Link href="/security">
                    <Button variant="outline" size="sm" className="mt-1 gap-1.5 text-xs">
                      <span>Go to Security Settings</span>
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Transaction PIN Authorization
                    </h3>
                    <p className="text-xs text-text-secondary">
                      Enter your 4-6 digit PIN to authorize this withdrawal.
                    </p>
                  </div>
                </div>

                <div className="max-w-xs">
                  <TextField
                    id="withdraw-pin"
                    label="Transaction PIN"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="••••"
                    className="font-mono tracking-widest text-center text-lg financial-value"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-between pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={resetToForm}
                disabled={submitting}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Edit</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                size="lg"
                disabled={submitting || !hasPin || pin.length < 4}
                onClick={submitWithdrawal}
                className="gap-2 font-medium shadow-sm"
              >
                {submitting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Processing Withdrawal...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    <span>Authorize &amp; Withdraw</span>
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── STEP 3: RECEIPT / STATUS (Adhering to safety constraints 6 & 7) ── */}
      {step === "receipt" && receipt && (
        <Card className="border border-border/80 shadow-sm animate-fade-in">
          <CardContent className="p-6 sm:p-8 flex flex-col items-center gap-5 text-center">
            {/* Status Icon based on actual backend status */}
            {receipt.status === "COMPLETED" ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-soft text-success">
                <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
              </div>
            ) : receipt.status === "PENDING" ? (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-warning-soft text-warning">
                <Clock className="h-8 w-8" aria-hidden="true" />
              </div>
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-hover text-text-primary">
                <History className="h-8 w-8" aria-hidden="true" />
              </div>
            )}

            {/* Status Title and Copy (Strictly reflecting actual backend status) */}
            <div className="flex flex-col gap-1.5">
              <Badge
                variant={receipt.status === "COMPLETED" ? "success" : "warning"}
                className="mx-auto"
              >
                {receipt.status}
              </Badge>
              <h2 className="text-section-title font-semibold tracking-tight text-text-primary">
                {receipt.status === "COMPLETED"
                  ? "Withdrawal Complete"
                  : receipt.status === "PENDING"
                  ? "Awaiting Administrator Review"
                  : `Withdrawal ${receipt.status}`}
              </h2>
              <p className="text-sm text-text-secondary max-w-md">
                {receipt.status === "COMPLETED"
                  ? "Your withdrawal has been approved and completed. Funds have been sent to your destination."
                  : receipt.status === "PENDING"
                  ? "Your withdrawal has been submitted and is awaiting administrator review. You will be notified once it has been approved or rejected."
                  : `Withdrawal status is ${receipt.status}.`}
              </p>
            </div>

            {/* Authoritative Receipt Details */}
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-border divide-y divide-border/80 bg-surface/50 text-left">
              {/* Amount */}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm">
                <span className="text-text-secondary">Withdrawal Amount</span>
                <span className="font-mono font-bold text-text-primary financial-value">
                  {receipt.amount} {receipt.assetSymbol}
                </span>
              </div>

              {/* Fee Amount (authoritative backend value only) */}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm">
                <span className="text-text-secondary">Fee Deducted</span>
                <span className="font-mono text-text-primary financial-value">
                  {receipt.feeAmount} {receipt.assetSymbol}
                </span>
              </div>

              {/* Destination */}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm">
                <span className="text-text-secondary">Destination</span>
                <div className="flex items-center gap-1.5 max-w-[200px] sm:max-w-xs">
                  <span className="font-mono text-xs text-text-primary truncate financial-value">
                    {receipt.destination}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(receipt.destination, "destination")}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
                    title={copiedField === "destination" ? "Copied!" : "Copy Destination"}
                    aria-label={copiedField === "destination" ? "Copied" : "Copy Destination"}
                  >
                    {copiedField === "destination" ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Network if applicable */}
              {receipt.network && (
                <div className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm">
                  <span className="text-text-secondary">Network</span>
                  <span className="font-medium text-text-primary">{receipt.network}</span>
                </div>
              )}

              {/* Reference ID */}
              <div className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm">
                <span className="text-text-secondary">Reference ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-text-tertiary financial-value">
                    {receipt.id.slice(0, 16)}...
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(receipt.id, "id")}
                    className="inline-flex h-5 w-5 items-center justify-center rounded text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors cursor-pointer"
                    title={copiedField === "id" ? "Copied!" : "Copy Reference ID"}
                    aria-label={copiedField === "id" ? "Copied" : "Copy Reference ID"}
                  >
                    {copiedField === "id" ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </div>

              {/* Date / Timestamp */}
              {receipt.createdAt && (
                <div className="flex items-center justify-between px-4 py-2.5 text-xs sm:text-sm">
                  <span className="text-text-secondary">Date &amp; Time</span>
                  <span className="text-xs text-text-secondary">
                    {new Date(receipt.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
            </div>


            {/* Navigation Actions */}
            <div className="flex w-full max-w-md flex-col gap-2.5 sm:flex-row pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={resetFull}
                className="flex-1 gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>New Withdrawal</span>
              </Button>
              <Link href="/transactions" className="flex-1">
                <Button variant="outline" size="md" className="w-full gap-1.5">
                  <History className="h-4 w-4" />
                  <span>Transactions</span>
                </Button>
              </Link>
              <Link href="/wallets" className="flex-1">
                <Button variant="primary" size="md" className="w-full gap-1.5">
                  <Wallet className="h-4 w-4" />
                  <span>Wallets</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
