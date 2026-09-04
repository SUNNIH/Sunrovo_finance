import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Wallet as WalletIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyValue } from "@/components/financial/currency-value";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { listTransactions } from "@/features/banking/transactions";
import { prisma } from "@/lib/db/prisma";
import { maskAccountNumber, BANK_ACCOUNT_TYPE_LABELS } from "@/lib/utilities/format-account";

export const metadata: Metadata = { title: "Dashboard" };

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
    prisma.cryptoWallet.findFirst({ where: { userId: user.id }, include: { balances: true } }),
  ]);

  const primaryAccount = accounts.find((a) => a.isPrimary) ?? accounts[0];
  const totalFiat = primaryAccount
    ? accounts
        .filter((a) => a.currencySymbol === primaryAccount.currencySymbol)
        .reduce((sum, a) => sum + Number(a.balanceCache), 0)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">
            Good morning, {firstName}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Here&rsquo;s what&rsquo;s happening with your accounts today.
          </p>
        </div>
        <Badge variant="warning" className="w-fit">
          Demo Environment — no real funds
        </Badge>
      </div>

      <Card className="hover:border-border-strong hover:shadow-md">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body-sm text-text-secondary">
              Total fiat balance{primaryAccount ? ` (${primaryAccount.currencySymbol})` : ""}
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <CurrencyValue
                amount={totalFiat.toFixed(2)}
                assetSymbol={primaryAccount?.currencySymbol ?? "USD"}
                className="text-page-title text-text-primary"
              />
            </div>
            {wallet && wallet.balances.length > 0 && (
              <p className="mt-1 text-body-sm text-text-secondary">
                Plus{" "}
                {wallet.balances.map((b, i) => (
                  <span key={b.id} className="financial-value">
                    {i > 0 ? " · " : ""}
                    {b.available.toString()} {b.assetSymbol}
                  </span>
                ))}{" "}
                in your Spot Wallet
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/deposit">
              <Button variant="outline" size="md">
                Deposit
              </Button>
            </Link>
            <Link href="/withdraw">
              <Button variant="outline" size="md">
                Withdraw
              </Button>
            </Link>
            <Link href="/transfers">
              <Button variant="primary" size="md">
                <ArrowLeftRight className="h-4 w-4" /> Transfer
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => (
          <Link key={account.id} href="/accounts" className="block rounded-lg">
            <Card className="h-full hover:border-border-strong hover:shadow-md">
              <CardHeader>
                <CardTitle>{account.nickname ?? BANK_ACCOUNT_TYPE_LABELS[account.type]}</CardTitle>
                <p className="text-body-sm text-text-secondary financial-value">
                  {maskAccountNumber(account.accountNumber)}
                </p>
              </CardHeader>
              <CardContent>
                <CurrencyValue
                  amount={account.balanceCache.toString()}
                  assetSymbol={account.currencySymbol}
                  className="text-xl font-semibold text-text-primary"
                />
              </CardContent>
            </Card>
          </Link>
        ))}
        {wallet && (
          <Link href="/wallets" className="block rounded-lg">
          <Card className="h-full hover:border-border-strong hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WalletIcon className="h-4 w-4 text-primary" /> Spot Wallet
              </CardTitle>
              <p className="text-body-sm text-text-secondary">Crypto</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              {wallet.balances.map((b) => (
                <CurrencyValue
                  key={b.id}
                  amount={b.available.toString()}
                  assetSymbol={b.assetSymbol}
                  className="text-xl font-semibold text-text-primary"
                />
              ))}
            </CardContent>
          </Card>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Recent activity</CardTitle>
          <Link href="/transactions" className="text-sm font-medium text-primary hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-border">
          {recentActivity.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              No transactions yet. Your transfers, deposits and trades will appear here.
            </p>
          ) : (
            recentActivity.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {item.counterparty ?? item.type}
                  </p>
                  <p className="text-body-sm text-text-secondary">
                    {item.assetSymbol} · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={
                    "financial-value text-sm font-medium " +
                    (item.direction === "CREDIT" ? "text-success" : "text-text-primary")
                  }
                >
                  {item.direction === "CREDIT" ? "+" : "−"}
                  {item.amount.toString()}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
