"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound } from "lucide-react";
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
      // Changing the password revokes every session, including this one.
      setTimeout(() => router.push("/login"), 1500);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Change password
        </CardTitle>
        <CardDescription>You&rsquo;ll be signed out everywhere after changing it.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <p className="text-sm text-success">Password updated. Redirecting you to sign in...</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-w-sm flex-col gap-3">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              error={errors.currentPassword?.message}
              {...register("currentPassword")}
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              hint="At least 10 characters"
              error={errors.newPassword?.message}
              {...register("newPassword")}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              error={errors.confirmNewPassword?.message}
              {...register("confirmNewPassword")}
            />
            {serverError && (
              <p role="alert" className="text-body-sm text-danger">
                {serverError}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-fit">
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
