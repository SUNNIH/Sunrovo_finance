"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { placeOrder, cancelOrder, getUserOpenOrders } from "@/features/crypto/trading";
import { revalidatePath } from "next/cache";

interface PlaceOrderInput {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  limitPrice?: string;
  idempotencyKey: string;
}

export async function placeOrderAction(input: PlaceOrderInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await placeOrder({
    userId: user.id,
    symbol: input.symbol,
    side: input.side,
    type: input.type,
    quantity: input.quantity,
    limitPrice: input.limitPrice,
    idempotencyKey: input.idempotencyKey,
  });

  if (result.success) {
    // Revalidate wallet and orders pages
    revalidatePath("/wallets");
    revalidatePath("/orders");
    revalidatePath(`/markets/${input.symbol}`);
  }

  return result;
}

export async function cancelOrderAction(orderId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await cancelOrder({
    userId: user.id,
    orderId,
  });

  if (result.success) {
    // Revalidate wallet and orders pages
    revalidatePath("/wallets");
    revalidatePath("/orders");
  }

  return result;
}

export async function getOpenOrdersAction() {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  return await getUserOpenOrders(user.id);
}
