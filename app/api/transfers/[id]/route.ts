import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { apiError, apiSuccess } from "@/lib/utilities/api-response";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return apiError("UNAUTHENTICATED", "Sign in to continue.", 401);
  }

  const { id } = await params;
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: { sourceAccount: true, beneficiary: true },
  });

  if (!transfer || transfer.userId !== user.id) {
    return apiError("TRANSFER_NOT_FOUND", "Transfer not found.", 404);
  }

  return apiSuccess({ transfer });
}
