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
    <div className="relative flex min-h-screen flex-col bg-background overflow-x-hidden">
      {/* ── Desktop Background Carousel Layer (hidden lg:block, fixed inset-0) ── */}
      <BrandPeopleCarousel variant="auth" mode="desktop" />

      {/* Header */}
      <header className="relative z-20 flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-surface/70 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <FiseLogo variant="mark" className="h-8 w-8" />
          <FiseLogo className="h-9 w-auto max-w-[154px]" />
        </Link>
        <ThemeToggle />
      </header>

      {/* ── Main Viewport Area: Vertically centers content, uses available viewport height ── */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6 lg:px-8 xl:px-12 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-7xl mx-auto flex-1 flex flex-col justify-center my-auto">
          {/* Mobile / Tablet Image Hero (< 1024px): strictly lg:hidden, rendered above auth content */}
          <div className="w-full max-w-md mx-auto mb-6 lg:hidden">
            <BrandPeopleCarousel variant="auth" mode="mobile" />
          </div>

          {/* Breakpoint layout:
              >= 1024px: Left side is visual space for people carousel background,
                         Right side is constrained column for auth content/form.
              < 1024px:  Centered column below mobile hero.
          */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 items-center">
            {/* Left visual space on desktop (keeps carousel people visible and unobstructed) */}
            <div className="hidden lg:block lg:col-span-6 xl:col-span-7 pointer-events-none" aria-hidden="true" />

            {/* Right form/content column on desktop, centered on mobile/tablet */}
            <div className="w-full max-w-md mx-auto lg:max-w-lg lg:col-span-6 xl:col-span-5 lg:ml-auto lg:mr-0">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
