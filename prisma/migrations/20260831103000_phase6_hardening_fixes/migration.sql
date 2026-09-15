-- Phase 6 hardening: use an explicit unscoped sentinel so PostgreSQL can
-- enforce uniqueness for every withdrawal-destination scope.
UPDATE "withdrawal_allowlist_entries" SET "assetSymbol" = '' WHERE "assetSymbol" IS NULL;
UPDATE "withdrawal_allowlist_entries" SET "network" = '' WHERE "network" IS NULL;

DROP INDEX IF EXISTS "withdrawal_allowlist_entries_userId_assetSymbol_network_destination_key";
ALTER TABLE "withdrawal_allowlist_entries"
  ALTER COLUMN "assetSymbol" SET DEFAULT '',
  ALTER COLUMN "assetSymbol" SET NOT NULL,
  ALTER COLUMN "network" SET DEFAULT '',
  ALTER COLUMN "network" SET NOT NULL;
CREATE UNIQUE INDEX "withdrawal_allowlist_entries_userId_assetSymbol_network_destination_key"
  ON "withdrawal_allowlist_entries"("userId", "assetSymbol", "network", "destination");
