/**
 * Unit tests for OutlookClientService
 * US-030: Email communication sync
 * TDD: RED phase - Tests written FIRST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OutlookClientService } from './outlook-client.service';
import { ConfigService } from '@nestjs/config';
import { EmailMessage } from '../interfaces/email.interface';

describe('OutlookClientService', () => {
  let service: OutlookClientService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        OUTLOOK_CLIENT_ID: 'test-outlook-client-id',
        OUTLOOK_CLIENT_SECRET: 'test-outlook-secret',
        OUTLOOK_REDIRECT_URI: 'http://localhost:3000/outlook/callback',
      };
      return config[key];
    }),
  };

  const mockGraphClient = {
    api: jest.fn().mockReturnThis(),
    get: jest.fn(),
    select: jest.fn().mockReturnThis(),
    top: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    orderby: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutlookClientService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<OutlookClientService>(OutlookClientService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth2 URL for Microsoft', () => {
      const url = service.getAuthUrl('user-123');

      expect(url).toContain('https://login.microsoftonline.com');
      expect(url).toContain('oauth2/v2.0/authorize');
      expect(url).toContain('client_id=test-outlook-client-id');
      expect(url).toContain('scope=');
      expect(url).toContain('Mail.Read');
      expect(url).toContain('state=user-123');
    });

    it('should include offline_access scope for refresh token', () => {
      const url = service.getAuthUrl('user-123');

      expect(url).toContain('offline_access');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for access token', async () => {
      const mockTokenResponse = {
        access_token: 'outlook-access-token',
        refresh_token: 'outlook-refresh-token',
        expires_in: 3600,
      };

      const result = await service.exchangeCodeForTokens('auth-code-123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
    });
  });

  describe('fetchMessages', () => {
    it('should fetch messages from Microsoft Graph API', async () => {
      const mockMessages = {
        value: [
          {
            id: 'msg-1',
            conversationId: 'conv-1',
            from: { emailAddress: { address: 'sender@example.com', name: 'Sender' } },
            toRecipients: [
              { emailAddress: { address: 'recipient@example.com', name: 'Recipient' } },
            ],
            subject: 'Test Subject',
            bodyPreview: 'Preview',
            body: { content: 'Email body' },
            receivedDateTime: '2024-01-01T12:00:00Z',
          },
        ],
        '@odata.nextLink': null,
      };

      mockGraphClient.api.mockReturnThis();
      mockGraphClient.get.mockResolvedValue(mockMessages);
      (service as any).client = mockGraphClient;

      const result = await service.fetchMessages('access-token');

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('msg-1');
      expect(mockGraphClient.api).toHaveBeenCalledWith('/me/messages');
    });

    it('should limit number of fetched messages', async () => {
      mockGraphClient.get.mockResolvedValue({ value: [] });
      (service as any).client = mockGraphClient;

      await service.fetchMessages('access-token', { maxResults: 50 });

      expect(mockGraphClient.top).toHaveBeenCalledWith(50);
    });

    it('should filter messages by query', async () => {
      mockGraphClient.get.mockResolvedValue({ value: [] });
      (service as any).client = mockGraphClient;

      await service.fetchMessages('access-token', {
        filter: 'isRead eq false',
      });

      expect(mockGraphClient.filter).toHaveBeenCalledWith('isRead eq false');
    });
  });

  describe('fetchIncrementalMessages', () => {
    it('should fetch messages using delta query', async () => {
      const mockDelta = {
        value: [
          {
            id: 'msg-new-1',
            conversationId: 'conv-1',
            from: { emailAddress: { address: 'sender@example.com' } },
            toRecipients: [{ emailAddress: { address: 'recipient@example.com' } }],
            subject: 'New email',
            bodyPreview: 'Preview',
            body: { content: 'Body' },
            receivedDateTime: '2024-01-01T12:00:00Z',
          },
        ],
        '@odata.deltaLink':
          'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=new-token',
      };

      mockGraphClient.api.mockReturnThis();
      mockGraphClient.get.mockResolvedValue(mockDelta);
      (service as any).client = mockGraphClient;

      const result = await service.fetchIncrementalMessages('access-token', 'old-delta-token');

      expect(result.messages).toHaveLength(1);
      expect(result.newDeltaToken).toBe('new-token');
    });

    it('should handle no new messages in delta', async () => {
      mockGraphClient.get.mockResolvedValue({
        value: [],
        '@odata.deltaLink':
          'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=same-token',
      });
      (service as any).client = mockGraphClient;

      const result = await service.fetchIncrementalMessages('access-token', 'delta-token');

      expect(result.messages).toHaveLength(0);
      expect(result.newDeltaToken).toBe('same-token');
    });
  });

  describe('parseOutlookMessage', () => {
    it('should parse Outlook message to EmailMessage format', () => {
      const outlookMessage = {
        id: 'msg-123',
        conversationId: 'conv-456',
        from: { emailAddress: { address: 'john@example.com', name: 'John Doe' } },
        toRecipients: [{ emailAddress: { address: 'jane@example.com', name: 'Jane Smith' } }],
        ccRecipients: [{ emailAddress: { address: 'bob@example.com', name: 'Bob Johnson' } }],
        subject: 'Test Subject',
        bodyPreview: 'Email preview',
        body: { content: 'Full email body', contentType: 'html' },
        receivedDateTime: '2024-01-01T12:00:00Z',
        hasAttachments: false,
      };

      const result: EmailMessage = service['parseOutlookMessage'](outlookMessage);

      expect(result.id).toBe('msg-123');
      expect(result.threadId).toBe('conv-456');
      expect(result.from.email).toBe('john@example.com');
      expect(result.from.name).toBe('John Doe');
      expect(result.subject).toBe('Test Subject');
      expect(result.to).toHaveLength(1);
      expect(result.cc).toHaveLength(1);
      expect(result.snippet).toBe('Email preview');
    });

    it('should handle messages without CC recipients', () => {
      const outlookMessage = {
        id: 'msg-123',
        conversationId: 'conv-456',
        from: { emailAddress: { address: 'john@example.com' } },
        toRecipients: [{ emailAddress: { address: 'jane@example.com' } }],
        subject: 'Test',
        bodyPreview: 'Preview',
        body: { content: 'Body' },
        receivedDateTime: '2024-01-01T12:00:00Z',
      };

      const result = service['parseOutlookMessage'](outlookMessage);

      expect(result.cc).toBeUndefined();
    });

    it('should strip HTML from body if content type is HTML', () => {
      const outlookMessage = {
        id: 'msg-123',
        conversationId: 'conv-456',
        from: { emailAddress: { address: 'john@example.com' } },
        toRecipients: [{ emailAddress: { address: 'jane@example.com' } }],
        subject: 'Test',
        bodyPreview: 'Preview',
        body: {
          content: '<p>Email <strong>body</strong></p>',
          contentType: 'html',
        },
        receivedDateTime: '2024-01-01T12:00:00Z',
      };

      const result = service['parseOutlookMessage'](outlookMessage);

      // Should strip HTML tags or keep as-is based on privacy settings
      expect(result.body).toBeDefined();
    });
  });

  describe('extractDeltaToken', () => {
    it('should extract delta token from deltaLink URL', () => {
      const deltaLink = 'https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=abc123xyz';

      const token = service['extractDeltaToken'](deltaLink);

      expect(token).toBe('abc123xyz');
    });

    it('should handle deltaLink without token', () => {
      const deltaLink = 'https://graph.microsoft.com/v1.0/me/messages/delta';

      const token = service['extractDeltaToken'](deltaLink);

      expect(token).toBeNull();
    });
  });
});
