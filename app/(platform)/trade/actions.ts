"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { placeOrder, cancelOrder } from "@/features/crypto/trading";
import { revalidatePath } from "next/cache";

interface PlaceOrderInput {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT" | "STOP_LOSS";
  quantity?: string;
  quoteAmount?: string; // USDT spending amount for BUY orders
  limitPrice?: string;
  stopPrice?: string; // Optional attached Stop Loss
  takeProfitPrice?: string; // Optional attached Take Profit
  idempotencyKey: string;
}

export async function placeTradeOrderAction(input: PlaceOrderInput) {
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
    quoteAmount: input.quoteAmount,
    limitPrice: input.limitPrice,
    stopPrice: input.stopPrice,
    takeProfitPrice: input.takeProfitPrice,
    idempotencyKey: input.idempotencyKey,
  });

  if (result.success) {
    // Revalidate relevant pages
    revalidatePath("/trade");
    revalidatePath("/wallets");
    revalidatePath("/orders");
    revalidatePath(`/markets/${input.symbol}`);
  }

  return result;
}

export async function cancelTradeOrderAction(orderId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Not authenticated" };
  }

  const result = await cancelOrder({
    userId: user.id,
    orderId,
  });

  if (result.success) {
    // Revalidate relevant pages
    revalidatePath("/trade");
    revalidatePath("/wallets");
    revalidatePath("/orders");
  }

  return result;
}
