import type { Metadata } from "next";
import Link from "next/link";
import { Repeat, Wallet as WalletIcon } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getWalletForUser } from "@/features/crypto/wallets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CurrencyValue } from "@/components/financial/currency-value";

export const metadata: Metadata = { title: "Wallets" };

export default async function WalletsPage() {
  const user = await getCurrentUser();
  const wallet = user ? await getWalletForUser(user.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Wallets</h1>
          <p className="mt-1 text-sm text-text-secondary">Your crypto holdings, spot wallet.</p>
        </div>
        <div className="rounded-md border border-border bg-surface px-4 py-2">
          <p className="text-body-sm text-text-secondary">Portfolio value</p>
          <CurrencyValue
            amount={wallet?.totalUsdValue ?? "0"}
            assetSymbol="USD"
            className="text-xl font-semibold text-text-primary"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/convert">
          <Button variant="outline">
            <Repeat className="h-4 w-4" /> Convert
          </Button>
        </Link>
        <Link href="/trade">
          <Button variant="outline">Trade</Button>
        </Link>
        <Link href="/deposit">
          <Button variant="outline">Deposit</Button>
        </Link>
        <Link href="/withdraw">
          <Button variant="outline">Withdraw</Button>
        </Link>
      </div>

      {!wallet || wallet.assets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
            <WalletIcon className="h-8 w-8 text-text-tertiary" aria-hidden="true" />
            <p className="text-sm text-text-secondary">No crypto assets yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface-elevated">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface text-left text-label uppercase text-text-tertiary">
              <tr>
                <th className="px-4 py-2.5 font-medium">Asset</th>
                <th className="px-4 py-2.5 text-right font-medium">Available</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">In orders</th>
                <th className="px-4 py-2.5 text-right font-medium">Value (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {wallet.assets.map((asset) => (
                <tr key={asset.assetSymbol} className="transition-colors duration-150 hover:bg-surface-hover">
                  <td className="px-4 py-3 font-medium text-text-primary">{asset.assetSymbol}</td>
                  <td className="px-4 py-3 text-right">
                    <CurrencyValue amount={asset.available} assetSymbol={asset.assetSymbol} showSymbol={false} />
                  </td>
                  <td className="hidden px-4 py-3 text-right text-text-secondary sm:table-cell">
                    <CurrencyValue amount={asset.locked} assetSymbol={asset.assetSymbol} showSymbol={false} />
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-text-primary">
                    <CurrencyValue amount={asset.usdValue} assetSymbol="USD" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
