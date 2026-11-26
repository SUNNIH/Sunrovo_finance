-- AlterTable
ALTER TABLE "crypto_orders" ADD COLUMN "parentOrderId" TEXT;

-- CreateIndex
CREATE INDEX "crypto_orders_parentOrderId_idx" ON "crypto_orders"("parentOrderId");
