import type { Metadata } from "next";
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
      <div className="w-full animate-fade-in">
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
    );
  }

  return (
    <div className="w-full animate-fade-in">
      <LoginForm />
    </div>
  );
}
