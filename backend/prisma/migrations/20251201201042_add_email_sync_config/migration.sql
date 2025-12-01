/*
  Warnings:

  - The `status` column on the `invitation` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'canceled');

-- AlterTable
ALTER TABLE "invitation" DROP COLUMN "status",
ADD COLUMN     "status" "InvitationStatus" NOT NULL DEFAULT 'pending';

-- DropEnum
DROP TYPE "OrgInvitationStatus";

-- CreateTable
CREATE TABLE "email_sync_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "outlookEnabled" BOOLEAN NOT NULL DEFAULT false,
    "privacyMode" BOOLEAN NOT NULL DEFAULT true,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "excludedEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncToken" TEXT,
    "lastGmailSync" TIMESTAMP(3),
    "lastOutlookSync" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sync_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_sync_configs_userId_key" ON "email_sync_configs"("userId");

-- CreateIndex
CREATE INDEX "email_sync_configs_userId_idx" ON "email_sync_configs"("userId");

-- CreateIndex
CREATE INDEX "email_sync_configs_syncEnabled_idx" ON "email_sync_configs"("syncEnabled");

-- CreateIndex
CREATE INDEX "email_sync_configs_gmailEnabled_idx" ON "email_sync_configs"("gmailEnabled");

-- CreateIndex
CREATE INDEX "invitation_status_idx" ON "invitation"("status");

-- AddForeignKey
ALTER TABLE "email_sync_configs" ADD CONSTRAINT "email_sync_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
