-- Isolated, simulated 1x directional positions. No changes to spot orders.
CREATE TYPE "DirectionalSide" AS ENUM ('LONG', 'SHORT');
CREATE TYPE "DirectionalPositionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "DirectionalCloseReason" AS ENUM ('MANUAL', 'TAKE_PROFIT', 'STOP_LOSS', 'LIQUIDATION');

CREATE TABLE "directional_positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "quoteAsset" TEXT NOT NULL DEFAULT 'USDT',
    "side" "DirectionalSide" NOT NULL,
    "status" "DirectionalPositionStatus" NOT NULL DEFAULT 'OPEN',
    "quantity" DECIMAL(36,18) NOT NULL,
    "entryPrice" DECIMAL(36,18) NOT NULL,
    "margin" DECIMAL(36,18) NOT NULL,
    "entryFee" DECIMAL(36,18) NOT NULL,
    "stopLossPrice" DECIMAL(36,18),
    "takeProfitPrice" DECIMAL(36,18),
    "closePrice" DECIMAL(36,18),
    "closeReason" "DirectionalCloseReason",
    "grossPnl" DECIMAL(36,18),
    "netPnl" DECIMAL(36,18),
    "exitFee" DECIMAL(36,18),
    "payout" DECIMAL(36,18),
    "insuranceLoss" DECIMAL(36,18),
    "idempotencyKey" TEXT NOT NULL,
    "closeIdempotencyKey" TEXT,
    "openedLedgerGroupId" TEXT,
    "closedLedgerGroupId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    CONSTRAINT "directional_positions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "directional_positions_positive_values_ck" CHECK (
      "quantity" > 0 AND "entryPrice" > 0 AND "margin" > 0 AND "entryFee" >= 0 AND
      ("stopLossPrice" IS NULL OR "stopLossPrice" > 0) AND
      ("takeProfitPrice" IS NULL OR "takeProfitPrice" > 0)
    ),
    CONSTRAINT "directional_positions_closed_values_ck" CHECK (
      ("status" = 'OPEN' AND "closedAt" IS NULL AND "closePrice" IS NULL AND "closeReason" IS NULL) OR
      ("status" = 'CLOSED' AND "closedAt" IS NOT NULL AND "closePrice" > 0 AND
        "closeReason" IS NOT NULL AND "grossPnl" IS NOT NULL AND "netPnl" IS NOT NULL AND
        "exitFee" >= 0 AND "payout" >= 0 AND "insuranceLoss" >= 0)
    )
);

CREATE UNIQUE INDEX "directional_positions_idempotencyKey_key" ON "directional_positions"("idempotencyKey");
CREATE UNIQUE INDEX "directional_positions_closeIdempotencyKey_key" ON "directional_positions"("closeIdempotencyKey");
CREATE INDEX "directional_positions_userId_openedAt_idx" ON "directional_positions"("userId", "openedAt");
CREATE INDEX "directional_positions_status_symbol_idx" ON "directional_positions"("status", "symbol");
CREATE INDEX "directional_positions_userId_status_symbol_idx" ON "directional_positions"("userId", "status", "symbol");
ALTER TABLE "directional_positions" ADD CONSTRAINT "directional_positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "directional_positions" ADD CONSTRAINT "directional_positions_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "crypto_wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
