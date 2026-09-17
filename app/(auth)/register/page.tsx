import type { Metadata } from "next";
import Image from "next/image";
import { AuthBackground } from "@/components/auth/auth-background";
import { AuthFeatureList } from "@/components/auth/auth-feature-list";
import { SignedInAuthChoice } from "@/components/auth/signed-in-auth-choice";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create Account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();

  // If user is already authenticated, show the "already signed in" choice
  // instead of redirecting or showing the registration form
  if (user) {
    const continueDestination = user.profile?.onboardingCompletedAt ? "/dashboard" : "/onboarding";
    const continueLabel = user.profile?.onboardingCompletedAt
      ? "Continue to Dashboard"
      : "Continue Setup";

    return (
      <div data-auth-split className="relative w-full animate-fade-in">
        <AuthBackground />

        <div className="relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
          <section className="animate-fade-in-up max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              FISE Holdings Trust Bank
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
              Banking built for the next generation
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
              You are already signed in. Continue to your account or sign out to create another account.
            </p>
            <AuthFeatureList />
          </section>

          <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
            <SignedInAuthChoice
              userEmail={user.email}
              continueDestination={continueDestination}
              continueLabel={continueLabel}
              signOutAction="register"
              signOutLabel="Sign out and create another account"
              title="You are already signed in"
              description="Continue to your account or sign out to create a different account."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-auth-split className="relative w-full animate-fade-in">
      <AuthBackground />

      <div className="relative grid w-full grid-cols-1 items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
        {/* Human lifestyle visual panel */}
        <section
          aria-label="Welcome to FISE Holdings Trust Bank"
          className="relative w-full overflow-hidden rounded-2xl border border-border/70 bg-surface-elevated shadow-lg h-40 sm:h-52 lg:h-full lg:min-h-[640px] flex flex-col justify-between"
        >
          <Image
            src="/images/auth/signup-people.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority
            className="object-cover object-center"
          />

          {/* Subtle navy / blue overlay preserving FHT white/blue branding */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/45 to-blue-950/35"
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 bg-primary/10 mix-blend-overlay"
            aria-hidden="true"
          />

          {/* Minimal overlay branding and caption */}
          <div className="relative z-10 flex h-full flex-col justify-between p-5 sm:p-8 lg:p-10">
            <div className="hidden sm:block">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/40 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-white/90 backdrop-blur-md">
                FISE Holdings Trust Bank
              </span>
            </div>

            <div className="mt-auto">
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl drop-shadow-sm">
                Banking built around you.
              </h2>
              <p className="mt-1.5 text-sm font-medium text-blue-100/95 sm:text-base drop-shadow-sm">
                Secure. Simple. Personal.
              </p>
            </div>
          </div>
        </section>

        {/* Customer registration form */}
        <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0 flex flex-col justify-center">
          <RegisterForm />
        </div>
      </div>
    </div>
  );
}
