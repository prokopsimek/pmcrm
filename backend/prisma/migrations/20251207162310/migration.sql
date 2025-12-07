-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContactSource" ADD VALUE 'GOOGLE_CALENDAR';
ALTER TYPE "ContactSource" ADD VALUE 'MICROSOFT_CALENDAR';

-- DropIndex
DROP INDEX "idx_activity_logs_user_created";

-- DropIndex
DROP INDEX "idx_ai_insights_contact_type";

-- DropIndex
DROP INDEX "idx_email_threads_contact_occurred";

-- DropIndex
DROP INDEX "idx_generated_icebreakers_contact_recent";

-- DropIndex
DROP INDEX "idx_interactions_type_occurred";

-- DropIndex
DROP INDEX "idx_interactions_user_occurred";

-- DropIndex
DROP INDEX "idx_notes_contact_pinned";
