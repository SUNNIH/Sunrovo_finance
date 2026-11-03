import Link from "next/link";
import {
  type LucideIcon,
  ChevronRight,
  Landmark,
  LockKeyhole,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { BrandPeopleCarousel } from "@/components/brand/brand-people-carousel";
import { FiseLogo } from "@/components/brand/fise-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { REGISTRATION_ENABLED } from "@/lib/feature-flags";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Security", href: "#security" },
] as const;

type ProductFeature = {
  icon: LucideIcon;
  title: string;
  body: string;
  id?: string;
};

const PRODUCT_FEATURES: readonly ProductFeature[] = [
  { icon: Landmark, title: "Accounts", body: "View your FHT bank accounts and the balances available to you." },
  { icon: Send, title: "Transfers", body: "Move funds between your accounts or to verified beneficiaries." },
  { icon: WalletCards, title: "Wallets", body: "Manage digital asset balances with deposit and withdrawal capabilities." },
  { id: "security", icon: ShieldCheck, title: "Security", body: "Manage passwords, MFA, trusted devices, sessions, and account protections." },
  { icon: LockKeyhole, title: "Deposits", body: "Fund your accounts and wallets with straightforward deposit flows." },
] as const;

const WORKSPACE_ITEMS = [
  { icon: Landmark, label: "Accounts", detail: "Banking overview" },
  { icon: Send, label: "Transfers", detail: "Verified movement" },
  { icon: WalletCards, label: "Wallets", detail: "Digital assets" },
] as const;

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-text-primary">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-surface-elevated/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-2 px-4 sm:gap-5 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="FISE Holdings Trust Bank home">
            <FiseLogo variant="mark" className="h-8 w-8" alt="" />
            <FiseLogo className="hidden h-9 w-auto max-w-[154px] sm:block" />
          </Link>

          <nav aria-label="Marketing" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="rounded-md px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary">
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Link href="/login"><Button variant="ghost" size="sm" className="px-2.5 sm:px-3">Sign In</Button></Link>
            {REGISTRATION_ENABLED && (
              <Link href="/register">
                <Button size="sm" className="px-3 shadow-sm sm:px-4">
                  <span className="hidden sm:inline">Create Account</span><span className="sm:hidden">Join</span>
                </Button>
            </Link>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-border bg-surface">
          <BrandPeopleCarousel variant="hero" />
          <div className="pointer-events-none absolute inset-0 -z-10 opacity-70 plt-grid-texture" aria-hidden="true" />
          <div className="pointer-events-none absolute -left-24 top-12 -z-10 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -right-20 top-20 -z-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />

          <div className="relative z-10 mx-auto grid max-w-[1440px] items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,0.9fr)_minmax(440px,1.1fr)] lg:gap-16 lg:px-8 lg:py-28">
            <div className="max-w-2xl animate-fade-in-up">
              <FiseLogo className="h-12 w-auto max-w-[220px]" />
              <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-primary">Finance · Investment · Security · Equity</p>
              <h1 className="mt-4 text-4xl font-bold tracking-[-0.035em] text-text-primary sm:text-5xl lg:text-6xl lg:leading-[1.08]">Banking and digital assets, brought together.</h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">FISE Holdings Trust Bank provides one workspace for your accounts, transfers, wallets, and crypto deposits.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {REGISTRATION_ENABLED && (
                  <Link href="/register" className="w-full sm:w-auto"><Button size="lg" className="w-full shadow-md shadow-primary/20 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25 sm:w-auto">Create your account<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></Link>
                )}
                <Link href="/login" className="w-full sm:w-auto"><Button variant={REGISTRATION_ENABLED ? "outline" : "primary"} size="lg" className={`w-full shadow-sm sm:w-auto ${REGISTRATION_ENABLED ? "bg-surface-elevated/80" : "shadow-primary/20"}`}>Sign in securely{!REGISTRATION_ENABLED && <ChevronRight className="h-4 w-4" aria-hidden="true" />}</Button></Link>
              </div>
              <p className="mt-5 text-body-sm text-text-tertiary">Reliable environment for supported banking and digital asset features.</p>
            </div>

            <div className="relative mx-auto w-full max-w-xl animate-fade-in-up [animation-delay:100ms]">
              <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" aria-hidden="true" />
              <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-elevated/90 p-4 shadow-xl shadow-primary/10 backdrop-blur-sm sm:p-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3"><FiseLogo variant="mark" className="h-9 w-9" alt="" /><div><p className="text-sm font-semibold text-text-primary">Your FISE workspace</p><p className="text-body-sm text-text-secondary">A clear view of what matters</p></div></div>
                  <span className="rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-label font-semibold text-primary">FHT</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
                    <div className="flex items-center justify-between"><p className="text-label font-semibold uppercase tracking-[0.13em] text-text-tertiary">Banking</p><Landmark className="h-4 w-4 text-primary" aria-hidden="true" /></div>
                    <div className="mt-4 space-y-2">
                      {WORKSPACE_ITEMS.map((item) => (
                        <div key={item.label} className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface-elevated px-3 py-2.5">
                          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary-soft text-primary"><item.icon className="h-4 w-4" aria-hidden="true" /></span>
                          <span className="min-w-0"><span className="block text-sm font-medium text-text-primary">{item.label}</span><span className="block text-body-sm text-text-secondary">{item.detail}</span></span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-primary-soft/45 p-3 sm:p-4">
                    <div><div className="flex items-center justify-between"><p className="text-label font-semibold uppercase tracking-[0.13em] text-primary">Crypto Banking</p><WalletCards className="h-4 w-4 text-primary" aria-hidden="true" /></div>
                      <div className="mt-5 space-y-3">{[["Wallets", "Asset balances"], ["Deposit", "Funding"], ["Withdraw", "Account access"]].map(([label, detail]) => <div key={label}><p className="text-sm font-semibold text-text-primary">{label}</p><p className="text-body-sm text-text-secondary">{detail}</p></div>)}</div>
                    </div>
                    <div className="mt-5 border-t border-primary/15 pt-3"><div className="flex items-center gap-2 text-body-sm text-text-secondary"><LockKeyhole className="h-3.5 w-3.5 text-primary" aria-hidden="true" />Security controls stay close at hand.</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-20 border-b border-border bg-background">
          <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">One connected platform</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">The tools you use, arranged with intention.</h2><p className="mt-4 text-base leading-relaxed text-text-secondary">Every FISE surface is designed to make the next step clear while keeping your banking and digital asset wallets in one place.</p></div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {PRODUCT_FEATURES.map((feature, index) => (
                <article key={feature.title} id={feature.id} className="group scroll-mt-20 rounded-xl border border-border bg-surface-elevated p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md animate-fade-in-up" style={{ animationDelay: `${index * 45}ms` }}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/15 bg-primary-soft text-primary"><feature.icon className="h-5 w-5" aria-hidden="true" /></span>
                  <h3 className="mt-5 text-card-title text-text-primary">{feature.title}</h3><p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-surface">
          <div className="pointer-events-none absolute inset-0 opacity-40 plt-grid-texture" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-[1440px] gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
            <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FISE Holdings Trust Bank</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-text-primary sm:text-4xl">Start with a workspace made for clarity.</h2><p className="mt-4 text-base leading-relaxed text-text-secondary">{REGISTRATION_ENABLED ? "Create an account to access banking and digital asset wallet tools in FHT." : "Sign in to access banking and digital asset wallet tools in FHT."}</p></div>
            {REGISTRATION_ENABLED ? (
              <Link href="/register" className="w-full lg:w-auto"><Button size="lg" className="w-full shadow-md shadow-primary/20 lg:w-auto">Create your account<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></Link>
            ) : (
              <Link href="/login" className="w-full lg:w-auto"><Button size="lg" className="w-full shadow-md shadow-primary/20 lg:w-auto">Sign in securely<ChevronRight className="h-4 w-4" aria-hidden="true" /></Button></Link>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface-elevated">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 text-body-sm text-text-secondary sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
          <div className="flex items-center gap-2"><FiseLogo variant="mark" className="h-7 w-7" alt="" /><FiseLogo className="h-7 w-auto max-w-[128px]" /></div>
          <div className="flex flex-wrap gap-4">
            <Link href="/terms" className="hover:text-primary hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-primary hover:underline">
              Privacy Policy
            </Link>
          </div>
          <div className="max-w-3xl lg:text-right"><p>FISE Holdings Trust Bank (FHT).</p><p className="mt-1 text-text-tertiary">&copy; {new Date().getFullYear()} FISE Holdings Trust Bank. All rights reserved.</p></div>
        </div>
      </footer>
    </div>
  );
}