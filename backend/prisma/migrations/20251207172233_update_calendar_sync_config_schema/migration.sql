-- UpdateCalendarSyncConfigSchema
-- Align calendar_sync_configs table with current Prisma schema

-- Add new columns
ALTER TABLE "calendar_sync_configs" ADD COLUMN "selectedCalendarIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "calendar_sync_configs" ADD COLUMN "syncPeriodDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "calendar_sync_configs" ADD COLUMN "lastContactImportAt" TIMESTAMP(3);

-- Remove obsolete columns
ALTER TABLE "calendar_sync_configs" DROP COLUMN IF EXISTS "googleCalendarId";
ALTER TABLE "calendar_sync_configs" DROP COLUMN IF EXISTS "outlookCalendarId";

-- Update default for syncEnabled (existing rows keep their values)
ALTER TABLE "calendar_sync_configs" ALTER COLUMN "syncEnabled" SET DEFAULT false;


