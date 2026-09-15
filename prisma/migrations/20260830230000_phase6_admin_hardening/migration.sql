-- Additive Phase 6 migration. No existing financial records are rewritten.
ALTER TABLE "withdrawals"
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "reversalLedgerGroupId" TEXT;

CREATE TABLE "withdrawal_allowlist_entries" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "assetSymbol" TEXT,
  "network" TEXT,
  "destination" TEXT NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "withdrawal_allowlist_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "withdrawal_allowlist_entries_userId_assetSymbol_network_destination_key"
  ON "withdrawal_allowlist_entries"("userId", "assetSymbol", "network", "destination");
CREATE INDEX "withdrawal_allowlist_entries_userId_destination_idx"
  ON "withdrawal_allowlist_entries"("userId", "destination");
ALTER TABLE "withdrawal_allowlist_entries"
  ADD CONSTRAINT "withdrawal_allowlist_entries_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "announcements" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "announcements_isActive_publishedAt_idx" ON "announcements"("isActive", "publishedAt");
ALTER TABLE "announcements"
  ADD CONSTRAINT "announcements_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "platform_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "maintenanceMessage" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
INSERT INTO "platform_settings" ("id", "maintenanceMode", "updatedAt")
VALUES ('default', false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
