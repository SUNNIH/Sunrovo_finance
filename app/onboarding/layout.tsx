import { redirect } from "next/navigation";
import Link from "next/link";
import { FiseLogo } from "@/components/brand/fise-logo";
import { requireUser } from "@/lib/auth/session";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.profile?.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="flex h-16 items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <FiseLogo variant="mark" className="h-8 w-8" />
          <FiseLogo className="h-9 w-auto max-w-[154px]" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
