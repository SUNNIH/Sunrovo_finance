"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import {
  onboardingSchema,
  type OnboardingInput,
  SUPPORTED_FIAT_CURRENCIES,
  ACCOUNT_TYPES,
} from "@/lib/validation/auth";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const COUNTRIES = [
  "Nigeria", "United States", "United Kingdom", "Canada", "Germany", "France",
  "Ghana", "Kenya", "South Africa", "India", "United Arab Emirates", "Ireland",
];

const STEPS = ["About you", "Preferences", "Verify identity"] as const;

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [verifying, setVerifying] = React.useState(false);
  const [verified, setVerified] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    trigger,
    formState: { errors },
  } = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { preferredFiatCurrency: "USD", accountType: "individual" },
  });

  async function goNext() {
    const fieldsByStep: Array<Array<keyof OnboardingInput>> = [
      ["country", "phoneNumber"],
      ["preferredFiatCurrency", "accountType", "dateOfBirth"],
    ];
    const valid = await trigger(fieldsByStep[step]);
    if (!valid) return;

    if (step === 1) {
      // Enter the identity-verification step and run the simulated check.
      setStep(2);
      setVerifying(true);
      setTimeout(() => {
        setVerifying(false);
        setVerified(true);
      }, 1400);
      return;
    }
    setStep((s) => s + 1);
  }

  async function onSubmit(values: OnboardingInput) {
    setServerError(null);
    setSubmitting(true);
    try {
      await postJson("/api/onboarding", values);
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      setServerError(error instanceof ApiRequestError ? error.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="mb-6 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 flex-col gap-1.5">
              <div
                className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`}
                aria-hidden="true"
              />
              <span className="hidden text-label text-text-tertiary sm:block">{label}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-section-title text-text-primary">Tell us about yourself</h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="country" className="text-sm font-medium text-text-primary">
                  Country
                </label>
                <select
                  id="country"
                  className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("country")}
                >
                  <option value="">Select your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                {errors.country && (
                  <p role="alert" className="text-body-sm text-danger">
                    {errors.country.message}
                  </p>
                )}
              </div>
              <TextField
                label="Phone number"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 123 4567"
                error={errors.phoneNumber?.message}
                {...register("phoneNumber")}
              />
              <Button type="button" size="lg" onClick={goNext} className="mt-2">
                Continue
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-section-title text-text-primary">Account preferences</h2>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="preferredFiatCurrency" className="text-sm font-medium text-text-primary">
                  Preferred currency
                </label>
                <select
                  id="preferredFiatCurrency"
                  className="h-11 rounded-md border border-border bg-surface px-3 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register("preferredFiatCurrency")}
                >
                  {SUPPORTED_FIAT_CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-primary">Account type</span>
                <div className="flex gap-4">
                  {ACCOUNT_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm text-text-secondary capitalize">
                      <input type="radio" value={type} className="h-4 w-4 text-primary" {...register("accountType")} />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <TextField
                label="Date of birth"
                type="date"
                error={errors.dateOfBirth?.message}
                {...register("dateOfBirth")}
              />

              <div className="mt-2 flex gap-2">
                <Button type="button" variant="outline" size="lg" onClick={() => setStep(0)}>
                  Back
                </Button>
                <Button type="button" size="lg" onClick={goNext} className="flex-1">
                  Continue
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-4 text-center">
              <ShieldCheck className="h-10 w-10 text-primary" aria-hidden="true" />
              <h2 className="text-section-title text-text-primary">Identity verification</h2>

              {verifying && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                  <p className="text-sm text-text-secondary">Reviewing your details...</p>
                </div>
              )}

              {verified && (
                <div className="flex flex-col items-center gap-2 py-2">
                  <CheckCircle2 className="h-8 w-8 text-success" aria-hidden="true" />
                  <p className="text-sm text-text-secondary">
                    Your details have been confirmed for account setup.
                  </p>
                </div>
              )}

              {serverError && (
                <p role="alert" className="text-body-sm text-danger">
                  {serverError}
                </p>
              )}

              <Button type="submit" size="lg" disabled={!verified || submitting} className="w-full">
                {submitting ? "Setting up your accounts..." : "Continue to dashboard"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
