/**
 * Gmail Client Service
 * US-030: Email communication sync
 * Handles Gmail API interactions using googleapis
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { EmailAddress, EmailMessage } from '../interfaces/email.interface';

/**
 * Options for paginated email fetch
 */
export interface FetchAllMessagesOptions {
  /** How many days back to fetch emails (default: 365) */
  historyDays?: number;
  /** Custom query string (overrides historyDays if provided) */
  query?: string;
  /** Progress callback for tracking fetch progress */
  onProgress?: (fetched: number) => void;
}

/**
 * Result of paginated email fetch
 */
export interface FetchAllMessagesResult {
  messages: EmailMessage[];
  totalFetched: number;
  pagesProcessed: number;
}

/** Gmail API max results per page */
const GMAIL_PAGE_SIZE = 500;

/** Default history days for full sync */
const DEFAULT_HISTORY_DAYS = 365;

@Injectable()
export class GmailClientService {
  private readonly logger = new Logger(GmailClientService.name);
  private oauth2Client: any;

  constructor(private readonly configService: ConfigService) {
    const clientId = this.configService.get<string>('GMAIL_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GMAIL_CLIENT_SECRET');
    const redirectUri = this.configService.get<string>('GMAIL_REDIRECT_URI');

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthUrl(userId: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'],
      state: userId,
      prompt: 'consent', // Force consent to get refresh token
    });
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    return {
      accessToken: tokens.access_token as string,
      refreshToken: tokens.refresh_token as string | undefined,
      expiresAt: new Date(tokens.expiry_date as number),
    };
  }

  /**
   * Fetch messages from Gmail
   */
  async fetchMessages(
    accessToken: string,
    options?: {
      maxResults?: number;
      query?: string;
      pageToken?: string;
    },
  ): Promise<EmailMessage[]> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: options?.maxResults ?? 100,
      q: options?.query,
      pageToken: options?.pageToken,
    });

    const messages = response.data.messages || [];
    const emailMessages: EmailMessage[] = [];

    // Fetch full message details for each message
    for (const message of messages) {
      if (!message.id) continue;

      const messageDetail = await gmail.users.messages.get({
        userId: 'me',
        id: message.id,
        format: 'full',
      });

      const parsedMessage = this.parseGmailMessage(messageDetail.data);
      emailMessages.push(parsedMessage);
    }

    return emailMessages;
  }

  /**
   * Fetch all messages with pagination support
   * Used for background sync jobs - fetches ALL emails within the time period
   * @param accessToken - Gmail OAuth access token
   * @param options - Fetch options including historyDays and progress callback
   * @returns All fetched messages with pagination info
   */
  async fetchAllMessages(
    accessToken: string,
    options?: FetchAllMessagesOptions,
  ): Promise<FetchAllMessagesResult> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const historyDays = options?.historyDays ?? DEFAULT_HISTORY_DAYS;
    const query = options?.query ?? `newer_than:${historyDays}d`;

    this.logger.log(`Fetching all messages with query: "${query}"`);

    const allMessages: EmailMessage[] = [];
    let pageToken: string | undefined;
    let pagesProcessed = 0;

    do {
      // Fetch message IDs for current page
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults: GMAIL_PAGE_SIZE,
        q: query,
        pageToken,
      });

      const messageRefs = listResponse.data.messages || [];
      pagesProcessed++;

      this.logger.debug(
        `Page ${pagesProcessed}: Found ${messageRefs.length} message references`,
      );

      // Fetch full message details for each message in this page
      for (const messageRef of messageRefs) {
        if (!messageRef.id) continue;

        try {
          const messageDetail = await gmail.users.messages.get({
            userId: 'me',
            id: messageRef.id,
            format: 'full',
          });

          const parsedMessage = this.parseGmailMessage(messageDetail.data);
          allMessages.push(parsedMessage);
        } catch (error) {
          this.logger.warn(
            `Failed to fetch message ${messageRef.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
        }
      }

      // Report progress if callback provided
      if (options?.onProgress) {
        options.onProgress(allMessages.length);
      }

      // Get next page token
      pageToken = listResponse.data.nextPageToken ?? undefined;

      this.logger.debug(
        `Progress: ${allMessages.length} messages fetched, hasNextPage: ${!!pageToken}`,
      );
    } while (pageToken);

    this.logger.log(
      `Completed fetching ${allMessages.length} messages across ${pagesProcessed} pages`,
    );

    return {
      messages: allMessages,
      totalFetched: allMessages.length,
      pagesProcessed,
    };
  }

  /**
   * Fetch incremental messages using Gmail history API
   */
  async fetchIncrementalMessages(
    accessToken: string,
    startHistoryId: string,
  ): Promise<{
    messages: EmailMessage[];
    newHistoryId: string;
  }> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    const response = await gmail.users.history.list({
      userId: 'me',
      startHistoryId,
      historyTypes: ['messageAdded'],
    });

    const history = response.data.history || [];
    const newHistoryId = response.data.historyId || startHistoryId;
    const emailMessages: EmailMessage[] = [];

    // Extract messages from history
    for (const historyRecord of history) {
      const messagesAdded = historyRecord.messagesAdded || [];

      for (const messageAdded of messagesAdded) {
        const messageId = messageAdded.message?.id;
        if (!messageId) continue;

        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        const parsedMessage = this.parseGmailMessage(messageDetail.data);
        emailMessages.push(parsedMessage);
      }
    }

    return {
      messages: emailMessages,
      newHistoryId: newHistoryId.toString(),
    };
  }

  /**
   * Parse Gmail message to EmailMessage format
   */
  private parseGmailMessage(gmailMessage: any): EmailMessage {
    const headers = gmailMessage.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name === name)?.value || '';

    const from = this.extractEmailFromHeader(getHeader('From'));
    const to = this.parseEmailList(getHeader('To'));
    const cc = getHeader('Cc') ? this.parseEmailList(getHeader('Cc')) : undefined;
    const subject = getHeader('Subject');
    const dateStr = getHeader('Date');

    // Decode body
    const body = this.decodeBody(gmailMessage.payload);

    return {
      id: gmailMessage.id as string,
      threadId: gmailMessage.threadId as string,
      from,
      to,
      cc,
      subject,
      body,
      snippet: gmailMessage.snippet || '',
      receivedAt: dateStr ? new Date(dateStr) : new Date(),
    };
  }

  /**
   * Extract email address from header string
   * Handles formats like "Name <email@example.com>" or "email@example.com"
   */
  private extractEmailFromHeader(header: string): EmailAddress {
    const match = header.match(/(.*?)<(.+?)>/);
    if (match) {
      const name = match[1]?.trim().replace(/^"|"$/g, '');
      const email = match[2]?.trim();
      return {
        email: email || '',
        name: name || undefined,
      };
    }

    return {
      email: header.trim(),
    };
  }

  /**
   * Parse comma-separated email list
   */
  private parseEmailList(listStr: string): EmailAddress[] {
    if (!listStr) return [];

    return listStr.split(',').map((email) => this.extractEmailFromHeader(email.trim()));
  }

  /**
   * Decode base64-encoded email body
   */
  private decodeBody(payload: any): string {
    if (payload.body?.data) {
      const data = payload.body.data.replace(/-/g, '+').replace(/_/g, '/');
      return Buffer.from(data, 'base64').toString('utf-8');
    }

    // Handle multipart messages
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          const data = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
          return Buffer.from(data, 'base64').toString('utf-8');
        }
      }
    }

    return '';
  }
}
