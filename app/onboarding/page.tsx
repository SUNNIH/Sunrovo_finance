import type { Metadata } from "next";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = { title: "Complete Your Profile" };

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-page-title-mobile text-text-primary">Let&rsquo;s finish setting up</h1>
        <p className="mt-1 text-sm text-text-secondary">
          A few details and we&rsquo;ll create your accounts.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  );
}
