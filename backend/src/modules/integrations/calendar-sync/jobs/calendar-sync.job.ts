import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, Process } from '@nestjs/bull';
import type { Queue, Job } from 'bull';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CalendarSyncService } from '../calendar-sync.service';

/**
 * Job data for calendar sync
 */
interface CalendarSyncJobData {
  userId: string;
  type: 'incremental' | 'full';
}

/**
 * Calendar Sync Job
 * BullMQ processor for periodic calendar synchronization
 */
@Injectable()
@Processor('calendar-sync')
export class CalendarSyncJob implements OnModuleInit {
  private readonly logger = new Logger(CalendarSyncJob.name);

  constructor(
    @InjectQueue('calendar-sync') private readonly calendarSyncQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly calendarSyncService: CalendarSyncService,
  ) {}

  /**
   * Initialize scheduled sync on module startup
   */
  async onModuleInit() {
    this.logger.log('Calendar Sync Job initialized');

    // Clean up any stale jobs from previous runs
    await this.cleanupStaleJobs();
  }

  /**
   * Schedule periodic sync for all users with active calendar integrations
   * Runs every 15 minutes
   */
  @Cron('0 */15 * * * *') // Every 15 minutes
  async schedulePeriodicSync() {
    this.logger.log('Scheduling periodic calendar sync for all users');

    try {
      // Get all users with active calendar integrations
      const usersWithCalendar = await this.prisma.calendarSyncConfig.findMany({
        where: {
          syncEnabled: true,
        },
        select: {
          userId: true,
        },
      });

      this.logger.log(`Found ${usersWithCalendar.length} users with active calendar sync`);

      // Queue sync jobs for each user
      for (const { userId } of usersWithCalendar) {
        // Check if user has active integration
        const integration = await this.prisma.integration.findFirst({
          where: {
            userId,
            type: { in: ['GOOGLE_CALENDAR', 'OUTLOOK'] },
            isActive: true,
          },
        });

        if (!integration) {
          continue;
        }

        // Add job to queue with deduplication
        const jobId = `calendar-sync-${userId}`;
        const existingJob = await this.calendarSyncQueue.getJob(jobId);

        if (!existingJob) {
          await this.calendarSyncQueue.add(
            'sync',
            {
              userId,
              type: 'incremental',
            } as CalendarSyncJobData,
            {
              jobId,
              delay: Math.random() * 60000, // Spread jobs over 1 minute to avoid rate limits
              removeOnComplete: true,
              removeOnFail: false,
            },
          );

          this.logger.debug(`Queued calendar sync for user ${userId}`);
        } else {
          this.logger.debug(`Sync job already queued for user ${userId}`);
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to schedule periodic sync: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Process calendar sync job
   */
  @Process('sync')
  async processSync(job: Job<CalendarSyncJobData>) {
    const { userId, type } = job.data;
    this.logger.log(`Processing calendar sync for user ${userId}, type: ${type}`);

    try {
      const result = await this.calendarSyncService.incrementalSync(userId);

      this.logger.log(`Calendar sync completed for user ${userId}: ${result.synced} events synced`);

      return {
        success: true,
        synced: result.synced,
        added: result.added,
        updated: result.updated,
      };
    } catch (error) {
      this.logger.error(
        `Calendar sync failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Rethrow to trigger retry
      throw error;
    }
  }

  /**
   * Queue an immediate sync for a specific user
   * @param userId - User ID to sync
   * @param type - Sync type ('incremental' or 'full')
   */
  async queueImmediateSync(
    userId: string,
    type: 'incremental' | 'full' = 'incremental',
  ): Promise<void> {
    const jobId = `calendar-sync-immediate-${userId}-${Date.now()}`;

    await this.calendarSyncQueue.add('sync', { userId, type } as CalendarSyncJobData, {
      jobId,
      priority: 1, // High priority
      removeOnComplete: true,
      removeOnFail: false,
    });

    this.logger.log(`Queued immediate calendar sync for user ${userId}`);
  }

  /**
   * Clean up stale jobs from previous runs
   */
  private async cleanupStaleJobs() {
    try {
      // Get all waiting and delayed jobs
      const waitingJobs = await this.calendarSyncQueue.getWaiting();
      const delayedJobs = await this.calendarSyncQueue.getDelayed();

      // Remove jobs older than 1 hour
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      for (const job of [...waitingJobs, ...delayedJobs]) {
        if (job.timestamp < oneHourAgo) {
          await job.remove();
          this.logger.debug(`Removed stale job ${job.id}`);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup stale jobs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.calendarSyncQueue.getWaitingCount(),
      this.calendarSyncQueue.getActiveCount(),
      this.calendarSyncQueue.getCompletedCount(),
      this.calendarSyncQueue.getFailedCount(),
      this.calendarSyncQueue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }
}
