"use server";
import { getCurrentUser } from "@/lib/auth/session";
import { openDirectionalPosition, closeDirectionalPosition } from "@/features/directional/positions";
import { revalidatePath } from "next/cache";

export async function openDirectionalPositionAction(input: {
  walletId: string;
  symbol: string;
  side: "LONG" | "SHORT";
  quantity: string;
  stopLossPrice?: string | null;
  takeProfitPrice?: string | null;
  idempotencyKey: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };
  const result = await openDirectionalPosition({ ...input, userId: user.id });
  if (result.success) {
    revalidatePath("/trade");
    revalidatePath("/wallets");
  }
  return result;
}

export async function closeDirectionalPositionAction(positionId: string, idempotencyKey: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Not authenticated" };
  const result = await closeDirectionalPosition({ userId: user.id, positionId, idempotencyKey, reason: "MANUAL" });
  if (result.success) {
    revalidatePath("/trade");
    revalidatePath("/wallets");
  }
  return result;
}
