/**
 * Contact Email Service
 * Fetches and syncs emails for a specific contact from Gmail
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { GmailClientService } from './gmail-client.service';
import { EmailDirection } from '@prisma/client';

export interface ContactEmail {
  id: string;
  threadId: string;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  direction: EmailDirection;
  occurredAt: Date;
  externalId: string;
}

export interface PaginatedEmails {
  data: ContactEmail[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

@Injectable()
export class ContactEmailService {
  private readonly logger = new Logger(ContactEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gmailClient: GmailClientService,
  ) {}

  /**
   * Get emails for a specific contact (from cache or fetch new)
   */
  async getContactEmails(
    userId: string,
    contactId: string,
    options: {
      limit?: number;
      cursor?: string;
      forceSync?: boolean;
    } = {},
  ): Promise<PaginatedEmails> {
    const { limit = 20, cursor, forceSync = false } = options;

    // Verify contact belongs to user and get email
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (!contact.email) {
      return { data: [], total: 0, hasMore: false };
    }

    // Check if we need to sync emails
    const lastEmail = await this.prisma.emailThread.findFirst({
      where: { contactId },
      orderBy: { occurredAt: 'desc' },
    });

    const shouldSync =
      forceSync ||
      !lastEmail ||
      new Date().getTime() - lastEmail.createdAt.getTime() > 15 * 60 * 1000; // 15 minutes

    if (shouldSync) {
      await this.syncContactEmails(userId, contactId, contact.email);
    }

    // Query from cache
    const whereClause = {
      contactId,
      ...(cursor && { id: { lt: cursor } }),
    };

    const [emails, total] = await Promise.all([
      this.prisma.emailThread.findMany({
        where: whereClause,
        orderBy: { occurredAt: 'desc' },
        take: limit + 1, // Get one extra to check if there's more
      }),
      this.prisma.emailThread.count({ where: { contactId } }),
    ]);

    const hasMore = emails.length > limit;
    const data = emails.slice(0, limit);

    return {
      data: data.map((e) => ({
        id: e.id,
        threadId: e.threadId,
        subject: e.subject,
        snippet: e.snippet,
        body: e.body,
        direction: e.direction,
        occurredAt: e.occurredAt,
        externalId: e.externalId,
      })),
      total,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    };
  }

  /**
   * Sync emails from Gmail for a specific contact
   */
  async syncContactEmails(
    userId: string,
    contactId: string,
    contactEmail: string,
  ): Promise<number> {
    // Get Gmail integration for user
    const integration = await this.prisma.integration.findFirst({
      where: {
        userId,
        type: 'GMAIL',
        isActive: true,
      },
    });

    if (!integration || !integration.accessToken) {
      this.logger.debug(`No Gmail integration found for user ${userId}`);
      return 0;
    }

    // Check token expiry and refresh if needed
    const accessToken = await this.ensureValidToken(integration);

    // Get user's email for direction detection
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw new BadRequestException('User email not found');
    }

    try {
      // Fetch emails involving this contact
      const query = `(from:${contactEmail} OR to:${contactEmail})`;
      const messages = await this.gmailClient.fetchMessages(accessToken, {
        query,
        maxResults: 100,
      });

      this.logger.log(`Fetched ${messages.length} emails for contact ${contactId}`);

      // Store emails in database
      let syncedCount = 0;
      for (const message of messages) {
        // Determine direction
        const fromEmail = message.from.email.toLowerCase();
        const userEmail = user.email.toLowerCase();
        const direction = fromEmail === userEmail ? 'OUTBOUND' : 'INBOUND';

        try {
          await this.prisma.emailThread.upsert({
            where: {
              contactId_externalId: {
                contactId,
                externalId: message.id,
              },
            },
            create: {
              contactId,
              threadId: message.threadId,
              subject: message.subject,
              snippet: message.snippet,
              body: message.body?.slice(0, 10000), // Limit body size
              direction: direction as EmailDirection,
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
              body: message.body?.slice(0, 10000),
              occurredAt: message.receivedAt,
            },
          });
          syncedCount++;
        } catch (error) {
          this.logger.warn(`Failed to store email ${message.id}: ${error}`);
        }
      }

      // Update contact's lastContact date if we have newer emails
      if (messages.length > 0) {
        const latestEmail = messages.reduce((latest, msg) =>
          msg.receivedAt > latest.receivedAt ? msg : latest,
        );

        await this.prisma.contact.update({
          where: { id: contactId },
          data: { lastContact: latestEmail.receivedAt },
        });
      }

      return syncedCount;
    } catch (error) {
      this.logger.error(`Failed to sync emails for contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Ensure access token is valid, refresh if needed
   */
  private async ensureValidToken(integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
  }): Promise<string> {
    if (!integration.accessToken) {
      throw new BadRequestException('Gmail access token not available');
    }

    // Check if token is expired or about to expire
    if (integration.expiresAt && integration.expiresAt < new Date(Date.now() + 5 * 60 * 1000)) {
      if (!integration.refreshToken) {
        throw new BadRequestException('Gmail refresh token not available');
      }

      // TODO: Implement token refresh using gmailClient
      this.logger.warn('Token refresh not yet implemented');
    }

    return integration.accessToken;
  }

  /**
   * Get email thread details
   */
  async getEmailThread(
    userId: string,
    contactId: string,
    threadId: string,
  ): Promise<ContactEmail[]> {
    // Verify contact belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const emails = await this.prisma.emailThread.findMany({
      where: { contactId, threadId },
      orderBy: { occurredAt: 'asc' },
    });

    return emails.map((e) => ({
      id: e.id,
      threadId: e.threadId,
      subject: e.subject,
      snippet: e.snippet,
      body: e.body,
      direction: e.direction,
      occurredAt: e.occurredAt,
      externalId: e.externalId,
    }));
  }
}
