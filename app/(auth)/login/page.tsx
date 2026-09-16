import type { Metadata } from "next";
import { AuthBackground } from "@/components/auth/auth-background";
import { AuthFeatureList } from "@/components/auth/auth-feature-list";
import { SignedInAuthChoice } from "@/components/auth/signed-in-auth-choice";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign In" };

export default async function LoginPage() {
  const user = await getCurrentUser();

  // If user is already authenticated, show the "already signed in" choice
  // instead of redirecting or showing the login form
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
              Welcome back to FHT
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
              You are already signed in. Continue to your account or sign out to use another account.
            </p>
            <AuthFeatureList />
          </section>

          <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
            <SignedInAuthChoice
              userEmail={user.email}
              continueDestination={continueDestination}
              continueLabel={continueLabel}
              signOutAction="login"
              signOutLabel="Sign out and use another account"
              title="You are already signed in"
              description="Continue to your account or sign out to use a different account."
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-auth-split className="relative w-full animate-fade-in">
      <AuthBackground />

      <div className="relative grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <section className="animate-fade-in-up max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            FISE Holdings Trust Bank
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl lg:text-5xl">
            Welcome back to FHT
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-text-secondary sm:text-base">
            Sign in to manage your accounts, transfers, wallets and digital assets securely.
          </p>
          <AuthFeatureList />
        </section>

        <div className="mx-auto w-full max-w-md lg:ml-auto lg:mr-0">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
