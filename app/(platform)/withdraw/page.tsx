import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getAccountsForUser } from "@/features/banking/accounts";
import { getWalletForUser } from "@/features/crypto/wallets";
import { WithdrawClient } from "./withdraw-client";

export const metadata: Metadata = { title: "Withdraw" };

export default async function WithdrawPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [accounts, wallet] = await Promise.all([
    getAccountsForUser(user.id),
    getWalletForUser(user.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Withdraw</h1>
        <p className="mt-1 text-sm text-text-secondary">Simulated withdrawals — no real funds ever leave PLT.</p>
      </div>
      <WithdrawClient
        fiatAssets={[...new Set(accounts.map((a) => a.currencySymbol))]}
        cryptoAssets={wallet?.assets.map((a) => a.assetSymbol) ?? []}
      />
    </div>
  );
}
