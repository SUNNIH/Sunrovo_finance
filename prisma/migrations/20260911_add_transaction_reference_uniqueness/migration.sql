-- Add unique constraint on Transaction.referenceType + referenceId for admin funding idempotency
-- This ensures database-enforced concurrency safety for admin funding operations

-- Create unique index for AdminFunding transactions only
-- This prevents duplicate admin funding with the same idempotency key
CREATE UNIQUE INDEX "transactions_AdminFunding_referenceId_unique" 
  ON "transactions"("referenceId") 
  WHERE "referenceType" = 'AdminFunding';
