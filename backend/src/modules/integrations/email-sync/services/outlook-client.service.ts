/**
 * Outlook Client Service
 * US-030: Email communication sync
 * Handles Microsoft Graph API interactions for Outlook
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@microsoft/microsoft-graph-client';
import { EmailMessage, EmailAddress } from '../interfaces/email.interface';

@Injectable()
export class OutlookClientService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('OUTLOOK_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('OUTLOOK_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('OUTLOOK_REDIRECT_URI') || '';
  }

  /**
   * Get OAuth2 authorization URL for Microsoft
   */
  getAuthUrl(userId: string): string {
    const scopes = encodeURIComponent('offline_access Mail.Read');
    const state = encodeURIComponent(userId);

    return (
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${this.clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(this.redirectUri)}&` +
      `scope=${scopes}&` +
      `state=${state}&` +
      `response_mode=query`
    );
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresAt: Date;
  }> {
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('code', code);
    params.append('redirect_uri', this.redirectUri);
    params.append('grant_type', 'authorization_code');

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Fetch messages from Microsoft Graph API
   */
  async fetchMessages(
    accessToken: string,
    options?: {
      maxResults?: number;
      filter?: string;
    },
  ): Promise<EmailMessage[]> {
    const client = this.getGraphClient(accessToken);

    let request = client
      .api('/me/messages')
      .select([
        'id',
        'conversationId',
        'from',
        'toRecipients',
        'ccRecipients',
        'subject',
        'bodyPreview',
        'body',
        'receivedDateTime',
        'hasAttachments',
      ]);

    if (options?.maxResults) {
      request = request.top(options.maxResults);
    }

    if (options?.filter) {
      request = request.filter(options.filter);
    }

    const response = await request.get();
    const messages = response.value || [];

    return messages.map((msg: any) => this.parseOutlookMessage(msg));
  }

  /**
   * Fetch incremental messages using Microsoft Graph delta queries
   */
  async fetchIncrementalMessages(
    accessToken: string,
    deltaToken?: string,
  ): Promise<{
    messages: EmailMessage[];
    newDeltaToken: string;
  }> {
    const client = this.getGraphClient(accessToken);

    const url = deltaToken || '/me/messages/delta';

    const response = await client.api(url).get();

    const messages = response.value || [];
    const deltaLink = response['@odata.deltaLink'];
    const newDeltaToken = deltaLink ? this.extractDeltaToken(deltaLink) : '';

    return {
      messages: messages.map((msg: any) => this.parseOutlookMessage(msg)),
      newDeltaToken: newDeltaToken || '',
    };
  }

  /**
   * Create authenticated Graph API client
   */
  private getGraphClient(accessToken: string): Client {
    return Client.init({
      authProvider: (done) => {
        done(null, accessToken);
      },
    });
  }

  /**
   * Parse Outlook message to EmailMessage format
   */
  private parseOutlookMessage(outlookMessage: any): EmailMessage {
    const from: EmailAddress = {
      email: outlookMessage.from?.emailAddress?.address || '',
      name: outlookMessage.from?.emailAddress?.name,
    };

    const to: EmailAddress[] = (outlookMessage.toRecipients || []).map((recipient: any) => ({
      email: recipient.emailAddress?.address || '',
      name: recipient.emailAddress?.name,
    }));

    const cc: EmailAddress[] | undefined = outlookMessage.ccRecipients
      ? outlookMessage.ccRecipients.map((recipient: any) => ({
          email: recipient.emailAddress?.address || '',
          name: recipient.emailAddress?.name,
        }))
      : undefined;

    let body = outlookMessage.body?.content || '';

    // Strip HTML if content type is HTML
    if (outlookMessage.body?.contentType === 'html') {
      body = this.stripHtml(body);
    }

    return {
      id: outlookMessage.id,
      threadId: outlookMessage.conversationId,
      from,
      to,
      cc,
      subject: outlookMessage.subject || '',
      body,
      snippet: outlookMessage.bodyPreview || '',
      receivedAt: new Date(outlookMessage.receivedDateTime),
    };
  }

  /**
   * Extract delta token from deltaLink URL
   */
  private extractDeltaToken(deltaLink: string): string | null {
    const match = deltaLink.match(/\$deltatoken=([^&]+)/);
    return match?.[1] ?? null;
  }

  /**
   * Simple HTML stripping (can be enhanced with a proper HTML parser)
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim();
  }
}
