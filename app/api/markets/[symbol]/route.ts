import { getTicker } from "@/lib/bybit/client";
import { AuthError } from "@/features/authentication/errors";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  try {
    const ticker = await getTicker(symbol);
    return apiSuccess({ ticker });
  } catch (error) {
    if (error instanceof AuthError) {
      return apiError(error.code, error.message, error.status);
    }
    return apiError("UNSUPPORTED_SYMBOL", `${symbol} is not a supported trading pair.`, 404);
  }
}
