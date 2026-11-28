import type { Metadata } from "next";
import Link from "next/link";
import Decimal from "decimal.js";
import {
  ArrowUpRight,
  Download,
  Wallet as WalletIcon,
  TrendingUp,
  AlertCircle,
  Clock,
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
import { cn } from "@/lib/utilities/cn";
import type { MarketDataStatus } from "@/lib/market/types";

export const metadata: Metadata = { title: "Wallets" };

/**
 * Phase 3: Cryptocurrency wallet with live market valuation
 * 
 * Displays native crypto balances with USDT market prices and valuations.
 * Shows Live, Stale, and Unavailable price states.
 * Preserves native balances during provider outages.
 */
function formatUsdtPrice(price: Decimal): string {
  if (price.isZero()) return "0";

  if (price.abs().greaterThanOrEqualTo(1)) {
    return price.toFixed(2);
  }

  return price.toSignificantDigits(6).toFixed();
}

function PriceStatusBadge({ status }: { status: MarketDataStatus }) {
  if (status === "live") {
    return (
      <Badge variant="success" className="text-[10px] py-0.5 px-1.5 gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
        Live
      </Badge>
    );
  }

  if (status === "stale") {
    return (
      <Badge variant="warning" className="text-[10px] py-0.5 px-1.5 gap-1">
        <Clock className="h-2.5 w-2.5" />
        Stale
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" className="text-[10px] py-0.5 px-1.5 gap-1">
      <AlertCircle className="h-2.5 w-2.5" />
      Unavailable
    </Badge>
  );
}

export default async function WalletsPage() {
  const user = await getCurrentUser();
  const wallet = user ? await getWalletForUser(user.id) : null;

  const hasAssets = Boolean(wallet && wallet.assets.length > 0);

  const assetsWithMeta = hasAssets
    ? wallet!.assets.map((asset) => {
        const meta = getCryptoAssetMeta(asset.assetSymbol);
        const totalBalance = new Decimal(asset.available).plus(asset.locked);
        return {
          ...asset,
          meta,
          totalBalance: totalBalance.toString(),
        };
      })
    : [];

  // Format portfolio total
  const portfolioTotal = wallet?.totalUsdtValue
    ? new Decimal(wallet.totalUsdtValue).toFixed(2)
    : null;

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
            Your crypto balances with live market valuations in USDT.
          </p>
        </div>
      </div>

      {/* ── Portfolio Overview Hero Card ──────────────────────────────────── */}
      <Card className="rounded-xl border-border bg-surface-elevated p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          {/* Wallet info & Portfolio Value */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-body-sm font-medium text-text-secondary">
                Portfolio Value
              </span>
              {wallet?.hasIncompleteValuation && (
                <Badge variant="warning" className="text-[10px] py-0.5 px-1.5 gap-1">
                  <AlertCircle className="h-2.5 w-2.5" />
                  Incomplete
                </Badge>
              )}
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              {portfolioTotal ? (
                <>
                  <span className="text-3xl font-bold text-text-primary tabular-nums sm:text-4xl">
                    {portfolioTotal.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                  </span>
                  <span className="text-lg font-medium text-text-secondary">
                    USDT
                  </span>
                </>
              ) : (
                <span className="text-2xl font-bold text-text-tertiary">
                  {wallet?.hasIncompleteValuation
                    ? "Valuation incomplete"
                    : "—"}
                </span>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2.5 text-body-sm text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <WalletIcon className="h-4 w-4" aria-hidden="true" />
                {wallet?.assets.length ?? 0}{" "}
                {wallet?.assets.length === 1 ? "Asset" : "Assets"}
              </span>
              {wallet?.hasIncompleteValuation && (
                <span className="text-warning">
                  • Some prices unavailable
                </span>
              )}
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
            <Link href="/markets">
              <Button variant="ghost" size="sm" className="gap-1.5 touch-target sm:min-h-0">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                Markets
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
                    <th scope="col" className="px-4 py-3 text-right font-medium">Price (USDT)</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Value (USDT)</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assetsWithMeta.map((asset) => {
                    const priceDecimal = asset.usdtPrice ? new Decimal(asset.usdtPrice) : null;
                    const valueDecimal = asset.usdtValue ? new Decimal(asset.usdtValue) : null;

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
                            amount={asset.totalBalance}
                            assetSymbol={asset.assetSymbol}
                            className="font-medium text-text-primary"
                          />
                          {new Decimal(asset.locked).greaterThan(0) && (
                            <div className="mt-0.5 text-xs text-text-tertiary">
                              {new Decimal(asset.locked).toFixed()} locked
                            </div>
                          )}
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex flex-col items-end gap-1">
                            {priceDecimal ? (
                              <span className="font-mono text-text-primary tabular-nums">
                                {formatUsdtPrice(priceDecimal)}
                              </span>
                            ) : (
                              <span className="text-text-tertiary">—</span>
                            )}
                            <PriceStatusBadge status={asset.priceStatus} />
                          </div>
                        </td>

                        {/* Value */}
                        <td className="px-4 py-3.5 text-right">
                          {valueDecimal ? (
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                asset.priceStatus === "live"
                                  ? "text-text-primary"
                                  : "text-text-secondary"
                              )}
                            >
                              {valueDecimal.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-text-tertiary">—</span>
                          )}
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
                const priceDecimal = asset.usdtPrice ? new Decimal(asset.usdtPrice) : null;
                const valueDecimal = asset.usdtValue ? new Decimal(asset.usdtValue) : null;

                return (
                  <Card
                    key={asset.assetSymbol}
                    className="rounded-xl border-border bg-surface-elevated p-4 shadow-xs"
                  >
                    {/* Top: Icon + Symbol + Balance */}
                    <div className="flex items-start justify-between mb-3">
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

                      <PriceStatusBadge status={asset.priceStatus} />
                    </div>

                    {/* Balance & Value */}
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-tertiary">Balance:</span>
                        <CurrencyValue
                          amount={asset.totalBalance}
                          assetSymbol={asset.assetSymbol}
                          className="font-bold text-text-primary"
                        />
                      </div>
                      {priceDecimal && (
                        <div className="flex justify-between text-sm">
                          <span className="text-text-tertiary">Price:</span>
                          <span className="font-mono text-text-primary tabular-nums">
                            {formatUsdtPrice(priceDecimal)} USDT
                          </span>
                        </div>
                      )}
                      {valueDecimal && (
                        <div className="flex justify-between">
                          <span className="text-text-tertiary text-sm">Est. Value:</span>
                          <span
                            className={cn(
                              "font-semibold tabular-nums",
                              asset.priceStatus === "live"
                                ? "text-text-primary"
                                : "text-text-secondary"
                            )}
                          >
                            {valueDecimal.toFixed(2)} USDT
                          </span>
                        </div>
                      )}
                      {new Decimal(asset.locked).greaterThan(0) && (
                        <div className="text-xs text-text-tertiary">
                          {new Decimal(asset.locked).toFixed()} locked
                        </div>
                      )}
                    </div>

                    {/* Bottom: Touch-friendly Quick Actions */}
                    <div className="grid grid-cols-2 gap-2">
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
