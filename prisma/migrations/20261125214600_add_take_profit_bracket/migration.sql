-- Add Take Profit as an internal protective order kind. A combined SL/TP
-- bracket is a single crypto_orders row, with ONE locked asset quantity.
ALTER TYPE "OrderType" ADD VALUE IF NOT EXISTS 'TAKE_PROFIT';

ALTER TABLE "crypto_orders"
  ADD COLUMN IF NOT EXISTS "takeProfitPrice" DECIMAL(36,18),
  ADD COLUMN IF NOT EXISTS "exitTrigger" TEXT;
