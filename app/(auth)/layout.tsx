import Link from "next/link";
import { redirect } from "next/navigation";
import { FiseLogo } from "@/components/brand/fise-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Real, DB-validated check — not just "is a session cookie present."
  // A stale/expired/revoked cookie correctly resolves to `null` here and
  // simply renders the login page normally, instead of bouncing the
  // visitor back and forth with a protected-route layout that would
  // reject the same invalid session (see middleware.ts for the full
  // explanation of the loop this replaced).
  const user = await getCurrentUser();
  if (user) {
    redirect(user.profile?.onboardingCompletedAt ? "/dashboard" : "/onboarding");
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <header className="relative z-20 flex h-16 items-center justify-between border-b border-border/60 bg-surface/70 px-4 backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <FiseLogo variant="mark" className="h-8 w-8" />
          <FiseLogo className="h-9 w-auto max-w-[154px]" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-sm has-[[data-auth-split]]:max-w-[1400px]">
          {children}
        </div>
      </main>
    </div>
  );
}
