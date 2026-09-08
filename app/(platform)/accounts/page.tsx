import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, CheckCircle2, Landmark } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyValue } from "@/components/financial/currency-value";
import { BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";
import { AccountNumberDisplay } from "@/components/accounts/account-number-display";
import { AccountDetails } from "./account-details";
import { cn } from "@/lib/utilities/cn";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const accounts = await getAccountsForUser(user.id);
  const holderName = user.profile?.fullName ?? user.email;

  const totalsByCurrency = accounts.reduce<Record<string, number>>((totals, account) => {
    const amount = Number(account.balanceCache);
    totals[account.currencySymbol] = (totals[account.currencySymbol] ?? 0) + amount;
    return totals;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header & Currency Totals */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title-mobile sm:text-page-title font-semibold tracking-tight text-text-primary">
            Accounts
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your PLT fiat banking accounts and active balances.
          </p>
        </div>

        {/* Currency summary totals */}
        {Object.keys(totalsByCurrency).length > 0 && (
          <div className="flex flex-wrap gap-2.5 sm:gap-3">
            {Object.entries(totalsByCurrency).map(([currency, total]) => (
              <div
                key={currency}
                className="min-w-[9rem] flex-1 rounded-xl border border-border bg-surface-elevated px-4 py-2.5 shadow-xs transition-colors hover:border-border-strong sm:min-w-[10.5rem]"
              >
                <p className="text-label font-medium uppercase tracking-wider text-text-tertiary">
                  Total {currency}
                </p>
                <CurrencyValue
                  amount={total.toFixed(2)}
                  assetSymbol={currency}
                  className="financial-value mt-1 block text-lg font-bold tracking-tight text-text-primary"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Cards Grid or Empty State */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-elevated/50 p-8 text-center sm:p-12">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
            <Landmark className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-text-primary sm:text-lg">
            No Accounts Yet
          </h2>
          <p className="mt-1.5 max-w-sm text-sm text-text-secondary">
            Complete your onboarding verification to receive your official PLT fiat accounts and begin transacting.
          </p>
          <div className="mt-6">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => {
            const displayName =
              account.nickname ?? BANK_ACCOUNT_TYPE_LABELS[account.type] ?? "PLT Account";
            const typeLabel = BANK_ACCOUNT_TYPE_LABELS[account.type] ?? account.type;

            return (
              <div
                key={account.id}
                className={cn(
                  "group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-surface-elevated p-5 sm:p-6",
                  "shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                  account.isPrimary
                    ? "border-primary/40 ring-1 ring-primary/20 hover:border-primary/60"
                    : "border-border hover:border-border-strong"
                )}
              >
                {/* Top accent gradient strip for primary accounts */}
                {account.isPrimary && (
                  <div
                    className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-primary/30 via-primary to-primary/30"
                    aria-hidden="true"
                  />
                )}

                <div>
                  {/* Card Header: Product Icon + Account Name/Type + Primary Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                          account.isPrimary
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-primary-soft text-primary"
                        )}
                      >
                        <Landmark className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-base font-semibold tracking-tight text-text-primary">
                          {displayName}
                        </h2>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-text-secondary">
                            {typeLabel}
                          </span>
                          <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium text-text-tertiary">
                            {account.currencySymbol}
                          </span>
                        </div>
                      </div>
                    </div>

                    {account.isPrimary && (
                      <Badge
                        variant="primary"
                        className="shrink-0 gap-1 px-2 py-0.5 text-[11px] font-semibold"
                      >
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Primary
                      </Badge>
                    )}
                  </div>

                  {/* Balance Block */}
                  <div className="my-5">
                    <p className="text-label font-medium uppercase tracking-wider text-text-tertiary">
                      Available Balance
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <CurrencyValue
                        amount={account.balanceCache.toString()}
                        assetSymbol={account.currencySymbol}
                        className="financial-value text-2xl font-bold leading-none tracking-tight text-text-primary sm:text-[1.85rem]"
                      />
                    </div>
                  </div>

                  {/* Account Number Container */}
                  <div className="rounded-lg border border-border/80 bg-surface/60 p-3 transition-colors group-hover:border-border">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-label font-medium uppercase tracking-wider text-text-tertiary">
                        Account Number
                      </span>
                      <span className="text-[10px] font-medium text-text-tertiary">
                        PLT Fiat
                      </span>
                    </div>
                    <AccountNumberDisplay accountNumber={account.accountNumber} />
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-6 border-t border-border/60 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <AccountDetails
                      nickname={account.nickname}
                      type={account.type}
                      holderName={holderName}
                      accountNumber={account.accountNumber}
                      currency={account.currencySymbol}
                    />
                    <Link
                      href={{ pathname: "/transfers", query: { from: account.id } }}
                      className="w-full"
                    >
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full gap-1.5 font-medium shadow-xs"
                      >
                        <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                        Transfer
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
