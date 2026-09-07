import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmailToken } from "@/features/authentication/verify-email";
import { AuthError } from "@/features/authentication/errors";
import { ResendVerificationForm } from "./resend-form";

export const metadata: Metadata = { title: "Verify Email" };

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" aria-hidden="true" />
        <h1 className="text-section-title text-text-primary">Verification link missing</h1>
        <p className="text-sm text-text-secondary">
          This link is missing its verification token. Enter your email to get a new one.
        </p>
        <div className="mt-2 w-full">
          <ResendVerificationForm />
        </div>
      </div>
    );
  }

  try {
    await verifyEmailToken(token);
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" aria-hidden="true" />
        <h1 className="text-section-title text-text-primary">Email verified</h1>
        <p className="text-sm text-text-secondary">
          Your email address has been confirmed. You can now sign in.
        </p>
        <Link href="/login" className="mt-2">
          <Button>Sign in</Button>
        </Link>
      </div>
    );
  } catch (error) {
    const message =
      error instanceof AuthError ? error.message : "This verification link could not be used.";
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" aria-hidden="true" />
        <h1 className="text-section-title text-text-primary">Verification failed</h1>
        <p className="text-sm text-text-secondary">{message}</p>
        <div className="mt-2 w-full">
          <ResendVerificationForm />
        </div>
      </div>
    );
  }
}
