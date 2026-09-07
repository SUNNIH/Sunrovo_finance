import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type { RequestCardInput } from "@/lib/validation/treasury";
import { AuthError } from "@/features/authentication/errors";

const SAMPLE_MERCHANTS = ["Amazon", "Uber", "Netflix", "Whole Foods", "Shell Gas Station", "Spotify"];

function generateMaskedCardNumber(): string {
  const last4 = String(randomInt(1000, 9999));
  return `•••• •••• •••• ${last4}`;
}

export async function listCards(userId: string) {
  return prisma.card.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
}

export async function requestCard(userId: string, input: RequestCardInput) {
  const now = new Date();
  const expiry = new Date(now.getFullYear() + 3, now.getMonth());

  const card = await prisma.card.create({
    data: {
      userId,
      formFactor: input.formFactor,
      maskedNumber: generateMaskedCardNumber(),
      expiryMonth: expiry.getMonth() + 1,
      expiryYear: expiry.getFullYear(),
      currencySymbol: input.currencySymbol,
      status: "ACTIVE",
    },
  });

  // A few sample transactions purely so the card doesn't render as an
  // empty, lifeless demo the moment it's issued — clearly fictional
  // merchants, not a real card network feed.
  const sampleCount = randomInt(2, 5);
  await prisma.cardTransaction.createMany({
    data: Array.from({ length: sampleCount }, () => ({
      cardId: card.id,
      merchant: SAMPLE_MERCHANTS[randomInt(0, SAMPLE_MERCHANTS.length)]!,
      amount: (randomInt(500, 15000) / 100).toFixed(2),
      currencySymbol: input.currencySymbol,
      status: "COMPLETED" as const,
    })),
  });

  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "card.request", targetType: "Card", targetId: card.id });
  return card;
}

async function getOwnedCard(userId: string, cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId) {
    throw new AuthError("CARD_NOT_FOUND", "Card not found.", 404);
  }
  return card;
}

export async function setCardFrozen(userId: string, cardId: string, frozen: boolean) {
  const card = await getOwnedCard(userId, cardId);
  if (card.status === "LOST" || card.status === "CANCELLED") {
    throw new AuthError("CARD_NOT_ACTIVE", "This card can no longer be modified.", 422);
  }
  const updated = await prisma.card.update({
    where: { id: cardId },
    data: { status: frozen ? "FROZEN" : "ACTIVE" },
  });
  await writeAuditLog({
    actorUserId: userId,
    actorRole: "USER",
    action: frozen ? "card.freeze" : "card.unfreeze",
    targetType: "Card",
    targetId: cardId,
  });
  return updated;
}

export async function reportCardLost(userId: string, cardId: string) {
  await getOwnedCard(userId, cardId);
  const updated = await prisma.card.update({ where: { id: cardId }, data: { status: "LOST" } });
  await writeAuditLog({ actorUserId: userId, actorRole: "USER", action: "card.report_lost", targetType: "Card", targetId: cardId });
  return updated;
}

export async function setCardSpendingLimit(userId: string, cardId: string, spendingLimit: string) {
  await getOwnedCard(userId, cardId);
  return prisma.card.update({ where: { id: cardId }, data: { spendingLimit } });
}

export async function listCardTransactions(userId: string, cardId: string) {
  await getOwnedCard(userId, cardId);
  return prisma.cardTransaction.findMany({ where: { cardId }, orderBy: { createdAt: "desc" } });
}
