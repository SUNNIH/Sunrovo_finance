"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { changePasswordSchema, type ChangePasswordInput } from "@/lib/validation/treasury";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ChangePasswordCard() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(values: ChangePasswordInput) {
    setServerError(null);
    try {
      await postJson("/api/security/change-password", values);
      setDone(true);
      reset();
      // Changing the password revokes all active sessions on the backend.
      setTimeout(() => router.push("/login"), 1800);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Failed to update password. Please try again.");
    }
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-text-primary">Change Password</CardTitle>
            <CardDescription className="text-xs text-text-secondary mt-0.5">
              Updating your password will immediately sign you out of all active sessions.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {done ? (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-xl border border-success/30 bg-success-soft/30 p-4 text-xs font-medium text-success animate-fade-in"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Password updated successfully. Redirecting you to sign in...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-sm flex-col gap-4">
            <PasswordField
              label="Current Password"
              id="current-password"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...register("currentPassword")}
            />
            <PasswordField
              label="New Password"
              id="new-password"
              autoComplete="new-password"
              hint="Must be at least 10 characters"
              error={errors.newPassword?.message}
              {...register("newPassword")}
            />
            <PasswordField
              label="Confirm New Password"
              id="confirm-new-password"
              autoComplete="new-password"
              error={errors.confirmNewPassword?.message}
              {...register("confirmNewPassword")}
            />

            {serverError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger-soft/40 p-3.5 text-xs font-medium text-danger animate-fade-in"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{serverError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="touch-target mt-1 w-full gap-2 sm:w-auto font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
