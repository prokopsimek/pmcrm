/**
 * Unit tests for GmailClientService
 * US-030: Email communication sync
 * TDD: RED phase - Tests written FIRST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { GmailClientService } from './gmail-client.service';
import { ConfigService } from '@nestjs/config';
import { EmailMessage } from '../interfaces/email.interface';

describe('GmailClientService', () => {
  let service: GmailClientService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        GMAIL_CLIENT_ID: 'test-client-id',
        GMAIL_CLIENT_SECRET: 'test-client-secret',
        GMAIL_REDIRECT_URI: 'http://localhost:3000/callback',
      };
      return config[key];
    }),
  };

  // Mock gmail API responses
  const mockGmailApi = {
    users: {
      messages: {
        list: jest.fn(),
        get: jest.fn(),
      },
      history: {
        list: jest.fn(),
      },
      getProfile: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GmailClientService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get<GmailClientService>(GmailClientService);
    configService = module.get<ConfigService>(ConfigService);

    // Mock the gmail API client
    (service as any).gmail = mockGmailApi;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthUrl', () => {
    it('should generate correct OAuth2 URL', () => {
      const url = service.getAuthUrl('user-123');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('scope=');
      expect(url).toContain('gmail.readonly');
      expect(url).toContain('state=user-123');
    });

    it('should include redirect URI', () => {
      const url = service.getAuthUrl('user-123');

      expect(url).toContain('redirect_uri=');
      expect(url).toContain(encodeURIComponent('http://localhost:3000/callback'));
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for access token', async () => {
      const mockTokens = {
        access_token: 'access-token-123',
        refresh_token: 'refresh-token-123',
        expiry_date: Date.now() + 3600000,
      };

      const result = await service.exchangeCodeForTokens('auth-code-123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('expiresAt');
    });

    it('should handle missing refresh token', async () => {
      const mockTokens = {
        access_token: 'access-token-123',
        expiry_date: Date.now() + 3600000,
      };

      const result = await service.exchangeCodeForTokens('auth-code-123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeUndefined();
    });
  });

  describe('fetchMessages', () => {
    it('should fetch messages from Gmail API', async () => {
      const mockMessages = {
        data: {
          messages: [
            { id: 'msg-1', threadId: 'thread-1' },
            { id: 'msg-2', threadId: 'thread-2' },
          ],
          resultSizeEstimate: 2,
        },
      };

      mockGmailApi.users.messages.list.mockResolvedValue(mockMessages);

      const mockMessageDetails = {
        data: {
          id: 'msg-1',
          threadId: 'thread-1',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'Test Subject' },
              { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 GMT' },
            ],
            body: {
              data: Buffer.from('Test body').toString('base64'),
            },
          },
          snippet: 'Test snippet',
        },
      };

      mockGmailApi.users.messages.get.mockResolvedValue(mockMessageDetails);

      const result = await service.fetchMessages('access-token');

      expect(result).toHaveLength(2);
      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith({
        userId: 'me',
        maxResults: 100,
      });
    });

    it('should limit number of fetched messages', async () => {
      mockGmailApi.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      await service.fetchMessages('access-token', { maxResults: 50 });

      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 50 }),
      );
    });

    it('should filter by query parameter', async () => {
      mockGmailApi.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      await service.fetchMessages('access-token', { query: 'is:unread' });

      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'is:unread' }),
      );
    });

    it('should handle pagination with pageToken', async () => {
      mockGmailApi.users.messages.list.mockResolvedValue({
        data: { messages: [], nextPageToken: 'next-token' },
      });

      await service.fetchMessages('access-token', { pageToken: 'current-token' });

      expect(mockGmailApi.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({ pageToken: 'current-token' }),
      );
    });
  });

  describe('fetchIncrementalMessages', () => {
    it('should fetch messages using history API', async () => {
      const mockHistory = {
        data: {
          history: [
            {
              messagesAdded: [{ message: { id: 'msg-new-1', threadId: 'thread-1' } }],
            },
          ],
          historyId: '12345',
        },
      };

      mockGmailApi.users.history.list.mockResolvedValue(mockHistory);

      const mockMessageDetails = {
        data: {
          id: 'msg-new-1',
          threadId: 'thread-1',
          payload: {
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'New email' },
              { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 GMT' },
            ],
            body: { data: Buffer.from('Body').toString('base64') },
          },
          snippet: 'Snippet',
        },
      };

      mockGmailApi.users.messages.get.mockResolvedValue(mockMessageDetails);

      const result = await service.fetchIncrementalMessages('access-token', '12340');

      expect(result.messages).toBeDefined();
      expect(result.newHistoryId).toBe('12345');
      expect(mockGmailApi.users.history.list).toHaveBeenCalledWith({
        userId: 'me',
        startHistoryId: '12340',
        historyTypes: ['messageAdded'],
      });
    });

    it('should handle no new messages', async () => {
      mockGmailApi.users.history.list.mockResolvedValue({
        data: { history: [], historyId: '12345' },
      });

      const result = await service.fetchIncrementalMessages('access-token', '12340');

      expect(result.messages).toHaveLength(0);
      expect(result.newHistoryId).toBe('12345');
    });
  });

  describe('parseGmailMessage', () => {
    it('should parse Gmail message to EmailMessage format', () => {
      const gmailMessage = {
        id: 'msg-123',
        threadId: 'thread-456',
        payload: {
          headers: [
            { name: 'From', value: 'John Doe <john@example.com>' },
            { name: 'To', value: 'jane@example.com' },
            { name: 'Cc', value: 'bob@example.com, alice@example.com' },
            { name: 'Subject', value: 'Test Subject' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 12:00:00 GMT' },
          ],
          body: {
            data: Buffer.from('Email body content').toString('base64'),
          },
        },
        snippet: 'Email body content',
      };

      const result: EmailMessage = service['parseGmailMessage'](gmailMessage);

      expect(result.id).toBe('msg-123');
      expect(result.threadId).toBe('thread-456');
      expect(result.from.email).toBe('john@example.com');
      expect(result.from.name).toBe('John Doe');
      expect(result.subject).toBe('Test Subject');
      expect(result.body).toContain('Email body content');
      expect(result.to).toHaveLength(1);
      expect(result.cc).toHaveLength(2);
    });

    it('should handle missing headers gracefully', () => {
      const gmailMessage = {
        id: 'msg-123',
        threadId: 'thread-456',
        payload: {
          headers: [{ name: 'From', value: 'john@example.com' }],
          body: { data: '' },
        },
        snippet: 'Test',
      };

      const result = service['parseGmailMessage'](gmailMessage);

      expect(result.subject).toBe('');
      expect(result.to).toHaveLength(0);
    });

    it('should decode base64 email body', () => {
      const bodyText = 'This is the email body';
      const gmailMessage = {
        id: 'msg-123',
        threadId: 'thread-456',
        payload: {
          headers: [
            { name: 'From', value: 'john@example.com' },
            { name: 'Date', value: new Date().toISOString() },
          ],
          body: {
            data: Buffer.from(bodyText).toString('base64'),
          },
        },
        snippet: 'snippet',
      };

      const result = service['parseGmailMessage'](gmailMessage);

      expect(result.body).toBe(bodyText);
    });
  });

  describe('extractEmailFromHeader', () => {
    it('should extract email from "Name <email>" format', () => {
      const header = 'John Doe <john@example.com>';
      const result = service['extractEmailFromHeader'](header);

      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('John Doe');
    });

    it('should handle plain email without name', () => {
      const header = 'john@example.com';
      const result = service['extractEmailFromHeader'](header);

      expect(result.email).toBe('john@example.com');
      expect(result.name).toBeUndefined();
    });

    it('should handle email with quotes', () => {
      const header = '"Doe, John" <john@example.com>';
      const result = service['extractEmailFromHeader'](header);

      expect(result.email).toBe('john@example.com');
      expect(result.name).toBe('Doe, John');
    });
  });
});
