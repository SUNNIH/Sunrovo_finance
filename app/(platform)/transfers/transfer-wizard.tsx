"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronLeft, ShieldAlert } from "lucide-react";
import { postJson, postJsonIdempotent, ApiRequestError } from "@/lib/utilities/api-client";
import { generateClientId } from "@/lib/utilities/id";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CurrencyValue } from "@/components/financial/currency-value";
import { TextField } from "@/components/forms/text-field";
import { maskAccountNumber, BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";
import {
  resolveAuthorizedRecipient,
  type TransferAccountOption,
  type TransferBeneficiaryOption,
} from "@/lib/utilities/transfer-recipient";
import type { TransferPreview } from "@/features/banking/transfers";

type AccountView = TransferAccountOption;
type BeneficiaryView = TransferBeneficiaryOption;

type Step = "source" | "destination" | "amount" | "review" | "receipt";

interface TransferWizardProps {
  accounts: AccountView[];
  beneficiaries: BeneficiaryView[];
  initialSourceAccountId?: string;
}

export function TransferWizard({ accounts, beneficiaries, initialSourceAccountId }: TransferWizardProps) {
  const [step, setStep] = React.useState<Step>("source");
  const [sourceAccountId, setSourceAccountId] = React.useState<string | undefined>(
    initialSourceAccountId ?? accounts.find((a) => a.type === "CURRENT")?.id ?? accounts[0]?.id
  );
  const [destinationTab, setDestinationTab] = React.useState<"plt_number" | "own_account" | "beneficiary">(
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
  const idempotencyKeyRef = React.useRef<string | null>(null);
  if (idempotencyKeyRef.current === null) {
    idempotencyKeyRef.current = generateClientId();
  }

  const sourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const recipientMatch = resolveAuthorizedRecipient(
    pltAccountNumber,
    sourceAccountId,
    accounts,
    beneficiaries
  );

  const destination =
    destinationTab === "plt_number"
      ? recipientMatch.status === "own_account"
        ? { kind: "own_account" as const, destinationAccountId: recipientMatch.account.id }
        : recipientMatch.status === "beneficiary"
          ? { kind: "beneficiary" as const, beneficiaryId: recipientMatch.beneficiary.id }
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
        { sourceAccountId, destination, amount, narration: narration || undefined, transactionPin: pin },
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
    setAmount("");
    setNarration("");
    setPin("");
    setPreview(null);
    setReceiptId(null);
    setError(null);
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-sm text-text-secondary">
          You don&rsquo;t have any accounts to transfer from yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="p-6">
        {step !== "source" && step !== "receipt" && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep((s) => (s === "destination" ? "source" : s === "amount" ? "destination" : "amount"));
            }}
            className="mb-4 inline-flex min-h-touch items-center gap-1 text-sm font-medium text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
        )}

        {error && (
          <p role="alert" className="mb-4 text-body-sm text-danger">
            {error}
          </p>
        )}

        {step === "source" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-section-title text-text-primary">Send from</h2>
            <div className="flex flex-col gap-2">
              {accounts.map((account) => (
                <label
                  key={account.id}
                  className={`flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors duration-150 ${
                    sourceAccountId === account.id
                      ? "border-primary bg-primary-soft/40"
                      : "border-border hover:border-border-strong hover:bg-surface-hover/60"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="source"
                      checked={sourceAccountId === account.id}
                      onChange={() => setSourceAccountId(account.id)}
                      className="h-4 w-4 text-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-text-primary">
                        {account.nickname ?? BANK_ACCOUNT_TYPE_LABELS[account.type]}
                      </span>
                      <span className="block text-body-sm text-text-secondary financial-value">
                        {maskAccountNumber(account.accountNumber)}
                      </span>
                    </span>
                  </span>
                  <CurrencyValue
                    amount={account.balanceCache}
                    assetSymbol={account.currencySymbol}
                    className="text-sm font-semibold text-text-primary"
                  />
                </label>
              ))}
            </div>
            <Button
              size="lg"
              disabled={!sourceAccountId}
              onClick={() => setStep("destination")}
              className="mt-2 w-fit"
            >
              Continue
            </Button>
          </div>
        )}

        {step === "destination" && (
          <div className="flex flex-col gap-4">
            <h2 className="text-section-title text-text-primary">Send to</h2>
            <div className="flex gap-1 overflow-x-auto border-b border-border">
              {(
                [
                  ["plt_number", "PLT account number"],
                  ["beneficiary", "Beneficiary"],
                  ["own_account", "My other accounts"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDestinationTab(id)}
                  className={`whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    destinationTab === id
                      ? "border-b-2 border-primary text-primary"
                      : "border-b-2 border-transparent text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {destinationTab === "plt_number" && (
              <div className="flex flex-col gap-3">
                <TextField
                  id="plt-account-number"
                  label="Recipient account number"
                  value={pltAccountNumber}
                  onChange={(e) => setPltAccountNumber(e.target.value)}
                  placeholder="Enter a unique PLT account number"
                  autoComplete="off"
                  spellCheck={false}
                  className="financial-value"
                  hint="Recipient details appear only for your other accounts or saved beneficiaries."
                />
                {recipientMatch.status === "own_account" && (
                  <div
                    role="status"
                    className="rounded-md border border-success/40 bg-success-soft px-4 py-3 animate-fade-in"
                  >
                    <p className="text-label uppercase tracking-wide text-success">Your account</p>
                    <p className="mt-1 text-sm font-medium text-text-primary">{recipientMatch.label}</p>
                    <p className="mt-0.5 text-body-sm text-text-secondary financial-value">
                      {recipientMatch.maskedNumber} · {recipientMatch.account.currencySymbol}
                    </p>
                  </div>
                )}
                {recipientMatch.status === "beneficiary" && (
                  <div
                    role="status"
                    className="rounded-md border border-primary/40 bg-primary-soft/50 px-4 py-3 animate-fade-in"
                  >
                    <p className="text-label uppercase tracking-wide text-primary">Saved beneficiary</p>
                    <p className="mt-1 text-sm font-medium text-text-primary">{recipientMatch.label}</p>
                    <p className="mt-0.5 text-body-sm text-text-secondary">
                      {recipientMatch.beneficiary.accountName}
                    </p>
                    <p className="mt-0.5 text-body-sm text-text-secondary financial-value">
                      {recipientMatch.maskedNumber}
                      {recipientMatch.beneficiary.bankName
                        ? ` · ${recipientMatch.beneficiary.bankName}`
                        : ""}
                    </p>
                  </div>
                )}
                {recipientMatch.status === "own_source" && (
                  <p role="alert" className="text-body-sm text-danger">
                    Choose a different destination from the account you are sending from.
                  </p>
                )}
                {recipientMatch.status === "none" && (
                  <p role="status" className="text-body-sm text-text-secondary">
                    No authorized recipient matches that number.{" "}
                    <Link href="/beneficiaries" className="font-medium text-primary hover:underline">
                      Save a beneficiary
                    </Link>{" "}
                    before sending to a new PLT account.
                  </p>
                )}
              </div>
            )}

            {destinationTab === "beneficiary" && (
              <div className="flex flex-col gap-2">
                {beneficiaries.length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-secondary">
                    No saved beneficiaries yet.{" "}
                    <Link href="/beneficiaries" className="font-medium text-primary hover:underline">
                      Add one
                    </Link>
                    .
                  </p>
                ) : (
                  beneficiaries.map((b) => (
                    <label
                      key={b.id}
                      className={`flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors duration-150 ${
                        beneficiaryId === b.id
                          ? "border-primary bg-primary-soft/40"
                          : "border-border hover:border-border-strong hover:bg-surface-hover/60"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="beneficiary"
                          checked={beneficiaryId === b.id}
                          onChange={() => setBeneficiaryId(b.id)}
                          className="h-4 w-4 text-primary"
                        />
                        <span>
                          <span className="block text-sm font-medium text-text-primary">{b.nickname}</span>
                          <span className="block text-body-sm text-text-secondary">{b.accountName}</span>
                        </span>
                      </span>
                      <Badge variant={b.type === "INTERNAL_PLT" ? "primary" : "neutral"}>
                        {b.type === "INTERNAL_PLT" ? "PLT" : "External"}
                      </Badge>
                    </label>
                  ))
                )}
              </div>
            )}

            {destinationTab === "own_account" && (
              <div className="flex flex-col gap-2">
                {accounts.filter((a) => a.id !== sourceAccountId).length === 0 ? (
                  <p className="py-4 text-center text-sm text-text-secondary">No other accounts available.</p>
                ) : (
                  accounts
                    .filter((a) => a.id !== sourceAccountId)
                    .map((account) => (
                      <label
                        key={account.id}
                        className={`flex cursor-pointer items-center justify-between rounded-md border p-3 transition-colors duration-150 ${
                          destinationAccountId === account.id
                            ? "border-primary bg-primary-soft/40"
                            : "border-border hover:border-border-strong hover:bg-surface-hover/60"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="destinationAccount"
                            checked={destinationAccountId === account.id}
                            onChange={() => setDestinationAccountId(account.id)}
                            className="h-4 w-4 text-primary"
                          />
                          <span className="block text-sm font-medium text-text-primary">
                            {account.nickname ?? BANK_ACCOUNT_TYPE_LABELS[account.type]}
                          </span>
                        </span>
                        <CurrencyValue
                          amount={account.balanceCache}
                          assetSymbol={account.currencySymbol}
                          className="text-sm font-semibold text-text-primary"
                        />
                      </label>
                    ))
                )}
              </div>
            )}

            <Button size="lg" disabled={!destination} onClick={() => setStep("amount")} className="mt-2 w-fit">
              Continue
            </Button>
          </div>
        )}

        {step === "amount" && sourceAccount && (
          <div className="flex flex-col gap-4">
            <h2 className="text-section-title text-text-primary">Amount</h2>
            <TextField
              label={`Amount (${sourceAccount.currencySymbol})`}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="financial-value"
            />
            <TextField
              label="Narration (optional)"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Payment for services"
              maxLength={140}
            />
            <Button
              size="lg"
              disabled={!amount || previewLoading}
              onClick={goToReview}
              className="mt-2 w-fit"
            >
              {previewLoading ? "Checking..." : "Review transfer"}
            </Button>
          </div>
        )}

        {step === "review" && preview && sourceAccount && (
          <div className="flex flex-col gap-4">
            <h2 className="text-section-title text-text-primary">Review &amp; confirm</h2>
            <div className="flex flex-col divide-y divide-border rounded-md border border-border">
              {[
                ["From", sourceAccount.nickname ?? BANK_ACCOUNT_TYPE_LABELS[sourceAccount.type]],
                ["To", preview.destinationLabel],
                ["Amount", `${preview.amount} ${preview.currency}`],
                ["Fee", `${preview.fee} ${preview.currency}`],
                ["Total debit", `${preview.totalDebit} ${preview.currency}`],
                ["Balance after", `${preview.resultingBalance} ${preview.currency}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="text-text-secondary">{label}</span>
                  <span className="financial-value font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </div>

            {!preview.sufficientFunds && (
              <p role="alert" className="flex items-center gap-2 text-body-sm text-danger">
                <ShieldAlert className="h-4 w-4" /> Your available balance is lower than the amount required for
                this transaction.
              </p>
            )}

            <TextField
              label="Transaction PIN"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••"
              className="max-w-[160px] financial-value"
            />

            <Button
              size="lg"
              variant="primary"
              disabled={submitting || !preview.sufficientFunds || pin.length < 4}
              onClick={confirmTransfer}
              className="w-fit"
            >
              {submitting ? "Processing..." : "Confirm transfer"}
            </Button>
          </div>
        )}

        {step === "receipt" && (
          <div className="flex flex-col items-center gap-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-success" aria-hidden="true" />
            <h2 className="text-section-title text-text-primary">Transfer complete</h2>
            <Badge variant="warning">Demo receipt — no real funds were transferred</Badge>
            {preview && (
              <div className="w-full max-w-xs rounded-md border border-border p-4 text-left text-sm">
                <p className="flex justify-between py-1">
                  <span className="text-text-secondary">Amount</span>
                  <span className="financial-value font-medium">{preview.amount} {preview.currency}</span>
                </p>
                <p className="flex justify-between py-1">
                  <span className="text-text-secondary">To</span>
                  <span className="font-medium">{preview.destinationLabel}</span>
                </p>
                <p className="flex justify-between py-1">
                  <span className="text-text-secondary">Reference</span>
                  <span className="financial-value text-text-tertiary">{receiptId?.slice(0, 12)}</span>
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Link href="/transactions">
                <Button variant="outline">View history</Button>
              </Link>
              <Button onClick={resetWizard}>New transfer</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
