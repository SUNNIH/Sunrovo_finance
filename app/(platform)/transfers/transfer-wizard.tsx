"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Hash,
  Landmark,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { postJson, postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyValue } from "@/components/financial/currency-value";
import { TextField } from "@/components/forms/text-field";
import { accountDisplayName, BANK_ACCOUNT_TYPE_LABELS, maskAccountNumber } from "@/lib/utilities/format-account";
import {
  resolveAuthorizedRecipient,
  type TransferAccountOption,
  type TransferBeneficiaryOption,
} from "@/lib/utilities/transfer-recipient";
import type { TransferPreview } from "@/features/banking/transfers";
import { cn } from "@/lib/utilities/cn";
import { FiseLoader } from "@/components/brand/fise-loader";

type AccountView = TransferAccountOption;
type BeneficiaryView = TransferBeneficiaryOption;

type Step = "source" | "destination" | "amount" | "review" | "receipt";

interface TransferWizardProps {
  accounts: AccountView[];
  beneficiaries: BeneficiaryView[];
  initialSourceAccountId?: string;
}

interface ServerRecipientResult {
  status: "own_source" | "own_account" | "beneficiary" | "internal_account" | "not_found";
  accountId?: string;
  beneficiaryId?: string;
  displayName?: string;
  accountType?: string;
  currencySymbol?: string;
  maskedAccountNumber?: string;
  bankName?: string | null;
  isInternalPlt?: boolean;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "source", label: "Source" },
  { id: "destination", label: "Recipient" },
  { id: "amount", label: "Amount" },
  { id: "review", label: "Review & PIN" },
];

export function TransferWizard({
  accounts,
  beneficiaries,
  initialSourceAccountId,
}: TransferWizardProps) {
  const [step, setStep] = React.useState<Step>("source");
  const [sourceAccountId, setSourceAccountId] = React.useState<string | undefined>(
    initialSourceAccountId ?? accounts.find((a) => a.type === "CURRENT")?.id ?? accounts[0]?.id
  );
  const [destinationTab, setDestinationTab] = React.useState<"plt_number" | "beneficiary" | "own_account">(
    "plt_number"
  );
  const [pltAccountNumber, setPltAccountNumber] = React.useState("");
  const [destinationAccountId, setDestinationAccountId] = React.useState<string | undefined>();
  const [beneficiaryId, setBeneficiaryId] = React.useState<string | undefined>();
  const [amount, setAmount] = React.useState("");
  const [narration, setNarration] = React.useState("");
  const [pin, setPin] = React.useState("");
  const [preview, setPreview] = React.useState<TransferPreview | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [receiptId, setReceiptId] = React.useState<string | null>(null);
  const [receiptCopied, setReceiptCopied] = React.useState(false);

  // Secure asynchronous recipient resolution state
  const [serverRecipient, setServerRecipient] = React.useState<ServerRecipientResult | null>(null);
  const [isVerifyingRecipient, setIsVerifyingRecipient] = React.useState(false);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  const idempotencyKeyRef = React.useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = generateClientId();
  }

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);

  // Debounced server-side + local recipient verification
  React.useEffect(() => {
    if (destinationTab !== "plt_number") return;
    const cleanNumber = pltAccountNumber.replace(/\s+/g, "").trim();

    if (cleanNumber.length < 4) {
      setServerRecipient(null);
      setLookupError(null);
      setIsVerifyingRecipient(false);
      return;
    }

    // Check local accounts and beneficiaries for instant matching
    const localMatch = resolveAuthorizedRecipient(
      cleanNumber,
      sourceAccountId,
      accounts,
      beneficiaries
    );

    if (localMatch.status === "own_source") {
      setServerRecipient({ status: "own_source" });
      setLookupError(null);
      setIsVerifyingRecipient(false);
      return;
    }

    if (localMatch.status === "own_account") {
      setServerRecipient({
        status: "own_account",
        accountId: localMatch.account.id,
        displayName: localMatch.label,
        accountType: BANK_ACCOUNT_TYPE_LABELS[localMatch.account.type] ?? localMatch.account.type,
        currencySymbol: localMatch.account.currencySymbol,
        maskedAccountNumber: localMatch.maskedNumber,
        isInternalPlt: true,
      });
      setLookupError(null);
      setIsVerifyingRecipient(false);
      return;
    }

    if (localMatch.status === "beneficiary") {
      setServerRecipient({
        status: "beneficiary",
        beneficiaryId: localMatch.beneficiary.id,
        displayName: localMatch.label,
        accountType: localMatch.beneficiary.type === "INTERNAL_PLT" ? "FHT Account" : "External Account",
        currencySymbol: sourceAccount?.currencySymbol ?? "USD",
        maskedAccountNumber: localMatch.maskedNumber,
        bankName: localMatch.beneficiary.bankName,
        isInternalPlt: localMatch.beneficiary.type === "INTERNAL_PLT",
      });
      setLookupError(null);
      setIsVerifyingRecipient(false);
      return;
    }

    // Not matched locally — perform secure server-side lookup
    let cancelled = false;
    setIsVerifyingRecipient(true);
    setLookupError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await postJson<ServerRecipientResult>("/api/transfers/recipient", {
          accountNumber: cleanNumber,
          sourceAccountId,
        });
        if (!cancelled) {
          setServerRecipient(response);
          setIsVerifyingRecipient(false);
        }
      } catch (err) {
        if (!cancelled) {
          setIsVerifyingRecipient(false);
          if (err instanceof ApiRequestError && err.status === 429) {
            setLookupError("Too many verification attempts. Please wait a moment before trying again.");
          } else {
            setServerRecipient({ status: "not_found" });
          }
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [pltAccountNumber, destinationTab, sourceAccountId, accounts, beneficiaries, sourceAccount]);

  const destination =
    destinationTab === "plt_number"
      ? serverRecipient?.status === "own_account" && serverRecipient.accountId
        ? { kind: "own_account" as const, destinationAccountId: serverRecipient.accountId }
        : serverRecipient?.status === "beneficiary" && serverRecipient.beneficiaryId
          ? { kind: "beneficiary" as const, beneficiaryId: serverRecipient.beneficiaryId }
          : serverRecipient?.status === "internal_account" && serverRecipient.accountId
            ? { kind: "internal_account" as const, destinationAccountId: serverRecipient.accountId }
            : null
      : destinationTab === "own_account"
        ? destinationAccountId
          ? { kind: "own_account" as const, destinationAccountId }
          : null
        : beneficiaryId
          ? { kind: "beneficiary" as const, beneficiaryId }
          : null;

  async function goToReview() {
    if (!sourceAccountId || !destination || !amount) return;
    setError(null);
    setPreviewLoading(true);
    try {
      const result = await postJson<TransferPreview>("/api/transfers/quote", {
        sourceAccountId,
        destination,
        amount,
      });
      setPreview(result);
      setStep("review");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function confirmTransfer() {
    if (!sourceAccountId || !destination) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await postJsonIdempotent<{ transfer: { id: string } }>(
        "/api/transfers",
        {
          sourceAccountId,
          destination,
          amount,
          narration: narration || undefined,
          transactionPin: pin,
        },
        idempotencyKeyRef.current ?? generateClientId()
      );
      setReceiptId(response.transfer.id);
      setStep("receipt");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    idempotencyKeyRef.current = generateClientId();
    setStep("source");
    setDestinationAccountId(undefined);
    setBeneficiaryId(undefined);
    setPltAccountNumber("");
    setServerRecipient(null);
    setIsVerifyingRecipient(false);
    setLookupError(null);
    setAmount("");
    setNarration("");
    setPin("");
    setPreview(null);
    setReceiptId(null);
    setError(null);
  }

  async function copyReceiptId() {
    if (!receiptId) return;
    try {
      await navigator.clipboard.writeText(receiptId);
      setReceiptCopied(true);
      setTimeout(() => setReceiptCopied(false), 2000);
    } catch {
      setReceiptCopied(false);
    }
  }

  if (accounts.length === 0) {
    return (
      <Card className="w-full max-w-2xl border-border bg-surface-elevated">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-12">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Landmark className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">No Active Accounts</h2>
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            You don&rsquo;t have any active accounts to transfer from yet. Complete onboarding or visit accounts to get started.
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

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-5">
      {/* Guided Stepper Indicator */}
      {step !== "receipt" && (
        <nav aria-label="Transfer progress" className="w-full">
          <ol className="flex items-center justify-between gap-1.5 sm:gap-2">
            {STEPS.map((s, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <li key={s.id} className="flex flex-1 items-center">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all",
                        isDone && "bg-primary text-primary-foreground shadow-xs",
                        isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                        !isDone && !isCurrent && "border border-border bg-surface text-text-tertiary"
                      )}
                    >
                      {isDone ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={cn(
                        "hidden text-xs font-medium sm:block",
                        isCurrent && "font-semibold text-text-primary",
                        isDone && "text-text-secondary",
                        !isDone && !isCurrent && "text-text-tertiary"
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "mx-2 h-0.5 flex-1 rounded-full transition-colors",
                        idx < currentStepIndex ? "bg-primary" : "bg-border"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Main Wizard Card */}
      <Card className="relative overflow-hidden rounded-2xl border-border bg-surface-elevated shadow-sm">
        <CardContent className="p-5 sm:p-7">
          {/* Back button navigation */}
          {step !== "source" && step !== "receipt" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((s) => (s === "destination" ? "source" : s === "amount" ? "destination" : "amount"));
              }}
              className="mb-5 inline-flex min-h-touch items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>
                Back to {step === "destination" ? "Account" : step === "amount" ? "Recipient" : "Amount"}
              </span>
            </button>
          )}

          {/* Global Form Error Banner */}
          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-sm text-danger animate-fade-in"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {/* ──────────────── STEP 1: SOURCE ACCOUNT ──────────────── */}
          {step === "source" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-section-title font-semibold tracking-tight text-text-primary">
                  Select Source Account
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Choose the FHT fiat account to transfer funds from.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {accounts.map((account) => {
                  const isSelected = sourceAccountId === account.id;
                  const displayName = accountDisplayName(account.nickname, account.type);

                  return (
                    <label
                      key={account.id}
                      className={cn(
                        "group flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-150",
                        isSelected
                          ? "border-primary bg-primary-soft/30 ring-1 ring-primary/30 shadow-xs"
                          : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/60"
                      )}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                            isSelected
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-surface-hover text-text-secondary group-hover:text-text-primary"
                          )}
                        >
                          <Landmark className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {displayName}
                          </p>
                          <p className="font-mono text-xs text-text-tertiary financial-value">
                            {maskAccountNumber(account.accountNumber)} · {account.currencySymbol}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 pl-2">
                        <div className="text-right">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                            Available
                          </p>
                          <CurrencyValue
                            amount={account.balanceCache}
                            assetSymbol={account.currencySymbol}
                            className="font-bold text-sm text-text-primary financial-value"
                          />
                        </div>
                        <input
                          type="radio"
                          name="source"
                          checked={isSelected}
                          onChange={() => setSourceAccountId(account.id)}
                          className="h-4 w-4 text-primary focus:ring-primary"
                        />
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  size="lg"
                  disabled={!sourceAccountId}
                  onClick={() => setStep("destination")}
                  className="w-full gap-2 sm:w-auto font-medium"
                >
                  <span>Continue to Recipient</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 2: DESTINATION / RECIPIENT ──────────────── */}
          {step === "destination" && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-section-title font-semibold tracking-tight text-text-primary">
                  Recipient Destination
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Send to an account number, saved beneficiary, or your own accounts.
                </p>
              </div>

              {/* Destination Selector Tabs */}
              <div className="flex rounded-xl border border-border bg-surface p-1">
                {[
                  { id: "plt_number" as const, label: "Account Number", icon: Hash },
                  { id: "beneficiary" as const, label: "Saved Beneficiary", icon: Users },
                  { id: "own_account" as const, label: "My Accounts", icon: Landmark },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDestinationTab(id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all sm:text-sm",
                      destinationTab === id
                        ? "bg-surface-elevated text-primary shadow-xs font-semibold"
                        : "text-text-secondary hover:text-text-primary"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>

              {/* TAB 1: FHT ACCOUNT NUMBER LOOKUP */}
              {destinationTab === "plt_number" && (
                <div className="flex flex-col gap-3.5">
                  <TextField
                    id="plt-account-number"
                    label="FHT Account Number"
                    value={pltAccountNumber}
                    onChange={(e) => setPltAccountNumber(e.target.value)}
                    placeholder="Enter 10 or 12-digit FHT account number"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono financial-value"
                    hint="Enter any unique FHT account number to securely verify recipient details."
                  />

                  {/* Verification Spinner */}
                  {isVerifyingRecipient && (
                    <div
                      role="status"
                      className="flex items-center gap-2.5 rounded-xl border border-border bg-surface/60 p-3.5 text-xs text-text-secondary animate-pulse"
                    >
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span>Verifying FHT recipient account...</span>
                    </div>
                  )}

                  {/* Verification Card: Verified FHT Customer / Internal Account */}
                  {!isVerifyingRecipient && serverRecipient?.status === "internal_account" && (
                    <div
                      role="status"
                      className="rounded-xl border border-primary/40 bg-primary-soft/30 p-4 shadow-xs animate-fade-in"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Account Verified · FHT Customer</span>
                        </div>
                        <Badge variant="primary" className="text-[10px] gap-1 py-0.5">
                          <Landmark className="h-2.5 w-2.5" />
                          <span>FHT Internal</span>
                        </Badge>
                      </div>
                      <p className="mt-2 text-base font-semibold text-text-primary">
                        {serverRecipient.displayName}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-text-secondary financial-value">
                        <span>{serverRecipient.maskedAccountNumber}</span>
                        <span>·</span>
                        <span>{serverRecipient.accountType}</span>
                        <span>·</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium border border-border">
                          {serverRecipient.currencySymbol}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Verification Card: Own Account */}
                  {!isVerifyingRecipient && serverRecipient?.status === "own_account" && (
                    <div
                      role="status"
                      className="rounded-xl border border-success/40 bg-success-soft/30 p-4 shadow-xs animate-fade-in"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-success">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Account Found · Your Account</span>
                      </div>
                      <p className="mt-1.5 text-base font-semibold text-text-primary">
                        {serverRecipient.displayName}
                      </p>
                      <div className="mt-1 flex items-center gap-2 font-mono text-xs text-text-secondary financial-value">
                        <span>{serverRecipient.maskedAccountNumber}</span>
                        <span>·</span>
                        <span>{serverRecipient.accountType}</span>
                        <span>·</span>
                        <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium border border-border">
                          {serverRecipient.currencySymbol}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Verification Card: Saved Beneficiary */}
                  {!isVerifyingRecipient && serverRecipient?.status === "beneficiary" && (
                    <div
                      role="status"
                      className="rounded-xl border border-primary/40 bg-primary-soft/30 p-4 shadow-xs animate-fade-in"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
                        <UserCheck className="h-4 w-4" />
                        <span>Account Verified · Saved Beneficiary</span>
                      </div>
                      <p className="mt-1.5 text-base font-semibold text-text-primary">
                        {serverRecipient.displayName}
                      </p>
                      <div className="mt-1 flex items-center gap-2 font-mono text-xs text-text-secondary financial-value">
                        <span>{serverRecipient.maskedAccountNumber}</span>
                        {serverRecipient.bankName && (
                          <>
                            <span>·</span>
                            <span>{serverRecipient.bankName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Card: Same as source account */}
                  {!isVerifyingRecipient && serverRecipient?.status === "own_source" && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/30 p-4 text-xs font-medium text-danger animate-fade-in"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        This account is already selected as the transfer source. Please enter a different destination account.
                      </span>
                    </div>
                  )}

                  {/* Notice Card: Unmatched / Invalid recipient */}
                  {!isVerifyingRecipient && serverRecipient?.status === "not_found" && pltAccountNumber.trim().length >= 4 && (
                    <div
                      role="status"
                      className="flex items-start gap-3 rounded-xl border border-border bg-surface/70 p-4 text-xs text-text-secondary animate-fade-in"
                    >
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                      <div className="flex-1 leading-relaxed">
                        No valid FHT recipient account matches that number. Please verify the account number and try again.
                      </div>
                    </div>
                  )}

                  {/* Rate Limit / Network Lookup Error */}
                  {lookupError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs text-danger animate-fade-in"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{lookupError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SAVED BENEFICIARIES */}
              {destinationTab === "beneficiary" && (
                <div className="flex flex-col gap-2.5">
                  {beneficiaries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center">
                      <Users className="h-8 w-8 text-text-tertiary mb-2" />
                      <p className="text-sm font-medium text-text-primary">No saved beneficiaries</p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Add a beneficiary to easily transfer funds without entering numbers every time.
                      </p>
                      <Link href="/beneficiaries" className="mt-3">
                        <Button variant="outline" size="sm">
                          Add Beneficiary
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    beneficiaries.map((b) => {
                      const isSelected = beneficiaryId === b.id;

                      return (
                        <label
                          key={b.id}
                          className={cn(
                            "group flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-150",
                            isSelected
                              ? "border-primary bg-primary-soft/30 ring-1 ring-primary/30 shadow-xs"
                              : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/60"
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-xs"
                                  : "bg-surface-hover text-text-secondary group-hover:text-text-primary"
                              )}
                            >
                              {b.type === "INTERNAL_PLT" ? (
                                <Landmark className="h-5 w-5" />
                              ) : (
                                <Building2 className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-semibold text-text-primary">
                                  {b.nickname}
                                </p>
                                <Badge
                                  variant={b.type === "INTERNAL_PLT" ? "primary" : "neutral"}
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {b.type === "INTERNAL_PLT" ? "FHT" : "External"}
                                </Badge>
                              </div>
                              <p className="truncate text-xs text-text-secondary">{b.accountName}</p>
                              <p className="font-mono text-xs text-text-tertiary financial-value">
                                {maskAccountNumber(b.accountNumber)}
                                {b.bankName ? ` · ${b.bankName}` : ""}
                              </p>
                            </div>
                          </div>

                          <input
                            type="radio"
                            name="beneficiary"
                            checked={isSelected}
                            onChange={() => setBeneficiaryId(b.id)}
                            className="h-4 w-4 text-primary focus:ring-primary ml-2"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              {/* TAB 3: OWN OTHER ACCOUNTS */}
              {destinationTab === "own_account" && (
                <div className="flex flex-col gap-2.5">
                  {accounts.filter((a) => a.id !== sourceAccountId).length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-text-secondary">
                      No other accounts available to receive funds.
                    </div>
                  ) : (
                    accounts
                      .filter((a) => a.id !== sourceAccountId)
                      .map((account) => {
                        const isSelected = destinationAccountId === account.id;
                        const displayName = accountDisplayName(account.nickname, account.type);

                        return (
                          <label
                            key={account.id}
                            className={cn(
                              "group flex cursor-pointer items-center justify-between rounded-xl border p-4 transition-all duration-150",
                              isSelected
                                ? "border-primary bg-primary-soft/30 ring-1 ring-primary/30 shadow-xs"
                                : "border-border bg-surface hover:border-border-strong hover:bg-surface-hover/60"
                            )}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div
                                className={cn(
                                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                                  isSelected
                                    ? "bg-primary text-primary-foreground shadow-xs"
                                    : "bg-surface-hover text-text-secondary group-hover:text-text-primary"
                                )}
                              >
                                <Landmark className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-text-primary">
                                  {displayName}
                                </p>
                                <p className="font-mono text-xs text-text-tertiary financial-value">
                                  {maskAccountNumber(account.accountNumber)} · {account.currencySymbol}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 shrink-0 pl-2">
                              <CurrencyValue
                                amount={account.balanceCache}
                                assetSymbol={account.currencySymbol}
                                className="font-bold text-sm text-text-primary financial-value"
                              />
                              <input
                                type="radio"
                                name="destinationAccount"
                                checked={isSelected}
                                onChange={() => setDestinationAccountId(account.id)}
                                className="h-4 w-4 text-primary focus:ring-primary"
                              />
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              )}

              <div className="mt-2 flex justify-end">
                <Button
                  size="lg"
                  disabled={!destination || isVerifyingRecipient}
                  onClick={() => setStep("amount")}
                  className="w-full gap-2 sm:w-auto font-medium"
                >
                  <span>Continue to Amount</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 3: AMOUNT & NARRATION ──────────────── */}
          {step === "amount" && sourceAccount && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-section-title font-semibold tracking-tight text-text-primary">
                  Transfer Amount
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Specify the amount to debit and optional reference notes.
                </p>
              </div>

              {/* Source Account Context Strip */}
              <div className="flex items-center justify-between rounded-xl border border-border bg-surface/70 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">
                      Sending from
                    </p>
                    <p className="text-xs font-semibold text-text-primary">
                      {accountDisplayName(sourceAccount.nickname, sourceAccount.type)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-text-tertiary font-medium uppercase tracking-wider">
                    Available
                  </p>
                  <CurrencyValue
                    amount={sourceAccount.balanceCache}
                    assetSymbol={sourceAccount.currencySymbol}
                    className="font-bold text-sm text-text-primary financial-value"
                  />
                </div>
              </div>

              {/* Amount Input with Currency Adornment */}
              <div className="flex flex-col gap-1.5">
                <TextField
                  label={`Transfer Amount (${sourceAccount.currencySymbol})`}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="financial-value text-lg font-bold"
                  hint={`Currency: ${sourceAccount.currencySymbol}. All funds are transferred in authoritative decimal units.`}
                />
              </div>

              {/* Narration Input */}
              <div className="flex flex-col gap-1.5">
                <TextField
                  label="Payment Reference / Narration (Optional)"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="e.g. Invoice #1042 or personal reimbursement"
                  maxLength={140}
                  hint={`${narration.length}/140 characters`}
                />
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  size="lg"
                  disabled={!amount || previewLoading}
                  onClick={goToReview}
                  className="w-full gap-2 sm:w-auto font-medium"
                >
                  {previewLoading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Calculating Quote...</span>
                    </>
                  ) : (
                    <>
                      <span>Review Transfer</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 4: REVIEW & CONFIRM ──────────────── */}
          {step === "review" && preview && sourceAccount && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-section-title font-semibold tracking-tight text-text-primary">
                  Review &amp; Authorize Transfer
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  Please verify all details carefully before authorizing with your PIN.
                </p>
              </div>

              {/* Amount Hero Card */}
              <div className="rounded-2xl border border-border bg-surface/60 p-5 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  Total Transfer Amount
                </p>
                <div className="mt-1">
                  <CurrencyValue
                    amount={preview.amount}
                    assetSymbol={preview.currency}
                    className="text-3xl sm:text-4xl font-bold tracking-tight text-text-primary financial-value"
                  />
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {Number(preview.fee) === 0
                    ? "Free · No transfer fee applied"
                    : `Fee: ${preview.fee} ${preview.currency} included`}
                </p>
              </div>

              {/* Authoritative Breakdown Table */}
              <div className="overflow-hidden rounded-xl border border-border divide-y divide-border/80 bg-surface/40">
                {[
                  {
                    label: "From Account",
                    value: accountDisplayName(sourceAccount.nickname, sourceAccount.type),
                    sub: maskAccountNumber(sourceAccount.accountNumber),
                  },
                  {
                    label: "Recipient",
                    value: preview.destinationLabel,
                  },
                  {
                    label: "Transfer Amount",
                    value: `${preview.amount} ${preview.currency}`,
                    mono: true,
                  },
                  {
                    label: "Platform Fee",
                    value: `${preview.fee} ${preview.currency}`,
                    mono: true,
                  },
                  {
                    label: "Total Debit",
                    value: `${preview.totalDebit} ${preview.currency}`,
                    mono: true,
                    highlight: true,
                  },
                  {
                    label: "Estimated Balance After",
                    value: `${preview.resultingBalance} ${preview.currency}`,
                    mono: true,
                  },
                  {
                    label: "Reference / Narration",
                    value: narration.trim() ? narration : "None provided",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={cn(
                      "flex items-center justify-between px-4 py-3 text-sm",
                      item.highlight && "bg-primary-soft/20 font-semibold"
                    )}
                  >
                    <span className="text-text-secondary text-xs sm:text-sm">{item.label}</span>
                    <div className="text-right">
                      <span
                        className={cn(
                          "text-text-primary",
                          item.mono && "font-mono financial-value font-medium",
                          item.highlight && "text-primary font-bold text-base"
                        )}
                      >
                        {item.value}
                      </span>
                      {item.sub && (
                        <p className="font-mono text-xs text-text-tertiary financial-value">{item.sub}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Insufficient Funds Warning */}
              {!preview.sufficientFunds && (
                <div
                  role="alert"
                  className="flex items-center gap-3 rounded-xl border border-danger/40 bg-danger-soft/40 p-4 text-xs font-semibold text-danger animate-fade-in"
                >
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <span>
                    Your available balance is lower than the total debit required for this transfer. Please adjust the amount or select a different account.
                  </span>
                </div>
              )}

              {/* Transaction PIN Authorization Box */}
              {submitting && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft/30 p-5 animate-fade-in">
                  <FiseLoader variant="inline" size="md" text="Processing transfer on ledger..." />
                  <p className="text-xs text-text-secondary">
                    Please wait while your transfer is being posted.
                  </p>
                </div>
              )}

              <div className={cn("rounded-xl border border-border bg-surface p-4 sm:p-5", submitting && "opacity-50")}>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">
                      Transaction PIN Authorization
                    </h3>
                    <p className="text-xs text-text-secondary">
                      Enter your 4-digit PIN to securely authorize this transfer.
                    </p>
                  </div>
                </div>

                <div className="max-w-xs">
                  <TextField
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

              <div className="mt-2 flex justify-end">
                <Button
                  size="lg"
                  variant="primary"
                  disabled={submitting || !preview.sufficientFunds || pin.length < 4}
                  onClick={confirmTransfer}
                  className="w-full gap-2 sm:w-auto font-medium shadow-sm"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      <span>Authorizing Transfer...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Authorize &amp; Send Transfer</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 5: RECEIPT / CONFIRMATION ──────────────── */}
          {step === "receipt" && (
            <div className="flex flex-col items-center gap-5 text-center py-4 sm:py-6 animate-fade-in">
              {/* Animated Success Badge */}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-success-soft text-success shadow-sm ring-8 ring-success-soft/40">
                <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
              </div>

              <div>
                <h2 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl">
                  Transfer Successful
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Your funds have been posted to the FHT double-entry ledger.
                </p>
              </div>


              {/* Receipt Summary Card */}
              {preview && (
                <div className="w-full max-w-md rounded-xl border border-border bg-surface/60 p-4 sm:p-5 text-left text-sm divide-y divide-border/60">
                  <div className="flex justify-between py-2">
                    <span className="text-text-secondary text-xs">Amount Sent</span>
                    <span className="font-mono font-bold text-text-primary financial-value">
                      {preview.amount} {preview.currency}
                    </span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-text-secondary text-xs">Destination</span>
                    <span className="font-medium text-text-primary">{preview.destinationLabel}</span>
                  </div>
                  {receiptId && (
                    <div className="flex items-center justify-between py-2">
                      <span className="text-text-secondary text-xs">Reference ID</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-text-tertiary financial-value">
                          {receiptId.slice(0, 14)}...
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyReceiptId()}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-colors"
                          title={receiptCopied ? "Copied!" : "Copy Reference ID"}
                          aria-label={receiptCopied ? "Copied" : "Copy Reference ID"}
                        >
                          {receiptCopied ? (
                            <Check className="h-3.5 w-3.5 text-success" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between py-2">
                    <span className="text-text-secondary text-xs">Status</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-3 flex w-full max-w-md flex-col gap-2.5 sm:flex-row">
                <Link href="/transactions" className="flex-1">
                  <Button variant="outline" size="md" className="w-full">
                    View in Transactions
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  size="md"
                  onClick={resetWizard}
                  className="flex-1 gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>New Transfer</span>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
