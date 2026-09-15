import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  Download,
  Wallet as WalletIcon,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getWalletForUser } from "@/features/crypto/wallets";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyValue } from "@/components/financial/currency-value";
import {
  CryptoAssetIcon,
  getCryptoAssetMeta,
} from "@/components/financial/crypto-asset-icon";

export const metadata: Metadata = { title: "Wallets" };

/**
 * Phase 3: Deposit-and-hold wallet
 * 
 * Displays native crypto balances only (BTC, USDT, etc.)
 * No USD valuation, no portfolio allocation, no trading dependencies.
 */

export default async function WalletsPage() {
  const user = await getCurrentUser();
  const wallet = user ? await getWalletForUser(user.id) : null;

  const hasAssets = Boolean(wallet && wallet.assets.length > 0);

  const assetsWithMeta = hasAssets
    ? wallet!.assets.map((asset) => {
        const meta = getCryptoAssetMeta(asset.assetSymbol);
        return {
          ...asset,
          meta,
        };
      })
    : [];

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Crypto Banking
            </p>
            <Badge variant="info" className="text-[10px]">
              Spot Wallet
            </Badge>
          </div>
          <h1 className="mt-1 text-page-title-mobile text-text-primary sm:text-page-title">
            Wallets
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Your crypto balances, deposit addresses, and transaction history.
          </p>
        </div>
      </div>

      {/* ── Portfolio Overview Hero Card ──────────────────────────────────── */}
      <Card className="rounded-xl border-border bg-surface-elevated p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Wallet info */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-medium text-text-secondary">
                Crypto Assets
              </span>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-2xl font-bold text-text-primary">
                <WalletIcon className="h-6 w-6" aria-hidden="true" />
                {wallet?.assets.length ?? 0}{" "}
                {wallet?.assets.length === 1 ? "Asset" : "Assets"}
              </span>
            </div>

            <div className="mt-2.5 text-body-sm text-text-secondary">
              Deposit-and-hold wallet for supported crypto assets
            </div>
          </div>

          {/* Quick action buttons */}
          <div className="flex flex-wrap gap-2.5">
            <Link href="/deposit">
              <Button variant="primary" size="sm" className="gap-1.5 touch-target sm:min-h-0">
                <Download className="h-4 w-4" aria-hidden="true" />
                Deposit
              </Button>
            </Link>
            <Link href="/withdraw">
              <Button variant="outline" size="sm" className="gap-1.5 touch-target sm:min-h-0">
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                Withdraw
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {/* ── Holdings Section ──────────────────────────────────────────────── */}
      <section aria-labelledby="holdings-heading">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 id="holdings-heading" className="text-section-title text-text-primary">
              Asset Balances
            </h2>
            {hasAssets && (
              <Badge variant="neutral" className="text-xs">
                {wallet!.assets.length}
              </Badge>
            )}
          </div>
        </div>

        {!hasAssets ? (
          <Card className="rounded-xl border-dashed">
            <CardContent className="flex flex-col items-center gap-3 p-8 sm:p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
                <WalletIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-text-primary sm:text-lg">
                No crypto assets yet
              </h3>
              <p className="max-w-md text-sm text-text-secondary">
                Your spot wallet has no funded assets. Deposit crypto to get started.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/deposit">
                  <Button variant="primary" size="sm">
                    <Download className="h-4 w-4 mr-1.5" /> Deposit Crypto
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop & Tablet Table View */}
            <div className="hidden sm:block overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-surface text-left text-label uppercase text-text-tertiary">
                  <tr>
                    <th scope="col" className="px-5 py-3 font-medium">Asset</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Balance</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assetsWithMeta.map((asset) => {
                    return (
                      <tr
                        key={asset.assetSymbol}
                        className="group transition-colors duration-150 hover:bg-surface-hover/70"
                      >
                        {/* Asset identity */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <CryptoAssetIcon symbol={asset.assetSymbol} size="md" showBadge />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-text-primary">
                                  {asset.assetSymbol}
                                </span>
                                {asset.meta.isFictional && (
                                  <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                                    PLT Token
                                  </Badge>
                                )}
                              </div>
                              <p className="text-body-sm text-text-tertiary">
                                {asset.meta.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Balance */}
                        <td className="px-4 py-3.5 text-right">
                          <CurrencyValue
                            amount={asset.available}
                            assetSymbol={asset.assetSymbol}
                            className="font-medium text-text-primary"
                          />
                        </td>

                        {/* Inline Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href="/deposit">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs font-medium text-primary hover:text-primary-hover hover:bg-primary-soft/50"
                              >
                                Deposit
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (< 640px) */}
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {assetsWithMeta.map((asset) => {
                return (
                  <Card
                    key={asset.assetSymbol}
                    className="rounded-xl border-border bg-surface-elevated p-4 shadow-xs"
                  >
                    {/* Top: Icon + Symbol + Balance */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <CryptoAssetIcon symbol={asset.assetSymbol} size="md" showBadge />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-text-primary">
                              {asset.assetSymbol}
                            </span>
                            {asset.meta.isFictional && (
                              <Badge variant="neutral" className="text-[10px] py-0 px-1.5">
                                PLT Token
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-text-tertiary">
                            {asset.meta.name}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <CurrencyValue
                          amount={asset.available}
                          assetSymbol={asset.assetSymbol}
                          className="font-bold text-text-primary text-base"
                        />
                      </div>
                    </div>

                    {/* Bottom: Touch-friendly Quick Actions */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link href="/deposit" className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full touch-target text-xs font-medium"
                        >
                          Deposit
                        </Button>
                      </Link>
                      <Link href="/withdraw" className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full touch-target text-xs font-medium"
                        >
                          Withdraw
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
