"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validation/auth";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    try {
      await postJson("/api/auth/reset-password", values);
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <h1 className="text-section-title text-text-primary">Password updated</h1>
        <p className="mt-2 text-sm text-text-secondary">Redirecting you to sign in...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary">Set a new password</h1>
        <p className="mt-1 text-sm text-text-secondary">Choose a strong password you haven&rsquo;t used before.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <input type="hidden" {...register("token")} />
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint="At least 10 characters"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        {serverError && (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? "Updating..." : "Update password"}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
