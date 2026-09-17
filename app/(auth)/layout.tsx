import Link from "next/link";
import { FiseLogo } from "@/components/brand/fise-logo";
import { BrandPeopleCarousel } from "@/components/brand/brand-people-carousel";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // Intentionally does NOT redirect authenticated users away.
  // Individual /login and /register pages handle the authenticated state
  // by showing an "already signed in" choice screen instead of blocking access.
  // This prevents the UX bug where clicking "Sign In" on a browser with an
  // existing session immediately bounces you to /dashboard without showing
  // the login page at all.
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Shared Carousel (Desktop): People on the left with horizontal fade into forms/content on the right */}
      <BrandPeopleCarousel variant="auth" mode="desktop" />

      <header className="relative z-20 flex h-16 items-center justify-between border-b border-border/60 bg-surface/70 px-4 backdrop-blur-md sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <FiseLogo variant="mark" className="h-8 w-8" />
          <FiseLogo className="h-9 w-auto max-w-[154px]" />
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
        <div className="w-full max-w-sm has-[[data-auth-split]]:max-w-[1400px]">
          {/* Shared Carousel (Mobile / Tablet): Image card positioned above auth content */}
          <BrandPeopleCarousel variant="auth" mode="mobile" className="mx-auto max-w-md" />
          {children}
        </div>
      </main>
    </div>
  );
}
