/**
 * Contact Email Service
 * Fetches and syncs emails for a specific contact from Gmail
 */

import { RelationshipScoreService } from '@/modules/contacts/services/relationship-score.service';
import { PrismaService } from '@/shared/database/prisma.service';
import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    MessageEvent,
    NotFoundException,
    forwardRef,
} from '@nestjs/common';
import { EmailDirection, EmailParticipationType } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { OAuthService } from '../../shared/oauth.service';
import { GmailClientService } from './gmail-client.service';

export interface ContactEmail {
  id: string;
  threadId: string;
  subject: string | null;
  snippet: string | null;
  body: string | null;
  direction: EmailDirection;
  participationType: EmailParticipationType;
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
    private readonly oauthService: OAuthService,
    @Inject(forwardRef(() => RelationshipScoreService))
    private readonly relationshipScoreService: RelationshipScoreService,
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
        participationType: e.participationType,
        occurredAt: e.occurredAt,
        externalId: e.externalId,
      })),
      total,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.id : undefined,
    };
  }

  /**
   * Get a single email by ID with full body content
   */
  async getEmailById(userId: string, contactId: string, emailId: string): Promise<ContactEmail> {
    // Verify contact belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const email = await this.prisma.emailThread.findFirst({
      where: { id: emailId, contactId },
    });

    if (!email) {
      throw new NotFoundException('Email not found');
    }

    return {
      id: email.id,
      threadId: email.threadId,
      subject: email.subject,
      snippet: email.snippet,
      body: email.body,
      direction: email.direction,
      participationType: email.participationType,
      occurredAt: email.occurredAt,
      externalId: email.externalId,
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
      // Fetch emails involving this contact (including CC)
      const query = `(from:${contactEmail} OR to:${contactEmail} OR cc:${contactEmail})`;
      const messages = await this.gmailClient.fetchMessages(accessToken, {
        query,
        maxResults: 100,
      });

      this.logger.log(`Fetched ${messages.length} emails for contact ${contactId}`);

      // Store emails in database
      let syncedCount = 0;
      for (const message of messages) {
        const fromEmail = message.from.email.toLowerCase();
        const userEmail = user.email.toLowerCase();
        const contactEmailLower = contactEmail.toLowerCase();

        // Determine direction (from user's perspective)
        const direction = fromEmail === userEmail ? 'OUTBOUND' : 'INBOUND';

        // Determine participation type (how the contact participated)
        const participationType = this.determineParticipationType(
          message,
          contactEmailLower,
        );

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
              participationType: participationType as EmailParticipationType,
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
              participationType: participationType as EmailParticipationType,
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

        // Recalculate relationship score after email sync
        try {
          await this.relationshipScoreService.updateContactScore(contactId);
        } catch (error) {
          this.logger.warn(`Failed to update relationship score for contact ${contactId}:`, error);
        }
      }

      return syncedCount;
    } catch (error) {
      this.logger.error(`Failed to sync emails for contact ${contactId}:`, error);
      throw error;
    }
  }

  /**
   * Determine how the contact participated in the email
   * Priority: SENDER > RECIPIENT > CC
   */
  private determineParticipationType(
    message: { from: { email: string }; to: { email: string }[]; cc?: { email: string }[] },
    contactEmail: string,
  ): EmailParticipationType {
    // Check if contact is the sender
    if (message.from.email.toLowerCase() === contactEmail) {
      return 'SENDER';
    }

    // Check if contact is a direct recipient (TO)
    const isRecipient = message.to.some(
      (recipient) => recipient.email.toLowerCase() === contactEmail,
    );
    if (isRecipient) {
      return 'RECIPIENT';
    }

    // Check if contact is in CC
    const isCC = message.cc?.some((cc) => cc.email.toLowerCase() === contactEmail);
    if (isCC) {
      return 'CC';
    }

    // Default to RECIPIENT if we can't determine (shouldn't happen)
    return 'RECIPIENT';
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

    // Check if token is expired or about to expire (5 min buffer)
    if (
      integration.expiresAt &&
      new Date() >= new Date(integration.expiresAt.getTime() - 5 * 60 * 1000)
    ) {
      if (!integration.refreshToken) {
        throw new BadRequestException('Gmail refresh token not available. Please reconnect.');
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

    // Decrypt token before returning
    return this.oauthService.decryptToken(integration.accessToken);
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
      participationType: e.participationType,
      occurredAt: e.occurredAt,
      externalId: e.externalId,
    }));
  }

  /**
   * Stream emails with progressive loading (SSE)
   * Returns emails one by one for progressive UI updates
   */
  streamEmailsWithSummaries(
    userId: string,
    contactId: string,
    regenerateMissing = false,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    // Run async processing in background
    this.processEmailsForStreaming(userId, contactId, regenerateMissing, subject);

    return subject.asObservable();
  }

  /**
   * Internal method to process emails and emit them via SSE
   */
  private async processEmailsForStreaming(
    userId: string,
    contactId: string,
    regenerateMissing: boolean,
    subject: Subject<MessageEvent>,
  ): Promise<void> {
    try {
      // Verify contact belongs to user
      const contact = await this.prisma.contact.findFirst({
        where: { id: contactId, userId, deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      if (!contact) {
        subject.error(new NotFoundException('Contact not found'));
        return;
      }

      // Get all emails for this contact
      const emails = await this.prisma.emailThread.findMany({
        where: { contactId },
        orderBy: { occurredAt: 'desc' },
        take: 100, // Limit for streaming
      });

      // Send initial count
      subject.next({
        data: JSON.stringify({ type: 'init', total: emails.length }),
      });

      // Process each email
      for (const [index, email] of emails.entries()) {
        // Emit the email
        subject.next({
          data: JSON.stringify({
            type: 'email',
            index,
            email: {
              id: email.id,
              threadId: email.threadId,
              subject: email.subject,
              snippet: email.snippet,
              direction: email.direction,
              participationType: email.participationType,
              occurredAt: email.occurredAt,
              externalId: email.externalId,
            },
          }),
        });
      }

      // Send completion event
      subject.next({
        data: JSON.stringify({ type: 'complete', total: emails.length }),
      });

      subject.complete();
    } catch (error) {
      this.logger.error(`Error streaming emails: ${error}`);
      subject.error(error);
    }
  }
}
