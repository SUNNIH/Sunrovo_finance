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
    <div className="w-full animate-fade-in">
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
  );
}
