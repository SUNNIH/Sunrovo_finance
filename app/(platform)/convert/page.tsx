import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getWalletForUser } from "@/features/crypto/wallets";
import { ConvertClient } from "./convert-client";

export const metadata: Metadata = { title: "Convert" };

export default async function ConvertPage() {
  const user = await getCurrentUser();
  const wallet = user ? await getWalletForUser(user.id) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Convert</h1>
        <p className="mt-1 text-sm text-text-secondary">Swap between supported assets at the current rate.</p>
      </div>
      <ConvertClient assets={wallet?.assets ?? []} />
    </div>
  );
}
