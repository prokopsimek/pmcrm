/**
 * Gmail Client Service
 * US-030: Email communication sync
 * Handles Gmail API interactions using googleapis
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { EmailMessage, EmailAddress } from '../interfaces/email.interface';

@Injectable()
export class GmailClientService {
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
