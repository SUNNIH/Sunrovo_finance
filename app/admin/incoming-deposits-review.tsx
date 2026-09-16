"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

export type PendingDepositItem = {
  id: string;
  userId: string;
  amount: string;
  assetSymbol: string;
  status: string;
  bankAccountId: string | null;
  sendingBank: string | null;
  senderName: string | null;
  transferReference: string | null;
  customerNote: string | null;
  createdAt: string;
  user: {
    email: string;
    profile: {
      fullName: string | null;
    } | null;
  };
  bankAccount: {
    accountNumber: string;
    nickname: string | null;
    currencySymbol: string;
  } | null;
};

export function formatCustomerDisplay(user: PendingDepositItem["user"]): string {
  const name = user.profile?.fullName?.trim();
  return name ? `${name} (${user.email})` : user.email;
}

export function formatDestinationAccount(bankAccount: PendingDepositItem["bankAccount"]): string {
  if (!bankAccount) return "N/A";
  if (bankAccount.nickname) {
    return `${bankAccount.nickname} (${bankAccount.accountNumber})`;
  }
  return bankAccount.accountNumber;
}

export function validateRejectionReason(
  reason: string | null | undefined
): { isValid: boolean; reason?: string; error?: string } {
  if (reason === null || reason === undefined) {
    return { isValid: false };
  }
  const trimmed = reason.trim();
  if (!trimmed) {
    return { isValid: false, error: "A non-empty rejection reason is required." };
  }
  return { isValid: true, reason: trimmed };
}

export function createReviewPayload(
  depositId: string,
  action: "APPROVE" | "REJECT",
  rejectionReason?: string
) {
  if (action === "APPROVE") {
    return { depositId, action: "APPROVE" as const };
  }
  return {
    depositId,
    action: "REJECT" as const,
    rejectionReason: rejectionReason?.trim(),
  };
}

export function IncomingDepositsReview() {
  const [deposits, setDeposits] = React.useState<PendingDepositItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const loadDeposits = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/deposits").then((r) => r.json());
      setDeposits(response.data?.deposits ?? []);
    } catch {
      setError("Could not load pending incoming bank transfers.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadDeposits();
  }, [loadDeposits]);

  async function handleApprove(deposit: PendingDepositItem) {
    setError(null);
    setSuccess(null);

    const confirmed = window.confirm(
      `Are you sure you want to APPROVE this incoming transfer of ${deposit.amount} ${deposit.assetSymbol} from ${deposit.sendingBank ?? "bank"} (Ref: ${deposit.transferReference ?? "N/A"})?\n\nThis will verify the transfer and credit the customer's account balance.`
    );
    if (!confirmed) return;

    setProcessingId(deposit.id);
    try {
      const payload = createReviewPayload(deposit.id, "APPROVE");
      await postJson("/api/admin/deposits", payload);
      setSuccess(
        `Incoming transfer of ${deposit.amount} ${deposit.assetSymbol} approved and credited.`
      );
      await loadDeposits();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to approve transfer. Please try again."
      );
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(deposit: PendingDepositItem) {
    setError(null);
    setSuccess(null);

    const inputReason = window.prompt(
      `Enter rejection reason for incoming transfer of ${deposit.amount} ${deposit.assetSymbol} (shown to customer):`
    );
    const validation = validateRejectionReason(inputReason);
    if (!validation.isValid) {
      if (validation.error) {
        setError(validation.error);
      }
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to REJECT this incoming transfer?\n\nReason: "${validation.reason}"`
    );
    if (!confirmed) return;

    setProcessingId(deposit.id);
    try {
      const payload = createReviewPayload(deposit.id, "REJECT", validation.reason);
      await postJson("/api/admin/deposits", payload);
      setSuccess(`Incoming transfer of ${deposit.amount} ${deposit.assetSymbol} has been rejected.`);
      await loadDeposits();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Failed to reject transfer. Please try again."
      );
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <Card className="border-border bg-surface-elevated">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base font-semibold text-text-primary sm:text-lg">
          Pending Incoming Bank Transfers ({deposits.length})
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={loadDeposits}
          disabled={loading || Boolean(processingId)}
          className="gap-1.5 text-xs"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          <span>Refresh</span>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {success && (
          <p
            role="status"
            className="rounded-md bg-success-soft p-3 text-sm font-medium text-success"
          >
            {success}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}

        {deposits.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">
            {loading ? "Loading incoming transfers..." : "No incoming bank transfers need review."}
          </p>
        ) : (
          deposits.map((deposit) => {
            const isProcessing = processingId === deposit.id;
            const isAnyProcessing = Boolean(processingId);

            return (
              <div
                key={deposit.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex flex-col gap-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="financial-value font-mono text-base font-bold text-text-primary sm:text-lg">
                      {deposit.amount} {deposit.assetSymbol}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Pending verification
                    </span>
                  </div>

                  <p className="text-sm text-text-secondary">
                    <strong className="text-text-primary">Customer:</strong>{" "}
                    {formatCustomerDisplay(deposit.user)}
                  </p>

                  <p className="text-sm text-text-secondary">
                    <strong className="text-text-primary">Destination FHT Account:</strong>{" "}
                    {formatDestinationAccount(deposit.bankAccount)}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
                    <span>
                      <strong className="text-text-primary">Sending Bank:</strong>{" "}
                      {deposit.sendingBank ?? "N/A"}
                    </span>
                    <span>
                      <strong className="text-text-primary">Sender:</strong>{" "}
                      {deposit.senderName ?? "N/A"}
                    </span>
                    <span>
                      <strong className="text-text-primary">Transfer Reference:</strong>{" "}
                      <span className="font-mono">{deposit.transferReference ?? "N/A"}</span>
                    </span>
                  </div>

                  {deposit.customerNote && (
                    <p className="text-xs text-text-secondary italic">
                      Note: &ldquo;{deposit.customerNote}&rdquo;
                    </p>
                  )}

                  <p className="text-[11px] text-text-tertiary">
                    Requested: {new Date(deposit.createdAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 sm:pt-0 sm:self-center shrink-0">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleApprove(deposit)}
                    disabled={isAnyProcessing}
                    className="font-medium shadow-xs"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      "Approve"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleReject(deposit)}
                    disabled={isAnyProcessing}
                    className="font-medium"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
