import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/session";
import { listCards } from "@/features/treasury/cards";
import { CardsClient } from "./cards-client";

export const metadata: Metadata = { title: "Cards" };

export default async function CardsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const cards = await listCards(user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-page-title-mobile text-text-primary sm:text-page-title">Cards</h1>
        <p className="mt-1 text-sm text-text-secondary">Manage your FHT cards and card settings.</p>
      </div>
      <CardsClient
        initialCards={cards.map((c) => ({
          id: c.id,
          formFactor: c.formFactor,
          maskedNumber: c.maskedNumber,
          expiryMonth: c.expiryMonth,
          expiryYear: c.expiryYear,
          status: c.status,
          spendingLimit: c.spendingLimit?.toString() ?? null,
          currencySymbol: c.currencySymbol,
        }))}
      />
    </div>
  );
}
