import { RelationshipScoreService } from '@/modules/contacts/services/relationship-score.service';
import { QueueName } from '@/shared/config/bull.config';
import { PrismaService } from '@/shared/database/prisma.service';
import { Process, Processor } from '@nestjs/bull';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { DeduplicationService } from '../../shared/deduplication.service';
import { ImportContactsDto } from '../dto/import-contacts.dto';
import { PreviewContactDto } from '../dto/import-preview.dto';

/**
 * Job data interface for Google Contacts import
 */
export interface GoogleContactsImportJobData {
  jobId: string;
  userId: string;
  integrationId: string;
  contacts: PreviewContactDto[];
  importDto: ImportContactsDto;
}

/**
 * Batch size for processing contacts
 * 200 contacts per transaction is safe within 5s timeout
 */
const BATCH_SIZE = 200;

/**
 * Google Contacts Import Background Job Processor
 * Handles batch import of contacts to avoid transaction timeouts
 */
@Processor(QueueName.INTEGRATION_SYNC)
@Injectable()
export class GoogleContactsImportJob {
  private readonly logger = new Logger(GoogleContactsImportJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deduplicationService: DeduplicationService,
    @Inject(forwardRef(() => RelationshipScoreService))
    private readonly relationshipScoreService: RelationshipScoreService,
  ) {}

  /**
   * Process Google Contacts import job
   * Imports contacts in batches to avoid transaction timeouts
   */
  @Process('import-google-contacts')
  async handleImport(job: Job<GoogleContactsImportJobData>) {
    const { jobId, userId, integrationId, contacts, importDto } = job.data;
    const startTime = Date.now();

    this.logger.log(
      `[GoogleContactsImportJob] Starting import job ${jobId} for user ${userId}, ${contacts.length} contacts`,
    );

    try {
      // Update job status to processing
      await this.prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'processing',
          startedAt: new Date(),
          totalCount: contacts.length,
        },
      });

      let processedCount = 0;
      let importedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;
      const errors: Array<{ contactId: string; error: string }> = [];
      const importedContactIds: string[] = [];

      // Process contacts in batches
      for (let i = 0; i < contacts.length; i += BATCH_SIZE) {
        const batch = contacts.slice(i, i + BATCH_SIZE);
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(contacts.length / BATCH_SIZE);

        this.logger.debug(
          `[GoogleContactsImportJob] Processing batch ${batchNumber}/${totalBatches} (${batch.length} contacts)`,
        );

        try {
          const batchResult = await this.processBatch(batch, userId, integrationId, importDto);

          importedCount += batchResult.imported;
          skippedCount += batchResult.skipped;
          failedCount += batchResult.failed;
          importedContactIds.push(...batchResult.importedContactIds);
          errors.push(...batchResult.errors);
        } catch (error) {
          // If entire batch fails, log error and continue
          this.logger.error(
            `[GoogleContactsImportJob] Batch ${batchNumber} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          failedCount += batch.length;
          errors.push(
            ...batch.map((c) => ({
              contactId: c.externalId,
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

        // Update job progress for BullMQ UI
        await job.progress(Math.round((processedCount / contacts.length) * 100));
      }

      // Calculate relationship scores for imported contacts
      if (importedContactIds.length > 0) {
        try {
          await this.relationshipScoreService.recalculateForContacts(importedContactIds);
          this.logger.log(
            `[GoogleContactsImportJob] Calculated relationship scores for ${importedContactIds.length} contacts`,
          );
        } catch (error) {
          this.logger.warn(
            `[GoogleContactsImportJob] Failed to calculate relationship scores: ${error}`,
          );
        }
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
            batchSize: BATCH_SIZE,
            totalBatches: Math.ceil(contacts.length / BATCH_SIZE),
          },
        },
      });

      this.logger.log(
        `[GoogleContactsImportJob] Import completed for job ${jobId}: ` +
          `imported=${importedCount}, skipped=${skippedCount}, failed=${failedCount}, duration=${duration}ms`,
      );

      // Create notification for user
      await this.prisma.notification.create({
        data: {
          userId,
          type: 'INTEGRATION_SYNC',
          title: 'Google Contacts Import Complete',
          message: `Successfully imported ${importedCount} contacts from Google Contacts.`,
          metadata: {
            jobId,
            importedCount,
            skippedCount,
            failedCount,
            duration,
          },
        },
      });

      return {
        success: true,
        imported: importedCount,
        skipped: skippedCount,
        failed: failedCount,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error(
        `[GoogleContactsImportJob] Import job ${jobId} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
          title: 'Google Contacts Import Failed',
          message: 'Failed to import contacts from Google. Please try again.',
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
   * Process a batch of contacts within a single transaction
   * Respects skipDuplicates and updateExisting flags for proper duplicate handling
   */
  private async processBatch(
    contacts: PreviewContactDto[],
    userId: string,
    integrationId: string,
    importDto: ImportContactsDto,
  ): Promise<{
    imported: number;
    skipped: number;
    failed: number;
    importedContactIds: string[];
    errors: Array<{ contactId: string; error: string }>;
  }> {
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    let failed = 0;
    const importedContactIds: string[] = [];
    const errors: Array<{ contactId: string; error: string }> = [];

    // Get existing contacts for deduplication
    const existingContacts = await this.prisma.contact.findMany({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
      },
    });

    // Find duplicates using deduplication service
    const duplicates = await this.deduplicationService.findDuplicates(
      contacts as any[],
      existingContacts as any[],
    );

    const duplicateMap = new Map(
      duplicates.map((dup) => [
        (dup.importedContact as any).externalId,
        dup.existingContact as any,
      ]),
    );

    // Use transaction for batch atomicity
    await this.prisma.$transaction(async (tx) => {
      for (const contact of contacts) {
        try {
          const existingContact = duplicateMap.get(contact.externalId);

          // Skip duplicates if requested and not updating
          if (existingContact && importDto.skipDuplicates && !importDto.updateExisting) {
            skipped++;
            continue;
          }

          // Apply tag mapping
          let tags = contact.tags;
          if (importDto.tagMapping) {
            tags = tags.map((tag) => importDto.tagMapping![tag] || tag);
          }

          // Exclude labels if specified
          if (importDto.excludeLabels) {
            const excludeLabels = importDto.excludeLabels;
            tags = tags.filter((tag) => !excludeLabels.includes(tag));
          }

          // Preserve original tags if requested
          if (importDto.preserveOriginalTags && importDto.tagMapping) {
            const tagMapping = importDto.tagMapping;
            const originalTags = contact.tags.filter((tag) => !tagMapping[tag]);
            tags = [...new Set([...tags, ...originalTags])];
          }

          if (existingContact && importDto.updateExisting) {
            // Update existing contact
            await tx.contact.update({
              where: { id: existingContact.id },
              data: {
                firstName: contact.firstName,
                lastName: contact.lastName,
                phone: contact.phone,
                company: contact.company,
                position: contact.position,
                tags,
                metadata: contact.metadata,
                source: 'GOOGLE_CONTACTS',
                updatedAt: new Date(),
              },
            });
            importedContactIds.push(existingContact.id);

            // Update or create integration link
            await tx.integrationLink.upsert({
              where: {
                integrationId_externalId: {
                  integrationId,
                  externalId: contact.externalId,
                },
              },
              update: {
                contactId: existingContact.id,
                metadata: contact.metadata,
              },
              create: {
                integrationId,
                contactId: existingContact.id,
                externalId: contact.externalId,
                metadata: contact.metadata,
              },
            });

            updated++;
          } else if (!existingContact) {
            // Create new contact
            const createdContact = await tx.contact.create({
              data: {
                userId,
                firstName: contact.firstName,
                lastName: contact.lastName || '',
                email: contact.email,
                phone: contact.phone,
                company: contact.company,
                position: contact.position,
                tags,
                metadata: contact.metadata,
                source: 'GOOGLE_CONTACTS',
              },
            });

            importedContactIds.push(createdContact.id);

            // Create integration link
            await tx.integrationLink.create({
              data: {
                integrationId,
                contactId: createdContact.id,
                externalId: contact.externalId,
                metadata: contact.metadata,
              },
            });

            imported++;
          }
        } catch (error) {
          failed++;
          errors.push({
            contactId: contact.externalId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    });

    // Return updated count as part of imported for backward compatibility with job tracking
    return { imported: imported + updated, skipped, failed, importedContactIds, errors };
  }
}
