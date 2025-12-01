/*
  Warnings:

  - You are about to drop the column `organizationId` on the `contact_employments` table. All the data in the column will be lost.
  - You are about to drop the `custom_roles` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `invitations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `organizations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_activity_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspaces` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `companyId` to the `contact_employments` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrgInvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'canceled');

-- CreateEnum
CREATE TYPE "AISummaryType" AS ENUM ('TIMELINE', 'RECOMMENDATIONS', 'RELATIONSHIP');

-- CreateEnum
CREATE TYPE "EmailDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- DropForeignKey
ALTER TABLE "contact_employments" DROP CONSTRAINT "contact_employments_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "custom_roles" DROP CONSTRAINT "custom_roles_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_userId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_activity_logs" DROP CONSTRAINT "workspace_activity_logs_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_customRoleId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_userId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_ownerId_fkey";

-- DropIndex
DROP INDEX "contact_employments_organizationId_idx";

-- DropIndex
DROP INDEX "contacts_embedding_vector_idx";

-- AlterTable
ALTER TABLE "contact_employments" DROP COLUMN "organizationId",
ADD COLUMN     "companyId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "session" ADD COLUMN     "activeOrganizationId" TEXT;

-- DropTable
DROP TABLE "custom_roles";

-- DropTable
DROP TABLE "invitations";

-- DropTable
DROP TABLE "organizations";

-- DropTable
DROP TABLE "workspace_activity_logs";

-- DropTable
DROP TABLE "workspace_members";

-- DropTable
DROP TABLE "workspaces";

-- DropEnum
DROP TYPE "InvitationStatus";

-- DropEnum
DROP TYPE "WorkspaceRole";

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "status" "OrgInvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_ai_summaries" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "summaryType" "AISummaryType" NOT NULL,
    "content" TEXT NOT NULL,
    "recommendations" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailsIncluded" INTEGER NOT NULL DEFAULT 0,
    "lastEmailDate" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "contact_ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_threads" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT,
    "snippet" TEXT,
    "body" TEXT,
    "direction" "EmailDirection" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'gmail',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "size" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "organization_slug_idx" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "member"("userId");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");

-- CreateIndex
CREATE INDEX "member_role_idx" ON "member"("role");

-- CreateIndex
CREATE UNIQUE INDEX "member_userId_organizationId_key" ON "member"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

-- CreateIndex
CREATE INDEX "invitation_inviterId_idx" ON "invitation"("inviterId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_status_idx" ON "invitation"("status");

-- CreateIndex
CREATE INDEX "contact_ai_summaries_contactId_idx" ON "contact_ai_summaries"("contactId");

-- CreateIndex
CREATE INDEX "contact_ai_summaries_summaryType_idx" ON "contact_ai_summaries"("summaryType");

-- CreateIndex
CREATE INDEX "contact_ai_summaries_generatedAt_idx" ON "contact_ai_summaries"("generatedAt");

-- CreateIndex
CREATE INDEX "contact_ai_summaries_expiresAt_idx" ON "contact_ai_summaries"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "contact_ai_summaries_contactId_summaryType_key" ON "contact_ai_summaries"("contactId", "summaryType");

-- CreateIndex
CREATE INDEX "email_threads_contactId_idx" ON "email_threads"("contactId");

-- CreateIndex
CREATE INDEX "email_threads_threadId_idx" ON "email_threads"("threadId");

-- CreateIndex
CREATE INDEX "email_threads_occurredAt_idx" ON "email_threads"("occurredAt");

-- CreateIndex
CREATE INDEX "email_threads_source_idx" ON "email_threads"("source");

-- CreateIndex
CREATE UNIQUE INDEX "email_threads_contactId_externalId_key" ON "email_threads"("contactId", "externalId");

-- CreateIndex
CREATE INDEX "companies_userId_idx" ON "companies"("userId");

-- CreateIndex
CREATE INDEX "companies_domain_idx" ON "companies"("domain");

-- CreateIndex
CREATE INDEX "companies_deletedAt_idx" ON "companies"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "companies_userId_name_key" ON "companies"("userId", "name");

-- CreateIndex
CREATE INDEX "contact_employments_companyId_idx" ON "contact_employments"("companyId");

-- CreateIndex
CREATE INDEX "session_activeOrganizationId_idx" ON "session"("activeOrganizationId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_activeOrganizationId_fkey" FOREIGN KEY ("activeOrganizationId") REFERENCES "organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_ai_summaries" ADD CONSTRAINT "contact_ai_summaries_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
