import { getCandles } from "@/lib/bybit/client";
import type { KlineInterval } from "@/lib/bybit/types";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

const VALID_INTERVALS: readonly string[] = ["1", "5", "15", "60", "240", "D"];

export async function GET(request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const url = new URL(request.url);
  const intervalParam = url.searchParams.get("interval") ?? "60";
  const interval = (VALID_INTERVALS.includes(intervalParam) ? intervalParam : "60") as KlineInterval;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "120") || 120, 500);

  try {
    const candles = await getCandles(symbol, interval, limit);
    return apiSuccess({ candles });
  } catch {
    return apiError("UNSUPPORTED_SYMBOL", `${symbol} is not a supported trading pair.`, 404);
  }
}
