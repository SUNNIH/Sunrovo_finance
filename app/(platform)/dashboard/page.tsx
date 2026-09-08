import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  Download,
  Plus,
  Repeat,
  Wallet as WalletIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyValue } from "@/components/financial/currency-value";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { listTransactions } from "@/features/banking/transactions";
import { prisma } from "@/lib/db/prisma";
import { maskAccountNumber, BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";
import { cn } from "@/lib/utilities/cn";

export const metadata: Metadata = { title: "Dashboard" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Format a Date to a concise locale string for transaction rows. */
function formatActivityDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Derive a readable label from a transaction type string. */
function txLabel(type: string): string {
  return type
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Quick-action definition ──────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Deposit", href: "/deposit", icon: Download, variant: "primary" as const },
  { label: "Transfer", href: "/transfers", icon: ArrowLeftRight, variant: "outline" as const },
  { label: "Withdraw", href: "/withdraw", icon: ArrowUpRight, variant: "outline" as const },
  { label: "Convert", href: "/convert", icon: Repeat, variant: "outline" as const },
] as const;

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const firstName = (user.profile?.fullName ?? "there").split(" ")[0];

  // Crypto wallet is read directly here (not via a feature module) since
  // the crypto feature surface itself is Phase 4 scope — this is just
  // enough to show the Spot Wallet balance seeded at onboarding.
  const [accounts, recentActivity, wallet] = await Promise.all([
    getAccountsForUser(user.id),
    listTransactions(user.id, { limit: 5 }),
    prisma.cryptoWallet.findFirst({
      where: { userId: user.id },
      include: { balances: true },
    }),
  ]);

  const primaryAccount = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const totalFiat = primaryAccount
    ? accounts
        .filter((a) => a.currencySymbol === primaryAccount.currencySymbol)
        .reduce((sum, a) => sum + Number(a.balanceCache), 0)
    : 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Dashboard
          </p>
          <h1 className="mt-1 text-page-title-mobile text-text-primary sm:text-page-title">
            Good morning, {firstName}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Here&rsquo;s what&rsquo;s happening with your accounts today.
          </p>
        </div>
        <Badge variant="warning" className="w-fit shrink-0 sm:mt-1">
          Demo Environment — no real funds
        </Badge>
      </div>

      {/* ── Balance overview card ─────────────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-surface-elevated",
          "shadow-sm transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md",
          /* Subtle grid texture strip across the top edge */
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-48 before:plt-grid-texture before:opacity-40"
        )}
      >
        <div className="relative z-10 p-5 sm:p-6">
          {/* Balance row */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-body-sm text-text-secondary">
                Total fiat balance
                {primaryAccount ? (
                  <span className="ml-1 text-text-tertiary">
                    ({primaryAccount.currencySymbol})
                  </span>
                ) : null}
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <CurrencyValue
                  amount={totalFiat.toFixed(2)}
                  assetSymbol={primaryAccount?.currencySymbol ?? "USD"}
                  className="text-[2.25rem] font-bold leading-none tracking-tight text-text-primary"
                />
              </div>
              {wallet && wallet.balances.length > 0 && (
                <p className="mt-2 text-body-sm text-text-secondary">
                  Plus{" "}
                  {wallet.balances.map((b, i) => (
                    <span key={b.id} className="financial-value text-text-primary">
                      {i > 0 ? " · " : ""}
                      {b.available.toString()} {b.assetSymbol}
                    </span>
                  ))}{" "}
                  in your Spot Wallet
                </p>
              )}
            </div>

            {/* Quick actions — right-aligned on sm+ */}
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map(({ label, href, icon: Icon, variant }) => (
                <Link key={href} href={href}>
                  <Button variant={variant} size="sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Account & wallet summary cards ───────────────────────────────── */}
      <section aria-labelledby="accounts-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="accounts-heading"
            className="text-section-title text-text-primary"
          >
            Accounts &amp; Wallets
          </h2>
          <Link
            href="/accounts"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
          >
            Manage
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {/* Bank accounts */}
          {accounts.map((account) => (
            <Link
              key={account.id}
              href="/accounts"
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card
                className={cn(
                  "h-full rounded-xl transition-[border-color,box-shadow,transform] duration-200 ease-out",
                  "group-hover:border-border-strong group-hover:shadow-md group-hover:-translate-y-0.5"
                )}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        "bg-primary-soft text-primary"
                      )}
                    >
                      <Banknote className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    {account.isPrimary && (
                      <Badge variant="primary" className="text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="mt-3">
                    <CardTitle className="text-sm font-semibold text-text-primary">
                      {account.nickname ?? BANK_ACCOUNT_TYPE_LABELS[account.type]}
                    </CardTitle>
                    <p className="mt-0.5 text-body-sm financial-value text-text-tertiary">
                      {maskAccountNumber(account.accountNumber)}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="pt-3">
                  <CurrencyValue
                    amount={account.balanceCache.toString()}
                    assetSymbol={account.currencySymbol}
                    className="text-xl font-bold text-text-primary"
                  />
                </CardContent>
              </Card>
            </Link>
          ))}

          {/* Spot Wallet */}
          {wallet && (
            <Link
              href="/wallets"
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card
                className={cn(
                  "h-full rounded-xl transition-[border-color,box-shadow,transform] duration-200 ease-out",
                  "group-hover:border-border-strong group-hover:shadow-md group-hover:-translate-y-0.5"
                )}
              >
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        "bg-primary-soft text-primary"
                      )}
                    >
                      <WalletIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    <Badge variant="info" className="text-[10px]">
                      Crypto
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <CardTitle className="text-sm font-semibold text-text-primary">
                      Spot Wallet
                    </CardTitle>
                    <p className="mt-0.5 text-body-sm text-text-tertiary">
                      Digital assets
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 pt-3">
                  {wallet.balances.length === 0 ? (
                    <p className="text-body-sm text-text-secondary">No assets yet</p>
                  ) : (
                    wallet.balances.map((b) => (
                      <CurrencyValue
                        key={b.id}
                        amount={b.available.toString()}
                        assetSymbol={b.assetSymbol}
                        className="text-xl font-bold text-text-primary"
                      />
                    ))
                  )}
                </CardContent>
              </Card>
            </Link>
          )}

          {/* Add account CTA — shown when fewer than 3 items fill the grid */}
          {accounts.length + (wallet ? 1 : 0) < 3 && (
            <Link
              href="/accounts"
              className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div
                className={cn(
                  "flex h-full min-h-[136px] flex-col items-center justify-center gap-2 rounded-xl",
                  "border border-dashed border-border bg-surface",
                  "transition-[border-color,background-color] duration-200 ease-out",
                  "group-hover:border-primary/40 group-hover:bg-primary-soft/30"
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-hover text-text-secondary group-hover:bg-primary-soft group-hover:text-primary">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium text-text-secondary group-hover:text-primary">
                  Open account
                </span>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <section aria-labelledby="activity-heading">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle id="activity-heading">Recent activity</CardTitle>
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors duration-150 hover:text-primary-hover"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {recentActivity.items.length === 0 ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover">
                  <ArrowLeftRight className="h-5 w-5 text-text-tertiary" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">No transactions yet</p>
                  <p className="mt-0.5 text-body-sm text-text-secondary">
                    Your transfers, deposits, and trades will appear here.
                  </p>
                </div>
                <Link href="/deposit">
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Make a deposit
                  </Button>
                </Link>
              </div>
            ) : (
              <ul
                className="divide-y divide-border"
                aria-label="Recent transactions"
              >
                {recentActivity.items.map((item) => {
                  const isCredit = item.direction === "CREDIT";
                  const DirectionIcon = isCredit ? ArrowDownLeft : ArrowUpRight;
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-4 px-4 py-3.5 transition-colors duration-150 hover:bg-surface sm:px-5"
                    >
                      {/* Direction icon pip */}
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          isCredit
                            ? "bg-success-soft text-success"
                            : "bg-surface-hover text-text-secondary"
                        )}
                        aria-hidden="true"
                      >
                        <DirectionIcon className="h-4 w-4" />
                      </div>

                      {/* Description */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {item.counterparty ?? txLabel(item.type)}
                        </p>
                        <p className="mt-0.5 text-body-sm text-text-secondary">
                          {item.assetSymbol}
                          <span className="mx-1.5 text-text-tertiary">·</span>
                          {formatActivityDate(item.createdAt)}
                        </p>
                      </div>

                      {/* Amount */}
                      <span
                        className={cn(
                          "financial-value shrink-0 text-sm font-semibold",
                          isCredit ? "text-success" : "text-text-primary"
                        )}
                      >
                        {isCredit ? "+" : "−"}
                        {item.amount.toString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
