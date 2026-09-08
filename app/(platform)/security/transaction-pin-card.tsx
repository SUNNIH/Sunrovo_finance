"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
} from "lucide-react";
import { setTransactionPinSchema, type SetTransactionPinInput } from "@/lib/validation/banking";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TransactionPinCardProps {
  initialPinSet: boolean;
}

export function TransactionPinCard({ initialPinSet }: TransactionPinCardProps) {
  const [pinSet, setPinSet] = React.useState(initialPinSet);
  const [editing, setEditing] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SetTransactionPinInput>({
    resolver: zodResolver(setTransactionPinSchema),
  });

  async function onSubmit(values: SetTransactionPinInput) {
    setServerError(null);
    setSuccessMessage(null);
    try {
      await postJson("/api/security/transaction-pin", values);
      setPinSet(true);
      setEditing(false);
      reset();
      setSuccessMessage("Transaction PIN saved successfully.");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      setServerError(err instanceof ApiRequestError ? err.message : "Failed to set transaction PIN. Please try again.");
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Transaction PIN</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Required to authorize withdrawals, account transfers, and sensitive operations.
            </CardDescription>
          </div>
        </div>
        <div className="shrink-0">
          <Badge
            variant={pinSet ? "success" : "warning"}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs"
          >
            {pinSet ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                <span>Configured</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                <span>Not Set</span>
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {successMessage && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft/30 p-3.5 text-xs font-medium text-success animate-fade-in"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{serverError}</span>
          </div>
        )}

        {!editing ? (
          <div>
            <p className="text-xs text-text-secondary mb-3 leading-relaxed">
              {pinSet
                ? "Your transaction PIN is active and protecting your financial actions."
                : "You have not configured a transaction PIN. Financial operations will be blocked until a PIN is established."}
            </p>
            <Button
              type="button"
              variant={pinSet ? "outline" : "primary"}
              onClick={() => {
                setEditing(true);
                setServerError(null);
                setSuccessMessage(null);
              }}
              className="touch-target gap-2 font-medium"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              <span>{pinSet ? "Change Transaction PIN" : "Set Transaction PIN"}</span>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-sm flex-col gap-4 animate-fade-in">
            <TextField
              id="new-pin"
              label="New PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              className="font-mono tracking-widest text-center text-lg financial-value max-w-[180px]"
              autoComplete="off"
              error={errors.pin?.message}
              {...register("pin")}
            />

            <TextField
              id="confirm-pin"
              label="Confirm PIN"
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="••••"
              className="font-mono tracking-widest text-center text-lg financial-value max-w-[180px]"
              autoComplete="off"
              error={errors.confirmPin?.message}
              {...register("confirmPin")}
            />

            <PasswordField
              id="pin-current-password"
              label="Current Password"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...register("currentPassword")}
            />

            <div className="flex gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  reset();
                  setServerError(null);
                }}
                className="touch-target"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="touch-target gap-2 font-medium"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Saving PIN...</span>
                  </>
                ) : (
                  <span>Save Transaction PIN</span>
                )}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
