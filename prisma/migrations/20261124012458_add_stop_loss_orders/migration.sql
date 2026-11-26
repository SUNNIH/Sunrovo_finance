-- Add STOP_LOSS to OrderType enum
ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'STOP_LOSS';

-- Add stopPrice column for stop-loss trigger price
ALTER TABLE "crypto_orders" ADD COLUMN IF NOT EXISTS "stopPrice" DECIMAL(36,18);

-- Add composite index for efficient stop-loss monitoring
CREATE INDEX IF NOT EXISTS "crypto_orders_status_type_symbol_idx" ON "crypto_orders"("status", "type", "symbol");
