import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyValue } from "@/components/financial/currency-value";
import { BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";
import { AccountNumberDisplay } from "@/components/accounts/account-number-display";
import { AccountDetails } from "./account-details";

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Accounts</h1>
          <p className="mt-1 text-sm text-text-secondary">Your PLT fiat accounts.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {Object.entries(totalsByCurrency).map(([currency, total]) => (
            <div
              key={currency}
              className="min-w-[9.5rem] rounded-md border border-border bg-surface px-3 py-2.5"
            >
              <p className="text-body-sm text-text-secondary">Total {currency}</p>
              <CurrencyValue
                amount={total.toFixed(2)}
                assetSymbol={currency}
                className="mt-0.5 block text-sm font-semibold text-text-primary"
              />
            </div>
          ))}
        </div>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-text-secondary">
            No accounts yet. Complete onboarding to get your PLT accounts.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <Card
              key={account.id}
              className="flex flex-col hover:border-border-strong hover:shadow-md"
            >
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate">
                    {account.nickname ?? BANK_ACCOUNT_TYPE_LABELS[account.type]}
                  </CardTitle>
                  <p className="mt-1 text-label uppercase tracking-wide text-text-tertiary">
                    {BANK_ACCOUNT_TYPE_LABELS[account.type] ?? account.type}
                  </p>
                </div>
                {account.isPrimary && <Badge variant="primary">Primary</Badge>}
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-5">
                <div>
                  <p className="text-label uppercase tracking-wide text-text-tertiary">Available</p>
                  <CurrencyValue
                    amount={account.balanceCache.toString()}
                    assetSymbol={account.currencySymbol}
                    className="mt-1 block text-2xl font-semibold tracking-tight text-text-primary"
                  />
                </div>
                <div className="rounded-md border border-border bg-surface px-3 py-2.5">
                  <p className="text-label uppercase tracking-wide text-text-tertiary">
                    Account number
                  </p>
                  <div className="mt-1">
                    <AccountNumberDisplay accountNumber={account.accountNumber} />
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  <AccountDetails
                    nickname={account.nickname}
                    type={account.type}
                    holderName={holderName}
                    accountNumber={account.accountNumber}
                    currency={account.currencySymbol}
                  />
                  <Link href={{ pathname: "/transfers", query: { from: account.id } }}>
                    <Button variant="outline" size="sm">
                      <ArrowLeftRight className="h-4 w-4" /> Transfer
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
