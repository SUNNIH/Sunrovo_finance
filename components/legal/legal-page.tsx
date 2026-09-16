import Link from "next/link";
import { FiseLogo } from "@/components/brand/fise-logo";

type LegalPageProps = {
  title: string;
  effectiveDate: string;
  children: React.ReactNode;
};

export function LegalPage({
  title,
  effectiveDate,
  children,
}: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-text-primary">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Link href="/" aria-label="FISE Holdings Trust Bank home">
            <FiseLogo className="h-9 w-auto max-w-[170px]" />
          </Link>

          <Link
            href="/"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-sm sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">
            FISE Holdings Trust Bank
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>

          <p className="mt-2 text-sm text-text-secondary">
            Effective date: {effectiveDate}
          </p>

          <div className="mt-8 space-y-8 text-sm leading-7 text-text-secondary">
            {children}
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-wrap gap-4 px-4 py-6 text-sm text-text-secondary sm:px-6">
          <Link href="/terms" className="hover:text-primary hover:underline">
            Terms
          </Link>

          <Link href="/privacy" className="hover:text-primary hover:underline">
            Privacy Policy
          </Link>

          <span className="ml-auto">
            © {new Date().getFullYear()} FISE Holdings Trust Bank
          </span>
        </div>
      </footer>
    </div>
  );
}