import { getCurrentUser } from "@/lib/auth/session";
import { getMarketsList } from "@/features/crypto/markets";
import { apiSuccess } from "@/lib/utilities/api-response";

export async function GET() {
  const user = await getCurrentUser();
  const markets = await getMarketsList(user?.id);
  return apiSuccess({ markets });
}
