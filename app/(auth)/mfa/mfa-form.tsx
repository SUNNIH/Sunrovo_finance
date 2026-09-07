"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { mfaVerifySchema, type MfaVerifyInput } from "@/lib/validation/auth";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";

export function MfaForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MfaVerifyInput>({
    resolver: zodResolver(mfaVerifySchema),
    defaultValues: { rememberDevice: false },
  });

  async function onSubmit(values: MfaVerifyInput) {
    setServerError(null);
    try {
      await postJson("/api/auth/mfa/verify", values);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center text-center">
        <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
        <h1 className="mt-3 text-page-title-mobile text-text-primary">Two-factor verification</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Enter the 6-digit code from your authenticator app.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          className="text-center text-lg tracking-[0.5em] financial-value"
          error={errors.code?.message}
          {...register("code")}
        />

        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border-strong text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            {...register("rememberDevice")}
          />
          Remember this device for 30 days
        </label>

        {serverError && (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? "Verifying..." : "Verify and continue"}
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
