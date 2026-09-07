import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { getMarketsList } from "@/features/crypto/markets";
import { MarketsClient } from "./markets-client";

export const metadata: Metadata = { title: "Markets" };

export default async function MarketsPage() {
  const user = await getCurrentUser();
  const markets = await getMarketsList(user?.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Markets</h1>
        <p className="mt-1 text-sm text-text-secondary">Live spot prices for supported assets.</p>
      </div>
      <MarketsClient initialMarkets={markets} />
    </div>
  );
}
