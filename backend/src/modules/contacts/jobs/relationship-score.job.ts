/**
 * Relationship Score Background Job
 * Recalculates relationship scores for all contacts nightly
 * Ensures scores stay accurate as time passes (recency factor)
 */

import { PrismaService } from '@/shared/database/prisma.service';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RelationshipScoreService } from '../services/relationship-score.service';

@Injectable()
export class RelationshipScoreJob {
  private readonly logger = new Logger(RelationshipScoreJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly relationshipScoreService: RelationshipScoreService,
  ) {}

  /**
   * Run daily at 3 AM to recalculate relationship scores
   * This ensures the recency factor stays accurate as time passes
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async recalculateAllScores(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Relationship score job already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting nightly relationship score recalculation...');

    try {
      // Get all users with contacts
      const users = await this.prisma.user.findMany({
        where: {
          contacts: {
            some: {
              deletedAt: null,
            },
          },
        },
        select: { id: true },
      });

      this.logger.log(`Found ${users.length} users with contacts to process`);

      let totalContacts = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const user of users) {
        try {
          // Get contacts for this user
          const contacts = await this.prisma.contact.findMany({
            where: {
              userId: user.id,
              deletedAt: null,
            },
            select: { id: true },
          });

          totalContacts += contacts.length;

          // Process contacts in batches
          const batchSize = 50;
          for (let i = 0; i < contacts.length; i += batchSize) {
            const batch = contacts.slice(i, i + batchSize);

            await Promise.all(
              batch.map(async (contact) => {
                try {
                  await this.relationshipScoreService.updateContactScore(contact.id);
                  successCount++;
                } catch (error) {
                  errorCount++;
                  this.logger.warn(`Failed to update score for contact ${contact.id}: ${error}`);
                }
              }),
            );
          }
        } catch (error) {
          this.logger.error(`Failed to process contacts for user ${user.id}:`, error);
        }
      }

      this.logger.log(
        `Relationship score job completed: ${successCount} success, ${errorCount} errors out of ${totalContacts} contacts`,
      );
    } catch (error) {
      this.logger.error('Relationship score job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing or admin purposes
   */
  async triggerManualRecalculation(userId: string): Promise<{ processed: number }> {
    this.logger.log(`Manually triggering recalculation for user ${userId}`);

    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    await this.relationshipScoreService.recalculateForContacts(contacts.map((c) => c.id));

    this.logger.log(`Recalculated scores for ${contacts.length} contacts of user ${userId}`);
    return { processed: contacts.length };
  }
}
