"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setServerError(null);
    try {
      await postJson("/api/auth/forgot-password", values);
      setSubmitted(true);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  if (submitted) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <MailCheck className="h-10 w-10 text-primary" aria-hidden="true" />
          <h1 className="text-section-title text-text-primary">Check your email</h1>
          <p className="text-sm text-text-secondary">
            If an account exists for that address, we&rsquo;ve sent a link to reset your password.
            It expires in 30 minutes.
          </p>
          <Link href="/login" className="mt-2">
            <Button variant="outline">Back to sign in</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary">Reset your password</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Enter the email address on your account and we&rsquo;ll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        {serverError && (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" disabled={isSubmitting} className="mt-1">
          {isSubmitting ? "Sending..." : "Send reset link"}
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
