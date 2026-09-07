import Link from "next/link";
import { Diamond, Shield, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CurrencyValue, PercentChange } from "@/components/financial/currency-value";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Markets", href: "#markets" },
  { label: "Security", href: "#security" },
  { label: "Help", href: "#help" },
];

const FEATURES = [
  {
    icon: Wallet,
    title: "Everyday banking",
    body: "Current and savings accounts, transfers, beneficiaries and bill-ready cards in one place.",
  },
  {
    icon: Zap,
    title: "Spot crypto, simplified",
    body: "Live market data, clear asset pages and straightforward buy, sell and convert flows.",
  },
  {
    icon: Shield,
    title: "Security by default",
    body: "Step-up authentication, device recognition and an auditable trail on every sensitive action.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Diamond className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              PLATINUM TRUST BANK
            </span>
          </Link>

          <nav aria-label="Marketing" className="hidden gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button variant="primary" size="sm">
                Create Account
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary">
              Demo Environment — no real funds are held or transferred
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Bank. Trade. Invest. Grow.
            </h1>
            <p className="mt-4 max-w-lg text-base text-text-secondary sm:text-lg">
              PLATINUM TRUST BANK brings everyday banking and simplified crypto access
              together in one trusted, modern platform.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register">
                <Button variant="primary" size="lg">
                  Create your account
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" size="lg">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface-elevated p-5 shadow-sm">
            <p className="text-body-sm text-text-secondary">Total balance</p>
            <div className="mt-1 flex items-baseline gap-2">
              <CurrencyValue amount="12,560,450.00" assetSymbol="NGN" className="text-2xl font-semibold text-text-primary" />
              <PercentChange value={4.25} />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
              {[
                { symbol: "BTC/USDT", price: "67,231.45", change: 2.35 },
                { symbol: "ETH/USDT", price: "3,245.67", change: 1.25 },
                { symbol: "PLT/USDT", price: "0.1234", change: -1.15 },
              ].map((row) => (
                <div key={row.symbol} className="rounded-md border border-border p-3">
                  <p className="text-body-sm text-text-secondary">{row.symbol}</p>
                  <CurrencyValue amount={row.price} assetSymbol="USD" showSymbol={false} className="mt-1 block text-sm font-semibold text-text-primary" />
                  <PercentChange value={row.change} className="mt-1" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6">
            <h2 className="text-section-title text-text-primary">
              Everything you need, nothing you don&rsquo;t
            </h2>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-lg border border-border bg-surface-elevated p-5">
                  <feature.icon className="h-6 w-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-3 text-card-title text-text-primary">{feature.title}</h3>
                  <p className="mt-1.5 text-sm text-text-secondary">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-[1400px] px-4 py-8 text-sm text-text-secondary sm:px-6">
          <p>PLATINUM TRUST BANK (PLT) is a demonstration application. No real funds are held or transferred, and PLT is not currently licensed, insured, or regulated as a bank or exchange.</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} PLATINUM TRUST BANK. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
