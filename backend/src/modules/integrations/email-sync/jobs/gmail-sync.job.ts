/**
 * Gmail Sync Background Job Processor
 * US-030: Email communication sync
 * Handles background synchronization of Gmail emails with pagination
 */

import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Job } from 'bull';
import { QueueName } from '../../../../shared/config/bull.config';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { OAuthService } from '../../shared/oauth.service';
import { EmailMessage } from '../interfaces/email.interface';
import { EmailMatcherService } from '../services/email-matcher.service';
import { GmailClientService } from '../services/gmail-client.service';

/**
 * Job data interface for Gmail background sync
 */
export interface GmailSyncJobData {
  jobId: string;
  userId: string;
  fullSync?: boolean;
  historyDays?: number;
}

/** Batch size for processing emails (DB writes) */
const EMAIL_BATCH_SIZE = 100;

/** Default history days for full sync */
const DEFAULT_HISTORY_DAYS = 365;

/**
 * Gmail Sync Background Job Processor
 * Handles full email sync with pagination - processes ALL emails within time period
 */
@Processor(QueueName.INTEGRATION_SYNC)
@Injectable()
export class GmailSyncJob implements OnModuleInit {
  private readonly logger = new Logger(GmailSyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailClient: GmailClientService,
    private readonly emailMatcher: EmailMatcherService,
    private readonly oauthService: OAuthService,
  ) {}

  onModuleInit() {
    this.logger.log('GmailSyncJob processor initialized and listening for jobs');
  }

  /**
   * Process Gmail sync job
   * Fetches ALL emails within the time period and processes them in batches
   */
  @Process('sync-gmail-background')
  async handleSync(job: Job<GmailSyncJobData>) {
    const { jobId, userId, fullSync, historyDays } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `[GmailSyncJob] Starting sync job ${jobId} for user ${userId}, ` +
        `fullSync: ${fullSync}, historyDays: ${historyDays ?? DEFAULT_HISTORY_DAYS}`,
    );

    try {
      // Update job status to processing
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'processing',
          startedAt: new Date(),
        },
      });

      // Get integration and validate
      const integration = await this.prisma.integration.findUnique({
        where: {
          userId_type: {
            userId,
            type: 'GMAIL',
          },
        },
      });

      if (!integration || !integration.isActive) {
        throw new Error('No active Gmail integration found');
      }

      // Get email sync config
      const config = await this.prisma.emailSyncConfig.findUnique({
        where: { userId },
      });

      if (!config?.gmailEnabled || !config.syncEnabled) {
        throw new Error('Gmail sync is not enabled');
      }

      // Get user email for direction detection
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user?.email) {
        throw new Error('User email not found');
      }

      // Get valid access token
      const accessToken = await this.getValidAccessToken(integration);

      // Determine sync query
      const effectiveHistoryDays = historyDays ?? DEFAULT_HISTORY_DAYS;
      const metadata = integration.metadata as Record<string, unknown> | null;
      const historyId = metadata?.historyId as string | undefined;

      let allMessages: EmailMessage[] = [];
      let newHistoryId: string | undefined;

      // Fetch emails - either incremental or full
      if (historyId && !fullSync) {
        // Incremental sync using history API
        this.logger.log(`[GmailSyncJob] Using incremental sync from historyId: ${historyId}`);
        const result = await this.gmailClient.fetchIncrementalMessages(accessToken, historyId);
        allMessages = result.messages;
        newHistoryId = result.newHistoryId;
      } else {
        // Full sync with pagination
        this.logger.log(`[GmailSyncJob] Using full sync for last ${effectiveHistoryDays} days`);

        const fetchResult = await this.gmailClient.fetchAllMessages(accessToken, {
          historyDays: effectiveHistoryDays,
          onProgress: async (fetched) => {
            // Update progress during fetch phase
            await this.prisma.importJob.update({
              where: { id: jobId },
              data: {
                totalCount: fetched,
                metadata: {
                  phase: 'fetching',
                  fetchedCount: fetched,
                },
              },
            });
            await job.progress(Math.min(25, Math.round((fetched / 1000) * 25))); // Max 25% during fetch
          },
        });

        allMessages = fetchResult.messages;
      }

      // Update total count
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          totalCount: allMessages.length,
          metadata: {
            phase: 'processing',
            totalEmails: allMessages.length,
          },
        },
      });

      this.logger.log(`[GmailSyncJob] Fetched ${allMessages.length} emails, starting processing`);

      // Process emails in batches
      let processedCount = 0;
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      let contactsMatched = 0;
      const errors: Array<{ emailId?: string; error: string }> = [];

      for (let i = 0; i < allMessages.length; i += EMAIL_BATCH_SIZE) {
        const batch = allMessages.slice(i, i + EMAIL_BATCH_SIZE);
        const batchNumber = Math.floor(i / EMAIL_BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(allMessages.length / EMAIL_BATCH_SIZE);

        this.logger.debug(
          `[GmailSyncJob] Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`,
        );

        try {
          const batchResult = await this.processEmailBatch(batch, userId, user.email, config);

          importedCount += batchResult.imported;
          skippedCount += batchResult.skipped;
          failedCount += batchResult.failed;
          contactsMatched += batchResult.contactsMatched;
          errors.push(...batchResult.errors);
        } catch (error) {
          this.logger.error(
            `[GmailSyncJob] Batch ${batchNumber} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          failedCount += batch.length;
          errors.push(
            ...batch.map((m) => ({
              emailId: m.id,
              error: error instanceof Error ? error.message : 'Batch processing failed',
            })),
          );
        }

        processedCount += batch.length;

        // Update progress after each batch
        await this.prisma.importJob.update({
          where: { id: jobId },
          data: {
            processedCount,
            importedCount,
            skippedCount,
            failedCount,
            errors: errors.slice(-100), // Keep last 100 errors
          },
        });

        // Update job progress for BullMQ UI (25-100% during processing)
        const progressPercent = 25 + Math.round((processedCount / allMessages.length) * 75);
        await job.progress(progressPercent);
      }

      // Update last sync time and history ID
      await this.prisma.emailSyncConfig.update({
        where: { userId },
        data: {
          lastGmailSync: new Date(),
        },
      });

      if (newHistoryId) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            metadata: {
              ...(integration.metadata as object),
              historyId: newHistoryId,
            },
          },
        });
      }

      const duration = Date.now() - startTime;

      // Mark job as completed
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          processedCount,
          importedCount,
          skippedCount,
          failedCount,
          errors: errors.slice(-100),
          metadata: {
            duration,
            historyDays: effectiveHistoryDays,
            totalBatches: Math.ceil(allMessages.length / EMAIL_BATCH_SIZE),
            contactsMatched,
            newHistoryId,
          },
        },
      });

      this.logger.log(
        `[GmailSyncJob] Sync completed for job ${jobId}: ` +
          `processed=${processedCount}, imported=${importedCount}, skipped=${skippedCount}, ` +
          `failed=${failedCount}, contacts=${contactsMatched}, duration=${duration}ms`,
      );

      // Create notification for user
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'INTEGRATION_SYNC',
          title: 'Gmail Sync Complete',
          message: `Successfully synced ${importedCount} emails from Gmail (${contactsMatched} contacts matched).`,
          metadata: {
            jobId,
            importedCount,
            contactsMatched,
            duration,
          },
        },
      });

      return {
        success: true,
        processed: processedCount,
        imported: importedCount,
        skipped: skippedCount,
        failed: failedCount,
        contactsMatched,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `[GmailSyncJob] Sync job ${jobId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Mark job as failed
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          metadata: {
            duration,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      // Create error notification
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'INTEGRATION_SYNC',
          title: 'Gmail Sync Failed',
          message: 'Failed to sync emails from Gmail. Please try again.',
          metadata: {
            jobId,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      throw error;
    }
  }

  /**
   * Process a batch of emails
   */
  private async processEmailBatch(
    emails: EmailMessage[],
    userId: string,
    userEmail: string,
    config: {
      privacyMode: boolean;
      excludedEmails: string[];
      excludedDomains: string[];
    },
  ): Promise<{
    imported: number;
    skipped: number;
    failed: number;
    contactsMatched: number;
    errors: Array<{ emailId: string; error: string }>;
  }> {
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let contactsMatched = 0;
    const errors: Array<{ emailId: string; error: string }> = [];

    for (const message of emails) {
      try {
        // Match email participants to contacts
        const matchedContacts = await this.emailMatcher.matchEmailToContacts(
          userId,
          message,
          userEmail,
        );

        if (matchedContacts.length === 0) {
          skipped++;
          continue; // Skip emails that don't match any contacts
        }

        contactsMatched += matchedContacts.length;

        // Store email for each matched contact
        for (const contact of matchedContacts) {
          // Check if contact email is excluded
          if (contact.email && this.isEmailExcluded(contact.email, config)) {
            skipped++;
            continue;
          }

          // Determine email direction
          const fromEmail = message.from.email.toLowerCase();
          const direction = fromEmail === userEmail.toLowerCase() ? 'OUTBOUND' : 'INBOUND';

          // Store email (respecting privacy mode)
          await this.prisma.emailThread.upsert({
            where: {
              contactId_externalId: {
                contactId: contact.id,
                externalId: message.id,
              },
            },
            create: {
              contactId: contact.id,
              threadId: message.threadId,
              subject: message.subject,
              snippet: message.snippet,
              body: config.privacyMode ? null : message.body?.slice(0, 10000),
              direction,
              occurredAt: message.receivedAt,
              externalId: message.id,
              source: 'gmail',
              metadata: JSON.parse(
                JSON.stringify({
                  from: message.from,
                  to: message.to,
                  cc: message.cc,
                }),
              ),
            },
            update: {
              subject: message.subject,
              snippet: message.snippet,
              body: config.privacyMode ? null : message.body?.slice(0, 10000),
              occurredAt: message.receivedAt,
            },
          });

          imported++;

          // Update contact's lastContact date
          await this.prisma.contact.update({
            where: { id: contact.id },
            data: { lastContact: message.receivedAt },
          });
        }
      } catch (error) {
        failed++;
        errors.push({
          emailId: message.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { imported, skipped, failed, contactsMatched, errors };
  }

  /**
   * Get valid access token (refresh if expired)
   */
  private async getValidAccessToken(integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
  }): Promise<string> {
    if (!integration.accessToken) {
      throw new Error('Gmail access token not available');
    }

    // Check if token is expired or about to expire (5 min buffer)
    if (
      integration.expiresAt &&
      new Date() >= new Date(integration.expiresAt.getTime() - 5 * 60 * 1000)
    ) {
      if (!integration.refreshToken) {
        throw new Error('Gmail refresh token not available. Please reconnect.');
      }

      this.logger.log('Access token expired, refreshing...');

      const refreshToken = this.oauthService.decryptToken(integration.refreshToken);
      const newTokens = await this.oauthService.refreshAccessToken(refreshToken, 'google');

      const encryptedAccessToken = this.oauthService.encryptToken(newTokens.access_token);

      // Update integration with new token
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: encryptedAccessToken,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        },
      });

      return newTokens.access_token;
    }

    return this.oauthService.decryptToken(integration.accessToken);
  }

  /**
   * Check if email should be excluded from sync
   */
  private isEmailExcluded(
    email: string,
    config: { excludedEmails: string[]; excludedDomains: string[] },
  ): boolean {
    const emailLower = email.toLowerCase();

    // Check excluded emails
    if (config.excludedEmails.some((e) => e.toLowerCase() === emailLower)) {
      return true;
    }

    // Check excluded domains
    const domain = emailLower.split('@')[1];
    if (domain && config.excludedDomains.some((d) => d.toLowerCase() === domain)) {
      return true;
    }

    return false;
  }
}
