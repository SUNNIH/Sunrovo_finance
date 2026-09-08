import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Download,
  Repeat,
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
import { cn } from "@/lib/utilities/cn";

export const metadata: Metadata = { title: "Wallets" };

// Color palette for proportional portfolio allocation bars
const ALLOCATION_COLORS = [
  "bg-primary",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-indigo-500",
  "bg-sky-500",
  "bg-rose-500",
];

export default async function WalletsPage() {
  const user = await getCurrentUser();
  const wallet = user ? await getWalletForUser(user.id) : null;

  const totalUsdNum = Number(wallet?.totalUsdValue ?? "0");
  const hasAssets = Boolean(wallet && wallet.assets.length > 0);

  // Derive allocation percentages strictly from existing authoritative usdValues
  const assetsWithAllocation = hasAssets
    ? wallet!.assets.map((asset, index) => {
        const usdVal = Number(asset.usdValue);
        const percent = totalUsdNum > 0 ? (usdVal / totalUsdNum) * 100 : 0;
        const colorClass = ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]!;
        const meta = getCryptoAssetMeta(asset.assetSymbol);
        return {
          ...asset,
          usdVal,
          percent,
          colorClass,
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
            Your crypto holdings, spot balances, and portfolio valuation.
          </p>
        </div>
        <Badge variant="warning" className="w-fit shrink-0 sm:mt-1">
          Demo Environment — Simulated Spot Account
        </Badge>
      </div>

      {/* ── Portfolio Overview Hero Card ──────────────────────────────────── */}
      <div
        className={cn(
          "relative overflow-hidden rounded-xl border border-border bg-surface-elevated shadow-sm",
          "transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-md",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-44 before:plt-grid-texture before:opacity-40"
        )}
      >
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Total Balance info */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-body-sm font-medium text-text-secondary">
                  Estimated Portfolio Value
                </span>
                <span className="text-xs text-text-tertiary">(USD)</span>
              </div>

              <div className="mt-2 flex items-baseline gap-3">
                <CurrencyValue
                  amount={wallet?.totalUsdValue ?? "0"}
                  assetSymbol="USD"
                  className="text-[2.25rem] font-bold leading-none tracking-tight text-text-primary tabular-nums"
                />
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-body-sm text-text-secondary">
                <span className="inline-flex items-center gap-1.5 font-medium text-text-primary">
                  <span className="h-2 w-2 rounded-full bg-success" />
                  {wallet?.assets.length ?? 0}{" "}
                  {wallet?.assets.length === 1 ? "Asset" : "Assets"} in Spot
                </span>
                <span className="text-text-tertiary">·</span>
                <span className="text-text-tertiary">
                  Instant settlement on demo trades
                </span>
              </div>
            </div>

            {/* Quick action buttons with clear PLT hierarchy */}
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
              <Link href="/trade">
                <Button variant="outline" size="sm" className="gap-1.5 touch-target sm:min-h-0">
                  <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                  Trade
                </Button>
              </Link>
              <Link href="/convert">
                <Button variant="outline" size="sm" className="gap-1.5 touch-target sm:min-h-0">
                  <Repeat className="h-4 w-4" aria-hidden="true" />
                  Convert
                </Button>
              </Link>
            </div>
          </div>

          {/* Asset Allocation Strip & Legend (only if portfolio has non-zero valuation) */}
          {hasAssets && totalUsdNum > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-2 flex items-center justify-between text-body-sm">
                <span className="font-medium text-text-secondary">
                  Portfolio Allocation
                </span>
                <span className="text-xs text-text-tertiary">
                  Proportional to USD value
                </span>
              </div>

              {/* Progress track */}
              <div
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-hover"
                role="progressbar"
                aria-label="Portfolio asset allocation"
                aria-valuenow={100}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                {assetsWithAllocation
                  .filter((a) => a.percent > 0)
                  .map((asset) => (
                    <div
                      key={asset.assetSymbol}
                      style={{ width: `${Math.max(asset.percent, 1.5)}%` }}
                      className={cn(asset.colorClass, "h-full transition-all duration-300")}
                      title={`${asset.assetSymbol}: ${asset.percent.toFixed(1)}%`}
                    />
                  ))}
              </div>

              {/* Allocation Legend */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
                {assetsWithAllocation
                  .filter((a) => a.percent > 0)
                  .map((asset) => (
                    <div key={asset.assetSymbol} className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", asset.colorClass)} aria-hidden="true" />
                      <span className="font-medium text-text-primary">{asset.assetSymbol}</span>
                      <span className="text-text-tertiary financial-value">
                        {asset.percent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

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
          <Link
            href="/markets"
            className="text-body-sm font-medium text-primary hover:text-primary-hover transition-colors"
          >
            Explore Markets →
          </Link>
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
                Your spot wallet has no funded assets. Deposit demo crypto or convert funds to start trading on simulated markets.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/deposit">
                  <Button variant="primary" size="sm">
                    <Download className="h-4 w-4 mr-1.5" /> Deposit Crypto
                  </Button>
                </Link>
                <Link href="/markets">
                  <Button variant="outline" size="sm">
                    View Markets
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
                    <th scope="col" className="px-4 py-3 text-right font-medium">Available</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">In Orders</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Est. Value (USD)</th>
                    <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {assetsWithAllocation.map((asset) => {
                    const tradeSymbol =
                      asset.assetSymbol === "USDT"
                        ? "BTCUSDT"
                        : `${asset.assetSymbol}USDT`;

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
                                    Demo token
                                  </Badge>
                                )}
                              </div>
                              <p className="text-body-sm text-text-tertiary">
                                {asset.meta.name}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Available */}
                        <td className="px-4 py-3.5 text-right">
                          <CurrencyValue
                            amount={asset.available}
                            assetSymbol={asset.assetSymbol}
                            showSymbol={false}
                            className="font-medium text-text-primary"
                          />
                          <p className="text-xs text-text-tertiary">
                            {asset.assetSymbol}
                          </p>
                        </td>

                        {/* Locked / In Orders */}
                        <td className="px-4 py-3.5 text-right">
                          {Number(asset.locked) > 0 ? (
                            <>
                              <CurrencyValue
                                amount={asset.locked}
                                assetSymbol={asset.assetSymbol}
                                showSymbol={false}
                                className="font-medium text-warning"
                              />
                              <p className="text-xs text-text-tertiary">Locked</p>
                            </>
                          ) : (
                            <span className="text-text-tertiary">0.00</span>
                          )}
                        </td>

                        {/* USD Value */}
                        <td className="px-4 py-3.5 text-right font-semibold text-text-primary">
                          <CurrencyValue
                            amount={asset.usdValue}
                            assetSymbol="USD"
                            className="text-text-primary font-semibold"
                          />
                          {totalUsdNum > 0 && (
                            <p className="text-xs text-text-tertiary financial-value">
                              {asset.percent.toFixed(1)}% of total
                            </p>
                          )}
                        </td>

                        {/* Inline Actions */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/trade?symbol=${tradeSymbol}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs font-medium text-primary hover:text-primary-hover hover:bg-primary-soft/50"
                              >
                                Trade
                              </Button>
                            </Link>
                            <Link href="/convert">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs font-medium text-text-secondary hover:text-text-primary"
                              >
                                Convert
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
              {assetsWithAllocation.map((asset) => {
                const tradeSymbol =
                  asset.assetSymbol === "USDT"
                    ? "BTCUSDT"
                    : `${asset.assetSymbol}USDT`;

                return (
                  <Card
                    key={asset.assetSymbol}
                    className="rounded-xl border-border bg-surface-elevated p-4 shadow-xs"
                  >
                    {/* Top: Icon + Symbol + Total USD */}
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
                                Demo token
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
                          amount={asset.usdValue}
                          assetSymbol="USD"
                          className="font-bold text-text-primary text-base"
                        />
                        {totalUsdNum > 0 && (
                          <p className="text-[11px] text-text-tertiary financial-value">
                            {asset.percent.toFixed(1)}% of total
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Mid: Balance breakdown */}
                    <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-lg bg-surface p-2.5 text-xs">
                      <div>
                        <span className="text-text-tertiary">Available:</span>
                        <p className="financial-value font-medium text-text-primary mt-0.5">
                          <CurrencyValue
                            amount={asset.available}
                            assetSymbol={asset.assetSymbol}
                            showSymbol={false}
                          />{" "}
                          {asset.assetSymbol}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-text-tertiary">In Orders:</span>
                        <p className="financial-value font-medium text-text-secondary mt-0.5">
                          {Number(asset.locked) > 0 ? (
                            <span className="text-warning font-medium">
                              <CurrencyValue
                                amount={asset.locked}
                                assetSymbol={asset.assetSymbol}
                                showSymbol={false}
                              />{" "}
                              {asset.assetSymbol}
                            </span>
                          ) : (
                            "0.00"
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Bottom: Touch-friendly Quick Actions */}
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Link href={`/trade?symbol=${tradeSymbol}`} className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full touch-target text-xs font-medium"
                        >
                          Trade
                        </Button>
                      </Link>
                      <Link href="/convert" className="w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full touch-target text-xs font-medium"
                        >
                          Convert
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
