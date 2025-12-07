-- CreateEnum
CREATE TYPE "EmailParticipationType" AS ENUM ('SENDER', 'RECIPIENT', 'CC');

-- AlterTable
ALTER TABLE "email_threads" ADD COLUMN     "participationType" "EmailParticipationType" NOT NULL DEFAULT 'RECIPIENT';

-- CreateIndex
CREATE INDEX "email_threads_participationType_idx" ON "email_threads"("participationType");
