import type { Metadata } from "next";
import { SignedInAuthChoice } from "@/components/auth/signed-in-auth-choice";
import { getCurrentUser } from "@/lib/auth/session";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create Account" };

export default async function RegisterPage() {
  const user = await getCurrentUser();

  const continueDestination = user?.profile?.onboardingCompletedAt ? "/dashboard" : "/onboarding";
  const continueLabel = user?.profile?.onboardingCompletedAt
    ? "Continue to Dashboard"
    : "Continue Setup";

  return (
    <div data-auth-split className="relative w-full animate-fade-in">
      <div className="relative z-10 grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12 min-h-[calc(100vh-8rem)] py-2 sm:py-4">
        {/* Left column on desktop */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-7 flex-col justify-center max-w-lg space-y-4">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/50 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/95 backdrop-blur-md shadow-sm">
              FISE Holdings Trust Bank
            </span>
          </div>
          <h1 className="text-4xl xl:text-5xl font-bold tracking-tight text-white drop-shadow-md leading-[1.15]">
            Banking built around you.
          </h1>
          <p className="text-lg font-medium text-blue-100/95 drop-shadow-sm">
            Secure. Simple. Personal.
          </p>
          <p className="text-sm leading-relaxed text-slate-200/90 drop-shadow-sm max-w-md">
            {user
              ? "You are already signed in. Continue to your account or sign out to use a different account."
              : "Manage accounts, transfers, wallets and digital assets seamlessly in one secure platform."}
          </p>
        </div>

        {/* Right column: Form / Signed-in Choice */}
        <div className="lg:col-span-5 xl:col-span-5 w-full max-w-md mx-auto lg:ml-auto lg:mr-0">
          {user ? (
            <SignedInAuthChoice
              userEmail={user.email}
              continueDestination={continueDestination}
              continueLabel={continueLabel}
              signOutAction="register"
              signOutLabel="Sign out and create another account"
              title="You are already signed in"
              description="Continue to your account or sign out to create a different account."
            />
          ) : (
            <RegisterForm />
          )}
        </div>
      </div>
    </div>
  );
}
