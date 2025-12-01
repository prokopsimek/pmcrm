/**
 * Unit tests for EmailSyncController
 * US-030: Email communication sync
 * TDD: RED phase - Tests written FIRST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EmailSyncController } from './email-sync.controller';
import { EmailSyncService } from './email-sync.service';
import { GmailClientService } from './services/gmail-client.service';
import { OutlookClientService } from './services/outlook-client.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('EmailSyncController', () => {
  let controller: EmailSyncController;
  let service: EmailSyncService;
  let gmailClient: GmailClientService;
  let outlookClient: OutlookClientService;

  const mockEmailSyncService = {
    getConfig: jest.fn(),
    updateConfig: jest.fn(),
    syncEmails: jest.fn(),
    excludeContactFromSync: jest.fn(),
    getSyncStatus: jest.fn(),
  };

  const mockGmailClient = {
    getAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const mockOutlookClient = {
    getAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
  };

  const mockUser = { id: 'user-123', email: 'user@example.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailSyncController],
      providers: [
        { provide: EmailSyncService, useValue: mockEmailSyncService },
        { provide: GmailClientService, useValue: mockGmailClient },
        { provide: OutlookClientService, useValue: mockOutlookClient },
      ],
    }).compile();

    controller = module.get<EmailSyncController>(EmailSyncController);
    service = module.get<EmailSyncService>(EmailSyncService);
    gmailClient = module.get<GmailClientService>(GmailClientService);
    outlookClient = module.get<OutlookClientService>(OutlookClientService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/integrations/email/config', () => {
    it('should return email sync config', async () => {
      const mockConfig = {
        id: 'config-id',
        userId: 'user-123',
        gmailEnabled: true,
        outlookEnabled: false,
        privacyMode: false,
      };

      mockEmailSyncService.getConfig.mockResolvedValue(mockConfig);

      const result = await controller.getConfig(mockUser);

      expect(result).toEqual(mockConfig);
      expect(mockEmailSyncService.getConfig).toHaveBeenCalledWith('user-123');
    });
  });

  describe('PUT /api/v1/integrations/email/config', () => {
    it('should update email sync config', async () => {
      const updateDto = { privacyMode: true, syncEnabled: true };
      const mockUpdated = {
        id: 'config-id',
        userId: 'user-123',
        ...updateDto,
      };

      mockEmailSyncService.updateConfig.mockResolvedValue(mockUpdated);

      const result = await controller.updateConfig(mockUser, updateDto);

      expect(result).toEqual(mockUpdated);
      expect(mockEmailSyncService.updateConfig).toHaveBeenCalledWith('user-123', updateDto);
    });
  });

  describe('GET /api/v1/integrations/gmail/auth-url', () => {
    it('should return Gmail OAuth URL', () => {
      const mockUrl = 'https://accounts.google.com/o/oauth2/v2/auth?...';
      mockGmailClient.getAuthUrl.mockReturnValue(mockUrl);

      const result = controller.getGmailAuthUrl(mockUser);

      expect(result).toEqual({ url: mockUrl });
      expect(mockGmailClient.getAuthUrl).toHaveBeenCalledWith('user-123');
    });
  });

  describe('POST /api/v1/integrations/gmail/connect', () => {
    it('should connect Gmail account', async () => {
      const connectDto = { code: 'auth-code-123' };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      };

      mockGmailClient.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockEmailSyncService.updateConfig.mockResolvedValue({
        gmailEnabled: true,
      });

      const result = await controller.connectGmail(mockUser, connectDto);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('gmail');
    });

    it('should handle OAuth error gracefully', async () => {
      const connectDto = { code: 'invalid-code' };
      mockGmailClient.exchangeCodeForTokens.mockRejectedValue(
        new Error('Invalid authorization code'),
      );

      await expect(controller.connectGmail(mockUser, connectDto)).rejects.toThrow();
    });
  });

  describe('GET /api/v1/integrations/outlook/auth-url', () => {
    it('should return Outlook OAuth URL', () => {
      const mockUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?...';
      mockOutlookClient.getAuthUrl.mockReturnValue(mockUrl);

      const result = controller.getOutlookAuthUrl(mockUser);

      expect(result).toEqual({ url: mockUrl });
      expect(mockOutlookClient.getAuthUrl).toHaveBeenCalledWith('user-123');
    });
  });

  describe('POST /api/v1/integrations/outlook/connect', () => {
    it('should connect Outlook account', async () => {
      const connectDto = { code: 'auth-code-123' };
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      };

      mockOutlookClient.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockEmailSyncService.updateConfig.mockResolvedValue({
        outlookEnabled: true,
      });

      const result = await controller.connectOutlook(mockUser, connectDto);

      expect(result.success).toBe(true);
      expect(result.provider).toBe('outlook');
    });
  });

  describe('POST /api/v1/integrations/email/sync', () => {
    it('should trigger email sync for Gmail', async () => {
      const syncDto = { provider: 'gmail' as const };
      const mockResult = {
        provider: 'gmail' as const,
        emailsProcessed: 10,
        interactionsCreated: 8,
        contactsMatched: 5,
        errors: [],
      };

      mockEmailSyncService.syncEmails.mockResolvedValue(mockResult);

      const result = await controller.triggerSync(mockUser, syncDto);

      expect(result).toEqual(mockResult);
      expect(mockEmailSyncService.syncEmails).toHaveBeenCalledWith('user-123', 'gmail', false);
    });

    it('should trigger full sync when requested', async () => {
      const syncDto = { provider: 'gmail' as const, fullSync: true };
      mockEmailSyncService.syncEmails.mockResolvedValue({
        provider: 'gmail' as const,
        emailsProcessed: 100,
        interactionsCreated: 80,
        contactsMatched: 50,
        errors: [],
      });

      await controller.triggerSync(mockUser, syncDto);

      expect(mockEmailSyncService.syncEmails).toHaveBeenCalledWith('user-123', 'gmail', true);
    });

    it('should sync both providers when provider is "both"', async () => {
      const syncDto = { provider: 'both' as const };
      mockEmailSyncService.syncEmails.mockResolvedValue({
        provider: 'gmail' as const,
        emailsProcessed: 10,
        interactionsCreated: 8,
        contactsMatched: 5,
        errors: [],
      });

      await controller.triggerSync(mockUser, syncDto);

      expect(mockEmailSyncService.syncEmails).toHaveBeenCalledTimes(2);
      expect(mockEmailSyncService.syncEmails).toHaveBeenCalledWith('user-123', 'gmail', false);
      expect(mockEmailSyncService.syncEmails).toHaveBeenCalledWith('user-123', 'outlook', false);
    });
  });

  describe('GET /api/v1/integrations/email/status', () => {
    it('should return sync status', async () => {
      const mockStatus = {
        syncEnabled: true,
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        gmailEnabled: true,
        outlookEnabled: false,
      };

      mockEmailSyncService.getSyncStatus.mockResolvedValue(mockStatus);

      const result = await controller.getSyncStatus(mockUser);

      expect(result).toEqual(mockStatus);
    });

    it('should throw NotFoundException if config does not exist', async () => {
      mockEmailSyncService.getSyncStatus.mockRejectedValue(
        new NotFoundException('Email sync config not found'),
      );

      await expect(controller.getSyncStatus(mockUser)).rejects.toThrow(NotFoundException);
    });
  });

  describe('POST /api/v1/integrations/email/exclude', () => {
    it('should exclude contact from sync', async () => {
      const excludeDto = { email: 'exclude@example.com' };
      mockEmailSyncService.excludeContactFromSync.mockResolvedValue(undefined);

      const result = await controller.excludeContact(mockUser, excludeDto);

      expect(result.success).toBe(true);
      expect(mockEmailSyncService.excludeContactFromSync).toHaveBeenCalledWith(
        'user-123',
        'exclude@example.com',
      );
    });
  });

  describe('DELETE /api/v1/integrations/email/disconnect', () => {
    it('should disconnect email sync for Gmail', async () => {
      mockEmailSyncService.updateConfig.mockResolvedValue({
        gmailEnabled: false,
      });

      const result = await controller.disconnect(mockUser, { provider: 'gmail' });

      expect(result.success).toBe(true);
      expect(mockEmailSyncService.updateConfig).toHaveBeenCalledWith('user-123', {
        gmailEnabled: false,
      });
    });

    it('should disconnect email sync for Outlook', async () => {
      mockEmailSyncService.updateConfig.mockResolvedValue({
        outlookEnabled: false,
      });

      const result = await controller.disconnect(mockUser, { provider: 'outlook' });

      expect(result.success).toBe(true);
      expect(mockEmailSyncService.updateConfig).toHaveBeenCalledWith('user-123', {
        outlookEnabled: false,
      });
    });
  });
});
