import { Processor, Process, InjectQueue } from '@nestjs/bull';
import type { Job, Queue } from 'bull';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { EmailSyncService } from '../email-sync.service';
import { QueueName } from '../../../../shared/config/bull.config';

export interface EmailSyncJobData {
  userId: string;
  provider: 'gmail' | 'outlook';
  fullSync?: boolean;
  triggeredBy?: 'scheduler' | 'manual';
}

export interface EmailSyncBatchJobData {
  batchId: string;
}

/**
 * Email Sync Background Job Processor
 * US-030: Email communication sync
 * Handles periodic and on-demand email synchronization
 */
@Processor(QueueName.INTEGRATION_SYNC)
@Injectable()
export class EmailSyncJob implements OnModuleInit {
  private readonly logger = new Logger(EmailSyncJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSyncService: EmailSyncService,
    @InjectQueue(QueueName.INTEGRATION_SYNC)
    private readonly syncQueue: Queue,
  ) {}

  /**
   * On module init, set up recurring jobs
   */
  async onModuleInit() {
    // Remove existing recurring jobs to avoid duplicates
    await this.syncQueue.removeRepeatable('sync-all-users', {
      cron: '0 */6 * * *', // Every 6 hours
    });

    // Add recurring job for batch sync
    await this.syncQueue.add(
      'sync-all-users',
      { batchId: `batch-${Date.now()}` },
      {
        repeat: {
          cron: '0 */6 * * *', // Every 6 hours
        },
        jobId: 'email-sync-batch',
      },
    );

    this.logger.log('Email sync recurring jobs initialized');
  }

  /**
   * Process single user email sync
   */
  @Process('sync-user-emails')
  async handleUserEmailSync(job: Job<EmailSyncJobData>) {
    const { userId, provider, fullSync, triggeredBy } = job.data;

    this.logger.log(
      `Processing email sync for user ${userId}, provider: ${provider}, triggered by: ${triggeredBy || 'unknown'}`,
    );

    try {
      // Check if user has active sync configuration
      const config = await this.prisma.emailSyncConfig.findUnique({
        where: { userId },
      });

      if (!config?.syncEnabled) {
        this.logger.log(`Email sync disabled for user ${userId}, skipping`);
        return { skipped: true, reason: 'sync_disabled' };
      }

      if (provider === 'gmail' && !config.gmailEnabled) {
        this.logger.log(`Gmail disabled for user ${userId}, skipping`);
        return { skipped: true, reason: 'gmail_disabled' };
      }

      if (provider === 'outlook' && !config.outlookEnabled) {
        this.logger.log(`Outlook disabled for user ${userId}, skipping`);
        return { skipped: true, reason: 'outlook_disabled' };
      }

      // Execute sync
      const result = await this.emailSyncService.syncEmails(userId, provider, fullSync || false);

      this.logger.log(
        `Email sync completed for user ${userId}: ${result.emailsProcessed} processed, ${result.interactionsCreated} stored`,
      );

      // Create notification for user if sync was significant
      if (result.interactionsCreated > 0) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'INTEGRATION_SYNC',
            title: 'Email Sync Completed',
            message: `Synced ${result.interactionsCreated} new emails from ${provider}`,
            metadata: {
              provider,
              emailsProcessed: result.emailsProcessed,
              interactionsCreated: result.interactionsCreated,
              contactsMatched: result.contactsMatched,
            },
          },
        });
      }

      return result;
    } catch (error) {
      this.logger.error(
        `Email sync failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Create error notification
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'INTEGRATION_SYNC',
          title: 'Email Sync Failed',
          message: `Failed to sync emails from ${provider}. We'll retry automatically.`,
          metadata: {
            provider,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      });

      throw error; // Re-throw to trigger retry
    }
  }

  /**
   * Process batch sync for all users
   * This job runs periodically to sync all users with active email integrations
   */
  @Process('sync-all-users')
  async handleBatchSync(job: Job<EmailSyncBatchJobData>) {
    const { batchId } = job.data;

    this.logger.log(`Starting batch email sync: ${batchId}`);

    try {
      // Find all users with active email sync enabled
      const activeConfigs = await this.prisma.emailSyncConfig.findMany({
        where: {
          syncEnabled: true,
          OR: [{ gmailEnabled: true }, { outlookEnabled: true }],
        },
        include: {
          user: {
            select: { id: true, email: true, isActive: true },
          },
        },
      });

      this.logger.log(`Found ${activeConfigs.length} users with active email sync`);

      let successCount = 0;
      let errorCount = 0;

      // Queue sync jobs for each user
      for (const config of activeConfigs) {
        if (!config.user.isActive) {
          continue; // Skip inactive users
        }

        // Check if enough time has passed since last sync (at least 1 hour)
        const lastSync = config.lastGmailSync || config.lastOutlookSync;
        if (lastSync) {
          const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastSync < 1) {
            this.logger.debug(
              `Skipping user ${config.userId} - synced ${hoursSinceLastSync.toFixed(1)} hours ago`,
            );
            continue;
          }
        }

        try {
          // Queue Gmail sync
          if (config.gmailEnabled) {
            await this.syncQueue.add(
              'sync-user-emails',
              {
                userId: config.userId,
                provider: 'gmail',
                fullSync: false,
                triggeredBy: 'scheduler',
              } as EmailSyncJobData,
              {
                delay: successCount * 5000, // Stagger jobs by 5 seconds
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 30000, // 30 seconds base delay
                },
              },
            );
            successCount++;
          }

          // Queue Outlook sync
          if (config.outlookEnabled) {
            await this.syncQueue.add(
              'sync-user-emails',
              {
                userId: config.userId,
                provider: 'outlook',
                fullSync: false,
                triggeredBy: 'scheduler',
              } as EmailSyncJobData,
              {
                delay: (successCount + 1) * 5000,
                attempts: 3,
                backoff: {
                  type: 'exponential',
                  delay: 30000,
                },
              },
            );
            successCount++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to queue sync for user ${config.userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          errorCount++;
        }
      }

      this.logger.log(
        `Batch sync ${batchId} completed: ${successCount} jobs queued, ${errorCount} errors`,
      );

      return {
        batchId,
        usersProcessed: activeConfigs.length,
        jobsQueued: successCount,
        errors: errorCount,
      };
    } catch (error) {
      this.logger.error(
        `Batch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Process sync for specific contact
   * Useful for on-demand sync when viewing a contact's profile
   */
  @Process('sync-contact-emails')
  async handleContactEmailSync(job: Job<{ userId: string; contactId: string }>) {
    const { userId, contactId } = job.data;

    this.logger.log(`Syncing emails for contact ${contactId}`);

    try {
      // Get contact with email
      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, userId, deletedAt: null },
      });

      if (!contact?.email) {
        return { skipped: true, reason: 'no_email' };
      }

      // Get user's active integration
      const gmailIntegration = await this.prisma.integration.findFirst({
        where: { userId, type: 'GMAIL', isActive: true },
      });

      if (!gmailIntegration) {
        return { skipped: true, reason: 'no_integration' };
      }

      // Trigger sync (the service will handle fetching only this contact's emails)
      const result = await this.emailSyncService.syncEmails(userId, 'gmail', false);

      return {
        success: true,
        contactId,
        ...result,
      };
    } catch (error) {
      this.logger.error(
        `Contact email sync failed for ${contactId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }
}
