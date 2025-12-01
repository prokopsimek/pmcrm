-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ContactSource" AS ENUM ('MANUAL', 'IMPORT', 'LINKEDIN', 'EMAIL', 'GOOGLE_CONTACTS', 'MICROSOFT_CONTACTS', 'API');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('EMAIL', 'CALL', 'MEETING', 'NOTE', 'LINKEDIN_MESSAGE', 'LINKEDIN_CONNECTION', 'TASK_COMPLETED', 'REMINDER_TRIGGERED', 'OTHER');

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'DISMISSED', 'SNOOZED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('RELATIONSHIP_STRENGTH', 'CONTACT_RECOMMENDATION', 'INTERACTION_PATTERN', 'IMPORTANCE_CHANGE', 'NETWORKING_OPPORTUNITY', 'FOLLOW_UP_SUGGESTION');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('GMAIL', 'GOOGLE_CALENDAR', 'GOOGLE_CONTACTS', 'MICROSOFT_CONTACTS', 'LINKEDIN', 'OUTLOOK', 'SLACK', 'SALESFORCE', 'HUBSPOT');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REMINDER', 'INSIGHT', 'INTEGRATION_SYNC', 'SYSTEM', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'READONLY');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('TRIAL', 'FREE', 'PRO', 'TEAM', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED', 'PAST_DUE');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "image" TEXT,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "position" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
    "lastContact" TIMESTAMP(3),
    "frequency" INTEGER NOT NULL DEFAULT 0,
    "importance" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3),
    "search_vector" TEXT,
    "embedding_vector" vector(1536),
    "embedding_updated_at" TIMESTAMP(3),
    "linkedinUrl" TEXT,
    "enrichmentData" JSONB,
    "enrichedAt" TIMESTAMP(3),
    "enrichmentProvider" TEXT,
    "enrichmentLastUpdate" TIMESTAMP(3),
    "enrichmentSource" TEXT,
    "contactFrequencyDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_activities" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "dueAt" TIMESTAMP(3),
    "frequencyDays" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "snoozedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_connections" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "connectedToId" TEXT NOT NULL,
    "relationship" TEXT,
    "strength" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "network_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "InsightType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isHelpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_links" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo" TEXT,
    "ownerId" TEXT NOT NULL,
    "settings" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "customRoleId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "invitedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" TEXT NOT NULL,
    "completedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'TRIAL',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "trialEndsAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "paymentMethodId" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_logs" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "cost" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_roles" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_activity_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "targetEmail" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_sync_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleCalendarId" TEXT DEFAULT 'primary',
    "outlookCalendarId" TEXT,
    "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
    "syncToken" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_sync_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "interactionType" TEXT NOT NULL,
    "subject" TEXT,
    "summary" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,
    "externalSource" TEXT,
    "meetingData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_participants" (
    "id" TEXT NOT NULL,
    "interactionId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'attendee',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
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

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_employments" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_employments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_tags" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_token_idx" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "account_providerId_accountId_idx" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "contacts_userId_idx" ON "contacts"("userId");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_company_idx" ON "contacts"("company");

-- CreateIndex
CREATE INDEX "contacts_tags_idx" ON "contacts"("tags");

-- CreateIndex
CREATE INDEX "contacts_linkedinUrl_idx" ON "contacts"("linkedinUrl");

-- CreateIndex
CREATE INDEX "contacts_enrichedAt_idx" ON "contacts"("enrichedAt");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_userId_email_key" ON "contacts"("userId", "email");

-- CreateIndex
CREATE INDEX "contact_activities_contactId_idx" ON "contact_activities"("contactId");

-- CreateIndex
CREATE INDEX "contact_activities_userId_idx" ON "contact_activities"("userId");

-- CreateIndex
CREATE INDEX "contact_activities_occurredAt_idx" ON "contact_activities"("occurredAt");

-- CreateIndex
CREATE INDEX "reminders_contactId_idx" ON "reminders"("contactId");

-- CreateIndex
CREATE INDEX "reminders_scheduledFor_idx" ON "reminders"("scheduledFor");

-- CreateIndex
CREATE INDEX "reminders_dueAt_idx" ON "reminders"("dueAt");

-- CreateIndex
CREATE INDEX "reminders_status_idx" ON "reminders"("status");

-- CreateIndex
CREATE INDEX "reminders_priority_idx" ON "reminders"("priority");

-- CreateIndex
CREATE INDEX "network_connections_contactId_idx" ON "network_connections"("contactId");

-- CreateIndex
CREATE INDEX "network_connections_connectedToId_idx" ON "network_connections"("connectedToId");

-- CreateIndex
CREATE UNIQUE INDEX "network_connections_contactId_connectedToId_key" ON "network_connections"("contactId", "connectedToId");

-- CreateIndex
CREATE INDEX "ai_insights_contactId_idx" ON "ai_insights"("contactId");

-- CreateIndex
CREATE INDEX "ai_insights_type_idx" ON "ai_insights"("type");

-- CreateIndex
CREATE INDEX "ai_insights_createdAt_idx" ON "ai_insights"("createdAt");

-- CreateIndex
CREATE INDEX "recommendation_feedback_recommendationId_idx" ON "recommendation_feedback"("recommendationId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_userId_idx" ON "recommendation_feedback"("userId");

-- CreateIndex
CREATE INDEX "recommendation_feedback_createdAt_idx" ON "recommendation_feedback"("createdAt");

-- CreateIndex
CREATE INDEX "integrations_userId_idx" ON "integrations"("userId");

-- CreateIndex
CREATE INDEX "integrations_type_idx" ON "integrations"("type");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_userId_type_key" ON "integrations"("userId", "type");

-- CreateIndex
CREATE INDEX "integration_links_integrationId_idx" ON "integration_links"("integrationId");

-- CreateIndex
CREATE INDEX "integration_links_contactId_idx" ON "integration_links"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "integration_links_integrationId_externalId_key" ON "integration_links"("integrationId", "externalId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "search_history_userId_idx" ON "search_history"("userId");

-- CreateIndex
CREATE INDEX "search_history_createdAt_idx" ON "search_history"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_entity_entityId_idx" ON "activity_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "workspaces_ownerId_idx" ON "workspaces"("ownerId");

-- CreateIndex
CREATE INDEX "workspace_members_workspaceId_idx" ON "workspace_members"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_members_userId_idx" ON "workspace_members"("userId");

-- CreateIndex
CREATE INDEX "workspace_members_customRoleId_idx" ON "workspace_members"("customRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspaceId_userId_key" ON "workspace_members"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_workspaceId_idx" ON "invitations"("workspaceId");

-- CreateIndex
CREATE INDEX "invitations_email_idx" ON "invitations"("email");

-- CreateIndex
CREATE INDEX "invitations_token_idx" ON "invitations"("token");

-- CreateIndex
CREATE INDEX "invitations_status_idx" ON "invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_states_userId_key" ON "onboarding_states"("userId");

-- CreateIndex
CREATE INDEX "onboarding_states_userId_idx" ON "onboarding_states"("userId");

-- CreateIndex
CREATE INDEX "onboarding_states_isCompleted_idx" ON "onboarding_states"("isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_key" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_userId_idx" ON "subscriptions"("userId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_plan_idx" ON "subscriptions"("plan");

-- CreateIndex
CREATE INDEX "enrichment_logs_contactId_idx" ON "enrichment_logs"("contactId");

-- CreateIndex
CREATE INDEX "enrichment_logs_provider_idx" ON "enrichment_logs"("provider");

-- CreateIndex
CREATE INDEX "enrichment_logs_success_idx" ON "enrichment_logs"("success");

-- CreateIndex
CREATE INDEX "enrichment_logs_createdAt_idx" ON "enrichment_logs"("createdAt");

-- CreateIndex
CREATE INDEX "custom_roles_workspaceId_idx" ON "custom_roles"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_roles_workspaceId_name_key" ON "custom_roles"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "workspace_activity_logs_workspaceId_idx" ON "workspace_activity_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_activity_logs_userId_idx" ON "workspace_activity_logs"("userId");

-- CreateIndex
CREATE INDEX "workspace_activity_logs_targetUserId_idx" ON "workspace_activity_logs"("targetUserId");

-- CreateIndex
CREATE INDEX "workspace_activity_logs_action_idx" ON "workspace_activity_logs"("action");

-- CreateIndex
CREATE INDEX "workspace_activity_logs_createdAt_idx" ON "workspace_activity_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_sync_configs_userId_key" ON "calendar_sync_configs"("userId");

-- CreateIndex
CREATE INDEX "calendar_sync_configs_userId_idx" ON "calendar_sync_configs"("userId");

-- CreateIndex
CREATE INDEX "calendar_sync_configs_syncEnabled_idx" ON "calendar_sync_configs"("syncEnabled");

-- CreateIndex
CREATE INDEX "interactions_userId_idx" ON "interactions"("userId");

-- CreateIndex
CREATE INDEX "interactions_interactionType_idx" ON "interactions"("interactionType");

-- CreateIndex
CREATE INDEX "interactions_occurredAt_idx" ON "interactions"("occurredAt");

-- CreateIndex
CREATE INDEX "interactions_externalId_idx" ON "interactions"("externalId");

-- CreateIndex
CREATE INDEX "interactions_externalSource_idx" ON "interactions"("externalSource");

-- CreateIndex
CREATE UNIQUE INDEX "interactions_userId_externalId_externalSource_key" ON "interactions"("userId", "externalId", "externalSource");

-- CreateIndex
CREATE INDEX "interaction_participants_interactionId_idx" ON "interaction_participants"("interactionId");

-- CreateIndex
CREATE INDEX "interaction_participants_contactId_idx" ON "interaction_participants"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "interaction_participants_interactionId_contactId_key" ON "interaction_participants"("interactionId", "contactId");

-- CreateIndex
CREATE INDEX "organizations_userId_idx" ON "organizations"("userId");

-- CreateIndex
CREATE INDEX "organizations_domain_idx" ON "organizations"("domain");

-- CreateIndex
CREATE INDEX "organizations_deletedAt_idx" ON "organizations"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_userId_name_key" ON "organizations"("userId", "name");

-- CreateIndex
CREATE INDEX "contact_employments_contactId_idx" ON "contact_employments"("contactId");

-- CreateIndex
CREATE INDEX "contact_employments_organizationId_idx" ON "contact_employments"("organizationId");

-- CreateIndex
CREATE INDEX "contact_employments_isCurrent_idx" ON "contact_employments"("isCurrent");

-- CreateIndex
CREATE INDEX "tags_userId_idx" ON "tags"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_userId_name_key" ON "tags"("userId", "name");

-- CreateIndex
CREATE INDEX "contact_tags_contactId_idx" ON "contact_tags"("contactId");

-- CreateIndex
CREATE INDEX "contact_tags_tagId_idx" ON "contact_tags"("tagId");

-- CreateIndex
CREATE INDEX "contact_tags_userId_idx" ON "contact_tags"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contact_tags_contactId_tagId_key" ON "contact_tags"("contactId", "tagId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_activities" ADD CONSTRAINT "contact_activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_activities" ADD CONSTRAINT "contact_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_connections" ADD CONSTRAINT "network_connections_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_connections" ADD CONSTRAINT "network_connections_connectedToId_fkey" FOREIGN KEY ("connectedToId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_feedback" ADD CONSTRAINT "recommendation_feedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ai_insights"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_links" ADD CONSTRAINT "integration_links_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_links" ADD CONSTRAINT "integration_links_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_customRoleId_fkey" FOREIGN KEY ("customRoleId") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_logs" ADD CONSTRAINT "enrichment_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_roles" ADD CONSTRAINT "custom_roles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_activity_logs" ADD CONSTRAINT "workspace_activity_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_sync_configs" ADD CONSTRAINT "calendar_sync_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_participants" ADD CONSTRAINT "interaction_participants_interactionId_fkey" FOREIGN KEY ("interactionId") REFERENCES "interactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_participants" ADD CONSTRAINT "interaction_participants_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_employments" ADD CONSTRAINT "contact_employments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for semantic search
CREATE INDEX IF NOT EXISTS "contacts_embedding_vector_idx" ON "contacts" USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);

