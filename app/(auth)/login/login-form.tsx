"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { SignupCard } from "@/components/auth/signup-card";
import { TextField } from "@/components/forms/text-field";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { REGISTRATION_ENABLED } from "@/lib/feature-flags";

interface LoginResponse {
  status: "success" | "mfa_required";
}

const fieldClassName =
  "h-12 rounded-lg bg-background shadow-sm transition-[border-color,box-shadow,background-color] duration-200 " +
  "focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20";

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { rememberDevice: false },
  });

  async function onSubmit(values: LoginInput) {
    setServerError(null);
    try {
      const result = await postJson<LoginResponse>("/api/auth/login", values);
      if (result.status === "mfa_required") {
        router.push("/mfa");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  return (
    <SignupCard
      eyebrow="Returning customer"
      title="Sign in to your account"
      description="Enter your credentials to access your FHT accounts, transfers, and wallets."
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        aria-busy={isSubmitting}
        className="flex flex-col gap-5"
      >
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
            autoComplete="current-password"
            error={errors.password?.message}
            disabled={isSubmitting}
            className={fieldClassName}
            {...register("password")}
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-sm text-text-secondary">
          <input
            type="checkbox"
            disabled={isSubmitting}
            className="mt-0.5 h-4 w-4 rounded border-border-strong text-primary transition-shadow duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            {...register("rememberDevice")}
          />
          Remember this device
        </label>

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
              Signing in...
            </>
          ) : (
            "Sign In"
          )}
        </Button>

        {REGISTRATION_ENABLED && (
          <p className="text-center text-sm text-text-secondary">
            Don&rsquo;t have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        )}
      </form>
    </SignupCard>
  );
}
