/**
 * Email Sync Service
 * US-030: Email communication sync
 * Main service orchestrating email synchronization from Gmail and Outlook
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { GmailClientService } from './services/gmail-client.service';
import { OutlookClientService } from './services/outlook-client.service';
import { EmailMatcherService } from './services/email-matcher.service';
import { SentimentAnalyzerService } from './services/sentiment-analyzer.service';
import { UpdateSyncConfigDto } from './dto/sync-config.dto';
import { SyncResult, EmailMessage } from './interfaces/email.interface';
import { EmailSyncConfig } from '@prisma/client';

@Injectable()
export class EmailSyncService {
  private readonly logger = new Logger(EmailSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailClient: GmailClientService,
    private readonly outlookClient: OutlookClientService,
    private readonly emailMatcher: EmailMatcherService,
    private readonly sentimentAnalyzer: SentimentAnalyzerService,
  ) {}

  /**
   * Get email sync configuration for user
   */
  async getConfig(userId: string): Promise<EmailSyncConfig | null> {
    return this.prisma.emailSyncConfig.findUnique({
      where: { userId },
    });
  }

  /**
   * Update or create email sync configuration
   */
  async updateConfig(userId: string, dto: UpdateSyncConfigDto): Promise<EmailSyncConfig> {
    return this.prisma.emailSyncConfig.upsert({
      where: { userId },
      update: {
        gmailEnabled: dto.gmailEnabled,
        outlookEnabled: dto.outlookEnabled,
        privacyMode: dto.privacyMode,
        syncEnabled: dto.syncEnabled,
        excludedEmails: dto.excludedEmails,
        excludedDomains: dto.excludedDomains,
        updatedAt: new Date(),
      },
      create: {
        userId,
        gmailEnabled: dto.gmailEnabled ?? false,
        outlookEnabled: dto.outlookEnabled ?? false,
        privacyMode: dto.privacyMode ?? true,
        syncEnabled: dto.syncEnabled ?? true,
        excludedEmails: dto.excludedEmails ?? [],
        excludedDomains: dto.excludedDomains ?? [],
      },
    });
  }

  /**
   * Sync emails for a user from specified provider
   */
  async syncEmails(
    userId: string,
    provider: 'gmail' | 'outlook',
    fullSync: boolean = false,
  ): Promise<SyncResult> {
    this.logger.log(
      `Email sync requested for user ${userId}, provider: ${provider}, fullSync: ${fullSync}`,
    );

    const config = await this.getConfig(userId);
    if (!config) {
      throw new NotFoundException('Email sync configuration not found');
    }

    if (!config.syncEnabled) {
      throw new BadRequestException('Email sync is disabled');
    }

    if (provider === 'gmail' && !config.gmailEnabled) {
      throw new BadRequestException('Gmail is not enabled');
    }

    if (provider === 'outlook' && !config.outlookEnabled) {
      throw new BadRequestException('Outlook is not enabled');
    }

    // Get integration for the provider
    const integrationType = provider === 'gmail' ? 'GMAIL' : 'OUTLOOK';
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: integrationType,
        },
      },
    });

    if (!integration || !integration.accessToken) {
      throw new NotFoundException(`No active ${provider} integration found`);
    }

    // Get user email for direction detection
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw new BadRequestException('User email not found');
    }

    const startTime = Date.now();
    let emailsProcessed = 0;
    let interactionsCreated = 0;
    let contactsMatched = 0;
    const errors: Array<{ emailId?: string; error: string; timestamp: Date }> = [];

    try {
      // Fetch emails based on provider
      let messages: EmailMessage[] = [];
      let newSyncToken: string | undefined;

      if (provider === 'gmail') {
        const accessToken = integration.accessToken; // Note: In production, decrypt this

        if (!fullSync && config.syncToken) {
          // Incremental sync using history
          const result = await this.gmailClient.fetchIncrementalMessages(
            accessToken,
            config.syncToken,
          );
          messages = result.messages;
          newSyncToken = result.newHistoryId;
        } else {
          // Full sync
          messages = await this.gmailClient.fetchMessages(accessToken, {
            maxResults: 100,
            query: 'newer_than:30d',
          });
        }
      } else {
        // Outlook sync - similar pattern
        // TODO: Implement Outlook sync
        messages = [];
      }

      emailsProcessed = messages.length;

      // Process each message
      for (const message of messages) {
        try {
          // Match email participants to contacts
          const matchedContacts = await this.emailMatcher.matchEmailToContacts(
            userId,
            message,
            user.email,
          );

          if (matchedContacts.length === 0) {
            continue; // Skip emails that don't match any contacts
          }

          contactsMatched += matchedContacts.length;

          // Store email for each matched contact
          for (const contact of matchedContacts) {
            // Check if contact email is excluded
            if (contact.email && this.isEmailExcluded(contact.email, config)) {
              continue;
            }

            // Determine email direction
            const fromEmail = message.from.email.toLowerCase();
            const direction = fromEmail === user.email.toLowerCase() ? 'OUTBOUND' : 'INBOUND';

            // Analyze sentiment if body is available
            let sentimentScore: number | undefined;
            if (!config.privacyMode && message.body) {
              const sentiment = this.sentimentAnalyzer.analyzeSentiment(message.body);
              sentimentScore = sentiment.score;
            }

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
                source: provider,
                metadata: JSON.parse(
                  JSON.stringify({
                    from: message.from,
                    to: message.to,
                    cc: message.cc,
                    sentimentScore,
                  }),
                ),
              },
              update: {
                subject: message.subject,
                snippet: message.snippet,
                body: config.privacyMode ? null : message.body?.slice(0, 10000),
                occurredAt: message.receivedAt,
                metadata: JSON.parse(
                  JSON.stringify({
                    from: message.from,
                    to: message.to,
                    cc: message.cc,
                    sentimentScore,
                  }),
                ),
              },
            });

            interactionsCreated++;

            // Update contact's lastContact date
            await this.prisma.contact.update({
              where: { id: contact.id },
              data: { lastContact: message.receivedAt },
            });
          }
        } catch (error) {
          errors.push({
            emailId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }

      // Update last sync time and sync token
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (provider === 'gmail') {
        updateData.lastGmailSync = new Date();
        if (newSyncToken) {
          updateData.syncToken = newSyncToken;
        }
      } else {
        updateData.lastOutlookSync = new Date();
      }

      await this.prisma.emailSyncConfig.update({
        where: { userId },
        data: updateData,
      });

      const duration = Date.now() - startTime;
      this.logger.log(
        `Email sync completed: ${emailsProcessed} processed, ${interactionsCreated} stored`,
      );

      return {
        provider,
        emailsProcessed,
        interactionsCreated,
        contactsMatched,
        errors,
        newHistoryId: newSyncToken,
      };
    } catch (error) {
      this.logger.error(
        `Email sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Get email sync status for user
   */
  async getSyncStatus(userId: string): Promise<{
    gmailConnected: boolean;
    outlookConnected: boolean;
    lastSync: Date | null;
    syncEnabled: boolean;
    privacyMode: boolean;
    totalEmailsSynced: number;
  }> {
    const config = await this.getConfig(userId);

    // Count synced emails
    const emailCount = await this.prisma.emailThread.count({
      where: {
        contact: {
          userId,
        },
      },
    });

    // Check for active integrations
    const gmailIntegration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: 'GMAIL',
        },
      },
    });

    const outlookIntegration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: 'OUTLOOK',
        },
      },
    });

    return {
      gmailConnected: !!(config?.gmailEnabled && gmailIntegration?.isActive),
      outlookConnected: !!(config?.outlookEnabled && outlookIntegration?.isActive),
      lastSync: config?.lastGmailSync || config?.lastOutlookSync || null,
      syncEnabled: config?.syncEnabled ?? false,
      privacyMode: config?.privacyMode ?? true,
      totalEmailsSynced: emailCount,
    };
  }

  /**
   * Exclude a contact email from sync
   */
  async excludeContactFromSync(userId: string, email: string): Promise<void> {
    const config = await this.getConfig(userId);
    if (config) {
      await this.prisma.emailSyncConfig.update({
        where: { userId },
        data: {
          excludedEmails: [...config.excludedEmails, email],
          updatedAt: new Date(),
        },
      });
    }
  }

  /**
   * Remove email from exclusion list
   */
  async removeExclusion(userId: string, email: string): Promise<void> {
    const config = await this.getConfig(userId);
    if (config) {
      await this.prisma.emailSyncConfig.update({
        where: { userId },
        data: {
          excludedEmails: config.excludedEmails.filter((e) => e !== email),
          updatedAt: new Date(),
        },
      });
    }
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
