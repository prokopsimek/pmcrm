-- AlterTable
ALTER TABLE "email_sync_configs" ADD COLUMN "syncHistoryDays" INTEGER NOT NULL DEFAULT 365;
