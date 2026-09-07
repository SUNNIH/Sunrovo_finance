import { getRecentTrades } from "@/lib/bybit/client";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  try {
    const trades = await getRecentTrades(symbol);
    return apiSuccess({ trades });
  } catch {
    return apiError("UNSUPPORTED_SYMBOL", `${symbol} is not a supported trading pair.`, 404);
  }
}
