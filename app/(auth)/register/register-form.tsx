"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { SignupCard } from "@/components/auth/signup-card";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";

const fieldClassName =
  "h-12 rounded-lg bg-background shadow-sm transition-[border-color,box-shadow,background-color] duration-200 " +
  "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20";

function PasswordLengthMeter({ value }: { value: string }) {
  const length = value.length;
  const ratio = Math.min(length / 10, 1);
  const label =
    length === 0
      ? "Enter at least 10 characters"
      : length < 10
        ? `${10 - length} more characters`
        : "Length requirement met";

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={
            ratio >= 1
              ? "h-full rounded-full bg-success transition-[width] duration-200"
              : "h-full rounded-full bg-primary transition-[width] duration-200"
          }
          style={{ width: `${Math.max(ratio * 100, length > 0 ? 8 : 0)}%` }}
        />
      </div>
      <p className="text-body-sm text-text-secondary">{label}</p>
    </div>
  );
}

export function RegisterForm() {
  const [submittedEmail, setSubmittedEmail] = React.useState<string | null>(null);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const passwordValue = watch("password") ?? "";

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    try {
      const result = await postJson<{ email: string }>("/api/auth/register", values);
      setSubmittedEmail(result.email);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  if (submittedEmail) {
    return (
      <SignupCard
        eyebrow="Almost there"
        title="Check your email"
        titleAs="h1"
        description={`We sent a verification link to ${submittedEmail}. Click it to activate your account, then sign in.`}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
          <Link href="/login" className="w-full">
            <Button variant="outline" className="w-full">
              Back to sign in
            </Button>
          </Link>
        </div>
      </SignupCard>
    );
  }

  return (
    <SignupCard
      title="Create your account"
      description="Open a PLT profile to manage accounts, transfers, and wallets in one secure place."
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-busy={isSubmitting}
        className="flex flex-col gap-5"
      >
        <TextField
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          disabled={isSubmitting}
          className={fieldClassName}
          {...register("fullName")}
        />
        <TextField
          label="Email address"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          disabled={isSubmitting}
          className={fieldClassName}
          {...register("email")}
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            label="Password"
            autoComplete="new-password"
            error={errors.password?.message}
            disabled={isSubmitting}
            className={fieldClassName}
            {...register("password")}
          />
          <PasswordLengthMeter value={passwordValue} />
        </div>
        <PasswordField
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          disabled={isSubmitting}
          className={fieldClassName}
          {...register("confirmPassword")}
        />

        <label className="flex items-start gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-border-strong text-primary transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            {...register("acceptedTerms")}
          />
          <span>
            I agree to the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptedTerms && (
          <p role="alert" className="-mt-3 text-body-sm text-danger animate-slide-up">
            {errors.acceptedTerms.message}
          </p>
        )}

        {serverError && (
          <p role="alert" className="text-body-sm text-danger animate-slide-up">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="mt-1 w-full shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </SignupCard>
  );
}
