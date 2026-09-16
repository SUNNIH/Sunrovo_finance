"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SignupCard } from "@/components/auth/signup-card";
import { Button } from "@/components/ui/button";
import { postJson, ApiRequestError } from "@/lib/utilities/api-client";

interface SignedInAuthChoiceProps {
  userEmail: string;
  continueDestination: "/dashboard" | "/onboarding";
  continueLabel: string;
  signOutAction: "login" | "register";
  signOutLabel: string;
  title: string;
  description: string;
}

export function SignedInAuthChoice({
  userEmail,
  continueDestination,
  continueLabel,
  signOutAction,
  signOutLabel,
  title,
  description,
}: SignedInAuthChoiceProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);
  const [signOutError, setSignOutError] = React.useState<string | null>(null);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await postJson("/api/auth/logout", {});
      // After successful logout, redirect to the appropriate page
      router.push(signOutAction === "login" ? "/login" : "/register");
      router.refresh();
    } catch (error) {
      setSigningOut(false);
      setSignOutError(
        error instanceof ApiRequestError ? error.message : "Failed to sign out. Please try again."
      );
    }
  }

  function handleContinue() {
    router.push(continueDestination);
  }

  return (
    <SignupCard title={title} description={description}>
      <div className="flex flex-col gap-6">
        <div className="rounded-lg border border-border bg-secondary/30 p-4">
          <p className="text-sm text-text-secondary">Signed in as</p>
          <p className="mt-1 font-medium text-text-primary">{userEmail}</p>
        </div>

        <Button
          size="lg"
          onClick={handleContinue}
          disabled={signingOut}
          className="w-full shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md"
        >
          {continueLabel}
        </Button>

        {signOutError && (
          <p role="alert" className="text-body-sm text-danger animate-slide-up">
            {signOutError}
          </p>
        )}

        <Button
          variant="outline"
          size="lg"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full"
        >
          {signingOut ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Signing out...
            </>
          ) : (
            signOutLabel
          )}
        </Button>
      </div>
    </SignupCard>
  );
}
