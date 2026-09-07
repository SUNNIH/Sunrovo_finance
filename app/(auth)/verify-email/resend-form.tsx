"use client";

import * as React from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") });
type Values = z.infer<typeof schema>;

export function ResendVerificationForm() {
  const [sent, setSent] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Values) {
    setServerError(null);
    try {
      await postJson("/api/auth/resend-verification", values);
      setSent(true);
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-text-secondary">
        If that account needs verifying, a new link is on its way.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
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
      <Button type="submit" variant="outline" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Resend verification email"}
      </Button>
    </form>
  );
}
