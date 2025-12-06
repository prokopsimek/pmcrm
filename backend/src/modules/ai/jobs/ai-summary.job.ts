/**
 * AI Summary Background Job
 * Regenerates AI summaries for contacts with new activity
 * Runs daily to ensure summaries stay up-to-date while saving AI tokens
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@/shared/database/prisma.service';
import { ContactSummaryService } from '../services/contact-summary.service';

@Injectable()
export class AISummaryJob {
  private readonly logger = new Logger(AISummaryJob.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactSummaryService: ContactSummaryService,
  ) {}

  /**
   * Run daily at 3 AM to regenerate summaries for contacts with new activity
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async regenerateSummariesWithNewActivity(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('AI summary job already running, skipping...');
      return;
    }

    this.isRunning = true;
    this.logger.log('Starting daily AI summary regeneration job...');

    try {
      // Find contacts that have new emails since their last summary
      const contactsWithNewActivity = await this.contactSummaryService.getContactsWithNewActivity();

      this.logger.log(`Found ${contactsWithNewActivity.length} contacts with new email activity`);

      let successCount = 0;
      let errorCount = 0;

      for (const contactId of contactsWithNewActivity) {
        try {
          // Get the contact's userId for authorization
          const contact = await this.prisma.contact.findUnique({
            where: { id: contactId },
            select: { userId: true },
          });

          if (!contact) {
            this.logger.warn(`Contact ${contactId} not found, skipping...`);
            continue;
          }

          // Regenerate timeline summary
          await this.contactSummaryService.getTimelineSummary(
            contact.userId,
            contactId,
            true, // Force regenerate
          );

          // Regenerate recommendations
          await this.contactSummaryService.getRecommendations(
            contact.userId,
            contactId,
            true, // Force regenerate
          );

          successCount++;
          this.logger.debug(`Regenerated summaries for contact ${contactId}`);

          // Small delay between contacts to avoid overwhelming the AI API
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          errorCount++;
          this.logger.error(`Failed to regenerate summary for contact ${contactId}:`, error);
        }
      }

      this.logger.log(
        `AI summary job completed: ${successCount} success, ${errorCount} errors out of ${contactsWithNewActivity.length} contacts`,
      );
    } catch (error) {
      this.logger.error('AI summary job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Clean up expired summaries (optional, for housekeeping)
   * Runs weekly on Sundays at 4 AM
   */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupExpiredSummaries(): Promise<void> {
    this.logger.log('Starting weekly summary cleanup...');

    try {
      // Get summaries that need regeneration
      const expiredSummaries = await this.contactSummaryService.getSummariesToRegenerate();

      this.logger.log(`Found ${expiredSummaries.length} expired summaries to clean up`);

      // We don't delete them, just log for monitoring
      // The summaries will be regenerated on-demand when users view contacts
    } catch (error) {
      this.logger.error('Summary cleanup failed:', error);
    }
  }

  /**
   * Manual trigger for testing or admin purposes
   */
  async triggerManualRegeneration(contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      select: { userId: true },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    await this.contactSummaryService.getTimelineSummary(contact.userId, contactId, true);
    await this.contactSummaryService.getRecommendations(contact.userId, contactId, true);

    this.logger.log(`Manually regenerated summaries for contact ${contactId}`);
  }
}




