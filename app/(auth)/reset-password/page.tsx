import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set New Password" };

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" aria-hidden="true" />
        <h1 className="text-section-title text-text-primary">Link missing or invalid</h1>
        <p className="text-sm text-text-secondary">
          This password reset link is missing its token. Request a new one from the sign-in page.
        </p>
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return <ResetPasswordForm token={token} />;
}
