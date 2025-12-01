/**
 * Unit tests for EmailSyncService
 * US-030: Email communication sync
 * TDD: RED phase - Tests written FIRST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EmailSyncService } from './email-sync.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { GmailClientService } from './services/gmail-client.service';
import { OutlookClientService } from './services/outlook-client.service';
import { EmailMatcherService } from './services/email-matcher.service';
import { SentimentAnalyzerService } from './services/sentiment-analyzer.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('EmailSyncService', () => {
  let service: EmailSyncService;
  let prismaService: PrismaService;
  let gmailClient: GmailClientService;
  let outlookClient: OutlookClientService;
  let emailMatcher: EmailMatcherService;
  let sentimentAnalyzer: SentimentAnalyzerService;

  const mockPrismaService = {
    emailSyncConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    integration: {
      findFirst: jest.fn(),
    },
    interaction: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    interactionParticipant: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockGmailClient = {
    fetchMessages: jest.fn(),
    fetchIncrementalMessages: jest.fn(),
    getAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const mockOutlookClient = {
    fetchMessages: jest.fn(),
    fetchIncrementalMessages: jest.fn(),
    getAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const mockEmailMatcher = {
    matchEmailToContacts: jest.fn(),
    shouldExcludeEmail: jest.fn(),
    extractEmailAddresses: jest.fn(),
  };

  const mockSentimentAnalyzer = {
    analyzeSentiment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailSyncService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: GmailClientService, useValue: mockGmailClient },
        { provide: OutlookClientService, useValue: mockOutlookClient },
        { provide: EmailMatcherService, useValue: mockEmailMatcher },
        { provide: SentimentAnalyzerService, useValue: mockSentimentAnalyzer },
      ],
    }).compile();

    service = module.get<EmailSyncService>(EmailSyncService);
    prismaService = module.get<PrismaService>(PrismaService);
    gmailClient = module.get<GmailClientService>(GmailClientService);
    outlookClient = module.get<OutlookClientService>(OutlookClientService);
    emailMatcher = module.get<EmailMatcherService>(EmailMatcherService);
    sentimentAnalyzer = module.get<SentimentAnalyzerService>(SentimentAnalyzerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getConfig', () => {
    it('should return existing config', async () => {
      const mockConfig = {
        id: 'config-id',
        userId: 'user-123',
        provider: 'gmail',
        gmailEnabled: true,
        outlookEnabled: false,
        privacyMode: false,
        syncEnabled: true,
      };

      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getConfig('user-123');

      expect(result).toEqual(mockConfig);
      expect(mockPrismaService.emailSyncConfig.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      });
    });

    it('should return null if config does not exist', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig('user-123');

      expect(result).toBeNull();
    });
  });

  describe('updateConfig', () => {
    it('should create config if it does not exist', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(null);
      mockPrismaService.emailSyncConfig.create.mockResolvedValue({
        id: 'new-config-id',
        userId: 'user-123',
        gmailEnabled: true,
        provider: 'gmail',
      });

      const result = await service.updateConfig('user-123', { gmailEnabled: true });

      expect(mockPrismaService.emailSyncConfig.create).toHaveBeenCalled();
      expect(result.gmailEnabled).toBe(true);
    });

    it('should update existing config', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        id: 'config-id',
        userId: 'user-123',
      });
      mockPrismaService.emailSyncConfig.update.mockResolvedValue({
        id: 'config-id',
        userId: 'user-123',
        privacyMode: true,
      });

      const result = await service.updateConfig('user-123', { privacyMode: true });

      expect(mockPrismaService.emailSyncConfig.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { privacyMode: true },
      });
    });
  });

  describe('syncEmails', () => {
    it('should sync Gmail emails successfully', async () => {
      const mockConfig = {
        userId: 'user-123',
        gmailEnabled: true,
        outlookEnabled: false,
        syncEnabled: true,
        privacyMode: false,
        excludedEmails: [],
        excludedDomains: [],
      };

      const mockIntegration = {
        accessToken: 'gmail-token',
      };

      const mockEmails = [
        {
          id: 'email-1',
          threadId: 'thread-1',
          from: { email: 'sender@example.com', name: 'Sender' },
          to: [{ email: 'user@example.com', name: 'User' }],
          subject: 'Test Email',
          body: 'Email body',
          snippet: 'Email snippet',
          receivedAt: new Date(),
        },
      ];

      const mockContacts = [{ id: 'contact-1', email: 'sender@example.com' }];

      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);
      mockGmailClient.fetchIncrementalMessages.mockResolvedValue({
        messages: mockEmails,
        newHistoryId: '12345',
      });
      mockEmailMatcher.shouldExcludeEmail.mockResolvedValue(false);
      mockEmailMatcher.matchEmailToContacts.mockResolvedValue(mockContacts);
      mockSentimentAnalyzer.analyzeSentiment.mockReturnValue({
        score: 0.5,
        label: 'positive',
        comparative: 0.25,
      });
      mockPrismaService.interaction.findFirst.mockResolvedValue(null);
      mockPrismaService.interaction.create.mockResolvedValue({
        id: 'interaction-1',
      });

      const result = await service.syncEmails('user-123', 'gmail');

      expect(result.provider).toBe('gmail');
      expect(result.emailsProcessed).toBe(1);
      expect(result.interactionsCreated).toBe(1);
      expect(result.contactsMatched).toBe(1);
    });

    it('should throw error if sync is disabled', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        syncEnabled: false,
      });

      await expect(service.syncEmails('user-123', 'gmail')).rejects.toThrow(BadRequestException);
    });

    it('should throw error if provider is not enabled', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        syncEnabled: true,
        gmailEnabled: false,
      });

      await expect(service.syncEmails('user-123', 'gmail')).rejects.toThrow(BadRequestException);
    });

    it('should skip emails from excluded addresses', async () => {
      const mockConfig = {
        userId: 'user-123',
        gmailEnabled: true,
        syncEnabled: true,
        excludedEmails: ['spam@example.com'],
      };

      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrismaService.integration.findFirst.mockResolvedValue({
        accessToken: 'token',
      });
      mockGmailClient.fetchIncrementalMessages.mockResolvedValue({
        messages: [
          {
            id: 'email-1',
            from: { email: 'spam@example.com' },
            to: [],
            subject: 'Spam',
            body: 'Spam content',
            snippet: 'Spam',
            receivedAt: new Date(),
            threadId: 'thread-1',
          },
        ],
        newHistoryId: '12345',
      });
      mockEmailMatcher.shouldExcludeEmail.mockResolvedValue(true);

      const result = await service.syncEmails('user-123', 'gmail');

      expect(result.emailsProcessed).toBe(0);
      expect(result.interactionsCreated).toBe(0);
    });

    it('should respect privacy mode and not store email content', async () => {
      const mockConfig = {
        userId: 'user-123',
        gmailEnabled: true,
        syncEnabled: true,
        privacyMode: true,
      };

      const mockEmail = {
        id: 'email-1',
        threadId: 'thread-1',
        from: { email: 'sender@example.com' },
        to: [{ email: 'user@example.com' }],
        subject: 'Private Email',
        body: 'This should not be stored',
        snippet: 'Snippet',
        receivedAt: new Date(),
      };

      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(mockConfig);
      mockPrismaService.integration.findFirst.mockResolvedValue({
        accessToken: 'token',
      });
      mockGmailClient.fetchIncrementalMessages.mockResolvedValue({
        messages: [mockEmail],
        newHistoryId: '12345',
      });
      mockEmailMatcher.shouldExcludeEmail.mockResolvedValue(false);
      mockEmailMatcher.matchEmailToContacts.mockResolvedValue([]);
      mockPrismaService.interaction.findFirst.mockResolvedValue(null);
      mockPrismaService.interaction.create.mockResolvedValue({ id: 'interaction-1' });

      await service.syncEmails('user-123', 'gmail');

      expect(mockPrismaService.interaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: null, // Content should be null in privacy mode
          subject: 'Private Email', // Subject is kept
        }),
      });
    });

    it('should skip duplicate emails', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        userId: 'user-123',
        gmailEnabled: true,
        syncEnabled: true,
      });
      mockPrismaService.integration.findFirst.mockResolvedValue({
        accessToken: 'token',
      });
      mockGmailClient.fetchIncrementalMessages.mockResolvedValue({
        messages: [
          {
            id: 'email-1',
            threadId: 'thread-1',
            from: { email: 'sender@example.com' },
            to: [{ email: 'user@example.com' }],
            subject: 'Test',
            body: 'Body',
            snippet: 'Snippet',
            receivedAt: new Date(),
          },
        ],
        newHistoryId: '12345',
      });
      mockEmailMatcher.shouldExcludeEmail.mockResolvedValue(false);
      mockEmailMatcher.matchEmailToContacts.mockResolvedValue([]);
      // Email already exists
      mockPrismaService.interaction.findFirst.mockResolvedValue({
        id: 'existing-interaction',
      });

      const result = await service.syncEmails('user-123', 'gmail');

      expect(result.interactionsCreated).toBe(0);
      expect(mockPrismaService.interaction.create).not.toHaveBeenCalled();
    });
  });

  describe('excludeContactFromSync', () => {
    it('should add email to exclusion list', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        userId: 'user-123',
        excludedEmails: ['existing@example.com'],
      });
      mockPrismaService.emailSyncConfig.update.mockResolvedValue({
        userId: 'user-123',
        excludedEmails: ['existing@example.com', 'new@example.com'],
      });

      await service.excludeContactFromSync('user-123', 'new@example.com');

      expect(mockPrismaService.emailSyncConfig.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          excludedEmails: ['existing@example.com', 'new@example.com'],
        },
      });
    });

    it('should not duplicate emails in exclusion list', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        userId: 'user-123',
        excludedEmails: ['existing@example.com'],
      });

      await service.excludeContactFromSync('user-123', 'existing@example.com');

      expect(mockPrismaService.emailSyncConfig.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: {
          excludedEmails: ['existing@example.com'],
        },
      });
    });
  });

  describe('getSyncStatus', () => {
    it('should return sync status', async () => {
      const mockConfig = {
        id: 'config-id',
        userId: 'user-123',
        syncEnabled: true,
        lastSyncAt: new Date('2024-01-01'),
        lastSyncStatus: 'success',
        gmailEnabled: true,
        outlookEnabled: false,
      };

      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(mockConfig);

      const result = await service.getSyncStatus('user-123');

      expect(result.syncEnabled).toBe(true);
      expect(result.lastSyncStatus).toBe('success');
    });

    it('should throw NotFoundException if config does not exist', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(null);

      await expect(service.getSyncStatus('user-123')).rejects.toThrow(NotFoundException);
    });
  });
});
