/**
 * Unit tests for MicrosoftContactsController
 * Test-Driven Development (RED phase)
 * Coverage target: 95%+
 *
 * US-011: Import contacts from Microsoft 365
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MicrosoftContactsController } from './microsoft-contacts.controller';
import { MicrosoftContactsService } from './microsoft-contacts.service';

describe('MicrosoftContactsController (TDD - Unit)', () => {
  let controller: MicrosoftContactsController;
  let service: MicrosoftContactsService;

  const mockMicrosoftContactsService = {
    initiateOAuthFlow: jest.fn(),
    handleOAuthCallback: jest.fn(),
    fetchContacts: jest.fn(),
    fetchSharedAddressBooks: jest.fn(),
    previewImport: jest.fn(),
    importContacts: jest.fn(),
    bidirectionalSync: jest.fn(),
    incrementalSync: jest.fn(),
    disconnectIntegration: jest.fn(),
    getIntegrationStatus: jest.fn(),
    resolveConflicts: jest.fn(),
  };

  const mockUser = {
    userId: 'user-123',
    email: 'test@example.com',
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MicrosoftContactsController],
      providers: [
        {
          provide: MicrosoftContactsService,
          useValue: mockMicrosoftContactsService,
        },
      ],
    }).compile();

    controller = module.get<MicrosoftContactsController>(MicrosoftContactsController);
    service = module.get<MicrosoftContactsService>(MicrosoftContactsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/integrations/microsoft/auth', () => {
    it('should return OAuth authorization URL for Microsoft', async () => {
      const mockAuthUrl = {
        authUrl:
          'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test&scope=Contacts.Read',
        state: 'state-123',
      };

      mockMicrosoftContactsService.initiateOAuthFlow.mockResolvedValue(mockAuthUrl);

      const result = await controller.initiateAuth(mockRequest);

      expect(result).toEqual(mockAuthUrl);
      expect(service.initiateOAuthFlow).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should require authentication', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(controller.initiateAuth(unauthenticatedRequest)).rejects.toThrow();
    });

    it('should handle service errors', async () => {
      mockMicrosoftContactsService.initiateOAuthFlow.mockRejectedValue(
        new Error('OAuth configuration error'),
      );

      await expect(controller.initiateAuth(mockRequest)).rejects.toThrow(
        'OAuth configuration error',
      );
    });
  });

  describe('GET /api/v1/integrations/microsoft/callback', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'state-456';

    it('should handle successful OAuth callback', async () => {
      const mockResponse = {
        success: true,
        integrationId: 'integration-789',
        message: 'Microsoft 365 connected successfully',
      };

      mockMicrosoftContactsService.handleOAuthCallback.mockResolvedValue(mockResponse);

      const result = await controller.handleCallback(mockRequest, mockCode, mockState);

      expect(result).toEqual(mockResponse);
      expect(service.handleOAuthCallback).toHaveBeenCalledWith(
        mockUser.userId,
        mockCode,
        mockState,
      );
    });

    it('should validate required query parameters', async () => {
      await expect(controller.handleCallback(mockRequest, '', mockState)).rejects.toThrow(
        BadRequestException,
      );

      await expect(controller.handleCallback(mockRequest, mockCode, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle invalid state parameter', async () => {
      mockMicrosoftContactsService.handleOAuthCallback.mockRejectedValue(
        new BadRequestException('Invalid state parameter'),
      );

      await expect(
        controller.handleCallback(mockRequest, mockCode, 'invalid-state'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle authorization denial', async () => {
      mockMicrosoftContactsService.handleOAuthCallback.mockRejectedValue(
        new UnauthorizedException('User denied authorization'),
      );

      await expect(controller.handleCallback(mockRequest, mockCode, mockState)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle token exchange failure', async () => {
      mockMicrosoftContactsService.handleOAuthCallback.mockRejectedValue(
        new UnauthorizedException('Failed to exchange authorization code'),
      );

      await expect(controller.handleCallback(mockRequest, mockCode, mockState)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('GET /api/v1/integrations/microsoft/contacts/preview', () => {
    it('should return import preview with deduplication analysis', async () => {
      const mockPreview = {
        totalFetched: 100,
        newContacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            externalId: 'contact-1',
          },
        ],
        duplicates: [
          {
            importedContact: {
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane@example.com',
            },
            existingContact: {
              firstName: 'Jane',
              lastName: 'Smith',
              email: 'jane@example.com',
            },
            similarity: 1.0,
            matchType: 'EXACT',
          },
        ],
        summary: {
          total: 100,
          new: 75,
          exactDuplicates: 20,
          potentialDuplicates: 5,
        },
        tagsPreview: ['Red category', 'Blue category'],
        sharedFolders: ['Team Contacts', 'Sales Team'],
      };

      mockMicrosoftContactsService.previewImport.mockResolvedValue(mockPreview);

      const result = await controller.getImportPreview(mockRequest);

      expect(result).toEqual(mockPreview);
      expect(service.previewImport).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should handle preview when no contacts exist', async () => {
      const emptyPreview = {
        totalFetched: 0,
        newContacts: [],
        duplicates: [],
        summary: {
          total: 0,
          new: 0,
          exactDuplicates: 0,
          potentialDuplicates: 0,
        },
        tagsPreview: [],
        sharedFolders: [],
      };

      mockMicrosoftContactsService.previewImport.mockResolvedValue(emptyPreview);

      const result = await controller.getImportPreview(mockRequest);

      expect(result.totalFetched).toBe(0);
      expect(result.newContacts).toHaveLength(0);
    });

    it('should require active integration', async () => {
      mockMicrosoftContactsService.previewImport.mockRejectedValue(
        new BadRequestException('No active Microsoft 365 integration'),
      );

      await expect(controller.getImportPreview(mockRequest)).rejects.toThrow(BadRequestException);
    });

    it('should handle Microsoft Graph API errors', async () => {
      mockMicrosoftContactsService.previewImport.mockRejectedValue(
        new Error('Microsoft Graph API request failed'),
      );

      await expect(controller.getImportPreview(mockRequest)).rejects.toThrow(
        'Microsoft Graph API request failed',
      );
    });

    it('should support filtering by folder', async () => {
      const queryParams = {
        folderId: 'folder-123',
      };

      mockMicrosoftContactsService.previewImport.mockResolvedValue({
        totalFetched: 50,
        newContacts: [],
        duplicates: [],
        summary: { total: 50, new: 50, exactDuplicates: 0, potentialDuplicates: 0 },
        tagsPreview: [],
        sharedFolders: [],
      });

      await controller.getImportPreview(mockRequest, queryParams);

      expect(service.previewImport).toHaveBeenCalledWith(mockUser.userId, queryParams);
    });
  });

  describe('GET /api/v1/integrations/microsoft/contacts/folders', () => {
    it('should return shared address books', async () => {
      const mockFolders = {
        folders: [
          { id: 'folder-1', name: 'Team Contacts', contactCount: 25 },
          { id: 'folder-2', name: 'Sales Team', contactCount: 50 },
        ],
        totalCount: 2,
      };

      mockMicrosoftContactsService.fetchSharedAddressBooks.mockResolvedValue(mockFolders);

      const result = await controller.getSharedFolders(mockRequest);

      expect(result).toEqual(mockFolders);
      expect(service.fetchSharedAddressBooks).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should handle empty folder list', async () => {
      mockMicrosoftContactsService.fetchSharedAddressBooks.mockResolvedValue({
        folders: [],
        totalCount: 0,
      });

      const result = await controller.getSharedFolders(mockRequest);

      expect(result.folders).toHaveLength(0);
    });

    it('should handle permission errors', async () => {
      mockMicrosoftContactsService.fetchSharedAddressBooks.mockRejectedValue(
        new Error('Insufficient permissions'),
      );

      await expect(controller.getSharedFolders(mockRequest)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('POST /api/v1/integrations/microsoft/contacts/import', () => {
    const mockImportDto = {
      skipDuplicates: true,
      updateExisting: false,
      selectedContactIds: ['contact-1', 'contact-2'],
      categoryMapping: {
        'Red category': 'urgent',
        'Blue category': 'customer',
      },
      includeFolders: ['folder-1'],
    };

    it('should import contacts successfully', async () => {
      const mockImportResult = {
        success: true,
        imported: 75,
        skipped: 20,
        updated: 0,
        failed: 0,
        errors: [],
      };

      mockMicrosoftContactsService.importContacts.mockResolvedValue(mockImportResult);

      const result = await controller.importContacts(mockRequest, mockImportDto);

      expect(result).toEqual(mockImportResult);
      expect(service.importContacts).toHaveBeenCalledWith(mockUser.userId, mockImportDto);
    });

    it('should validate import DTO', async () => {
      const invalidDto = {
        skipDuplicates: 'yes', // Should be boolean
      };

      await expect(controller.importContacts(mockRequest, invalidDto as any)).rejects.toThrow();
    });

    it('should handle import with updateExisting option', async () => {
      const updateDto = {
        ...mockImportDto,
        updateExisting: true,
        skipDuplicates: false,
      };

      const mockResult = {
        success: true,
        imported: 50,
        skipped: 0,
        updated: 25,
        failed: 0,
        errors: [],
      };

      mockMicrosoftContactsService.importContacts.mockResolvedValue(mockResult);

      const result = await controller.importContacts(mockRequest, updateDto);

      expect(result.updated).toBe(25);
      expect(result.skipped).toBe(0);
    });

    it('should handle selective import by contact IDs', async () => {
      const selectiveDto = {
        skipDuplicates: true,
        updateExisting: false,
        selectedContactIds: ['contact-1'],
      };

      const mockResult = {
        success: true,
        imported: 1,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };

      mockMicrosoftContactsService.importContacts.mockResolvedValue(mockResult);

      const result = await controller.importContacts(mockRequest, selectiveDto);

      expect(result.imported).toBe(1);
    });

    it('should apply category mapping during import', async () => {
      mockMicrosoftContactsService.importContacts.mockResolvedValue({
        success: true,
        imported: 10,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: [],
      });

      await controller.importContacts(mockRequest, mockImportDto);

      expect(service.importContacts).toHaveBeenCalledWith(
        mockUser.userId,
        expect.objectContaining({
          categoryMapping: {
            'Red category': 'urgent',
            'Blue category': 'customer',
          },
        }),
      );
    });

    it('should import from specific folders', async () => {
      mockMicrosoftContactsService.importContacts.mockResolvedValue({
        success: true,
        imported: 10,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: [],
      });

      await controller.importContacts(mockRequest, mockImportDto);

      expect(service.importContacts).toHaveBeenCalledWith(
        mockUser.userId,
        expect.objectContaining({
          includeFolders: ['folder-1'],
        }),
      );
    });

    it('should return partial success with errors', async () => {
      const mockResult = {
        success: true,
        imported: 70,
        skipped: 20,
        updated: 0,
        failed: 10,
        errors: [{ contactId: 'contact-99', error: 'Invalid email format' }],
      };

      mockMicrosoftContactsService.importContacts.mockResolvedValue(mockResult);

      const result = await controller.importContacts(mockRequest, mockImportDto);

      expect(result.success).toBe(true);
      expect(result.failed).toBe(10);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle complete import failure', async () => {
      mockMicrosoftContactsService.importContacts.mockRejectedValue(
        new Error('Database transaction failed'),
      );

      await expect(controller.importContacts(mockRequest, mockImportDto)).rejects.toThrow(
        'Database transaction failed',
      );
    });

    it('should require active integration', async () => {
      mockMicrosoftContactsService.importContacts.mockRejectedValue(
        new BadRequestException('No active Microsoft 365 integration'),
      );

      await expect(controller.importContacts(mockRequest, mockImportDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /api/v1/integrations/microsoft/contacts/sync', () => {
    const mockSyncConfig = {
      enabled: true,
      strategy: 'LAST_WRITE_WINS' as const,
      syncDirection: 'BIDIRECTIONAL' as const,
    };

    it('should perform incremental sync successfully', async () => {
      const mockSyncResult = {
        success: true,
        added: 5,
        updated: 3,
        deleted: 2,
        syncedAt: new Date(),
      };

      mockMicrosoftContactsService.incrementalSync.mockResolvedValue(mockSyncResult);

      const result = await controller.syncContacts(mockRequest, mockSyncConfig);

      expect(result).toEqual(mockSyncResult);
      expect(service.incrementalSync).toHaveBeenCalledWith(mockUser.userId, mockSyncConfig);
    });

    it('should handle sync when no changes exist', async () => {
      const mockSyncResult = {
        success: true,
        added: 0,
        updated: 0,
        deleted: 0,
        syncedAt: new Date(),
      };

      mockMicrosoftContactsService.incrementalSync.mockResolvedValue(mockSyncResult);

      const result = await controller.syncContacts(mockRequest, mockSyncConfig);

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('should use deltaLink for incremental updates', async () => {
      mockMicrosoftContactsService.incrementalSync.mockResolvedValue({
        success: true,
        added: 2,
        updated: 1,
        deleted: 0,
        syncedAt: new Date(),
        deltaLink: 'new-delta-link',
      });

      const result = await controller.syncContacts(mockRequest, mockSyncConfig);

      expect(result).toHaveProperty('deltaLink');
    });

    it('should handle sync with expired token', async () => {
      mockMicrosoftContactsService.incrementalSync.mockRejectedValue(
        new UnauthorizedException('Token expired'),
      );

      await expect(controller.syncContacts(mockRequest, mockSyncConfig)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should require active integration', async () => {
      mockMicrosoftContactsService.incrementalSync.mockRejectedValue(
        new BadRequestException('No active Microsoft 365 integration'),
      );

      await expect(controller.syncContacts(mockRequest, mockSyncConfig)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle rate limit errors', async () => {
      mockMicrosoftContactsService.incrementalSync.mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      await expect(controller.syncContacts(mockRequest, mockSyncConfig)).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    it('should return sync statistics', async () => {
      const mockSyncResult = {
        success: true,
        added: 10,
        updated: 5,
        deleted: 2,
        syncedAt: new Date(),
        duration: 1250,
      };

      mockMicrosoftContactsService.incrementalSync.mockResolvedValue(mockSyncResult);

      const result = await controller.syncContacts(mockRequest, mockSyncConfig);

      expect(result).toHaveProperty('added', 10);
      expect(result).toHaveProperty('updated', 5);
      expect(result).toHaveProperty('deleted', 2);
      expect(result).toHaveProperty('syncedAt');
    });

    it('should support different sync strategies', async () => {
      const crmPriorityConfig = {
        ...mockSyncConfig,
        strategy: 'CRM_PRIORITY' as const,
      };

      mockMicrosoftContactsService.incrementalSync.mockResolvedValue({
        success: true,
        added: 0,
        updated: 0,
        deleted: 0,
        syncedAt: new Date(),
      });

      await controller.syncContacts(mockRequest, crmPriorityConfig);

      expect(service.incrementalSync).toHaveBeenCalledWith(
        mockUser.userId,
        expect.objectContaining({
          strategy: 'CRM_PRIORITY',
        }),
      );
    });
  });

  describe('PUT /api/v1/integrations/microsoft/contacts/:id/push', () => {
    const contactId = 'crm-contact-123';
    const mockSyncConfig = {
      strategy: 'LAST_WRITE_WINS' as const,
    };

    it('should push contact changes to Outlook', async () => {
      const mockResult = {
        success: true,
        direction: 'CRM_TO_OUTLOOK',
        contactId: contactId,
        updatedAt: new Date(),
      };

      mockMicrosoftContactsService.bidirectionalSync.mockResolvedValue(mockResult);

      const result = await controller.pushContactToOutlook(mockRequest, contactId, mockSyncConfig);

      expect(result).toEqual(mockResult);
      expect(service.bidirectionalSync).toHaveBeenCalledWith(
        mockUser.userId,
        contactId,
        mockSyncConfig,
      );
    });

    it('should handle conflicts during push', async () => {
      const mockResult = {
        success: true,
        hasConflicts: true,
        conflicts: [
          {
            field: 'email',
            crmValue: 'old@example.com',
            outlookValue: 'new@example.com',
          },
        ],
        conflictsResolved: 1,
      };

      mockMicrosoftContactsService.bidirectionalSync.mockResolvedValue(mockResult);

      const result = await controller.pushContactToOutlook(mockRequest, contactId, mockSyncConfig);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should create contact in Outlook if it does not exist', async () => {
      const mockResult = {
        success: true,
        action: 'CREATED_IN_OUTLOOK',
        externalId: 'new-outlook-id',
      };

      mockMicrosoftContactsService.bidirectionalSync.mockResolvedValue(mockResult);

      const result = await controller.pushContactToOutlook(mockRequest, contactId, mockSyncConfig);

      expect(result.action).toBe('CREATED_IN_OUTLOOK');
      expect(result.externalId).toBeDefined();
    });

    it('should handle manual review conflicts', async () => {
      const manualReviewConfig = {
        strategy: 'MANUAL_REVIEW' as const,
      };

      const mockResult = {
        success: false,
        requiresManualReview: true,
        conflicts: [
          {
            field: 'phone',
            crmValue: '+1234567890',
            outlookValue: '+0987654321',
          },
        ],
      };

      mockMicrosoftContactsService.bidirectionalSync.mockResolvedValue(mockResult);

      const result = await controller.pushContactToOutlook(
        mockRequest,
        contactId,
        manualReviewConfig,
      );

      expect(result.requiresManualReview).toBe(true);
    });

    it('should handle push failure', async () => {
      mockMicrosoftContactsService.bidirectionalSync.mockRejectedValue(
        new Error('Microsoft Graph API error'),
      );

      await expect(
        controller.pushContactToOutlook(mockRequest, contactId, mockSyncConfig),
      ).rejects.toThrow('Microsoft Graph API error');
    });
  });

  describe('POST /api/v1/integrations/microsoft/contacts/conflicts/resolve', () => {
    const mockConflicts = [
      {
        contactId: 'contact-1',
        field: 'email',
        crmValue: 'old@example.com',
        outlookValue: 'new@example.com',
      },
    ];

    const mockResolutionDto = {
      conflicts: mockConflicts,
      strategy: 'LAST_WRITE_WINS' as const,
    };

    it('should resolve conflicts using specified strategy', async () => {
      const mockResult = {
        resolved: [
          {
            contactId: 'contact-1',
            field: 'email',
            resolvedValue: 'new@example.com',
            strategy: 'LAST_WRITE_WINS',
          },
        ],
        success: true,
      };

      mockMicrosoftContactsService.resolveConflicts.mockResolvedValue(mockResult);

      const result = await controller.resolveConflicts(mockRequest, mockResolutionDto);

      expect(result).toEqual(mockResult);
      expect(service.resolveConflicts).toHaveBeenCalledWith(
        mockUser.userId,
        mockConflicts,
        'LAST_WRITE_WINS',
      );
    });

    it('should handle batch conflict resolution', async () => {
      const batchDto = {
        conflicts: [
          { contactId: 'contact-1', field: 'email' },
          { contactId: 'contact-2', field: 'phone' },
          { contactId: 'contact-3', field: 'company' },
        ],
        strategy: 'CRM_PRIORITY' as const,
      };

      mockMicrosoftContactsService.resolveConflicts.mockResolvedValue({
        resolved: batchDto.conflicts.map((c) => ({
          ...c,
          resolvedValue: 'resolved',
        })),
        success: true,
      });

      const result = await controller.resolveConflicts(mockRequest, batchDto);

      expect(result.resolved).toHaveLength(3);
    });

    it('should validate conflict resolution DTO', async () => {
      const invalidDto = {
        conflicts: 'not-an-array',
        strategy: 'INVALID_STRATEGY',
      };

      await expect(controller.resolveConflicts(mockRequest, invalidDto as any)).rejects.toThrow();
    });

    it('should handle resolution failures', async () => {
      mockMicrosoftContactsService.resolveConflicts.mockRejectedValue(
        new Error('Resolution failed'),
      );

      await expect(controller.resolveConflicts(mockRequest, mockResolutionDto)).rejects.toThrow(
        'Resolution failed',
      );
    });
  });

  describe('DELETE /api/v1/integrations/microsoft/disconnect', () => {
    it('should disconnect integration successfully', async () => {
      const mockDisconnectResult = {
        success: true,
        linksDeleted: 25,
        tokensRevoked: true,
        message: 'Microsoft 365 integration disconnected',
      };

      mockMicrosoftContactsService.disconnectIntegration.mockResolvedValue(mockDisconnectResult);

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result).toEqual(mockDisconnectResult);
      expect(service.disconnectIntegration).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should revoke OAuth tokens during disconnect', async () => {
      mockMicrosoftContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 10,
        tokensRevoked: true,
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.tokensRevoked).toBe(true);
    });

    it('should delete integration links during disconnect', async () => {
      mockMicrosoftContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 50,
        tokensRevoked: true,
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.linksDeleted).toBe(50);
    });

    it('should preserve imported contacts after disconnect', async () => {
      mockMicrosoftContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 25,
        tokensRevoked: true,
        contactsPreserved: true,
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.contactsPreserved).toBe(true);
    });

    it('should handle disconnect when no integration exists', async () => {
      mockMicrosoftContactsService.disconnectIntegration.mockRejectedValue(
        new BadRequestException('No Microsoft 365 integration found'),
      );

      await expect(controller.disconnectIntegration(mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle token revocation failure gracefully', async () => {
      mockMicrosoftContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 15,
        tokensRevoked: false,
        warning: 'Token revocation failed, but integration removed',
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.success).toBe(true);
      expect(result.tokensRevoked).toBe(false);
      expect(result).toHaveProperty('warning');
    });

    it('should handle complete disconnection failure', async () => {
      mockMicrosoftContactsService.disconnectIntegration.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.disconnectIntegration(mockRequest)).rejects.toThrow('Database error');
    });
  });

  describe('GET /api/v1/integrations/microsoft/status', () => {
    it('should return active integration status', async () => {
      const mockStatus = {
        isConnected: true,
        integrationId: 'integration-123',
        connectedAt: new Date('2024-01-01'),
        lastSyncAt: new Date('2024-01-15'),
        totalSyncedContacts: 150,
        isActive: true,
        bidirectionalEnabled: true,
      };

      mockMicrosoftContactsService.getIntegrationStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRequest);

      expect(result).toEqual(mockStatus);
      expect(result.isConnected).toBe(true);
      expect(result.totalSyncedContacts).toBe(150);
      expect(result.bidirectionalEnabled).toBe(true);
    });

    it('should return not connected status', async () => {
      const mockStatus = {
        isConnected: false,
        totalSyncedContacts: 0,
      };

      mockMicrosoftContactsService.getIntegrationStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRequest);

      expect(result.isConnected).toBe(false);
      expect(result.totalSyncedContacts).toBe(0);
    });

    it('should include last sync information', async () => {
      const lastSync = new Date('2024-01-15T10:30:00Z');

      mockMicrosoftContactsService.getIntegrationStatus.mockResolvedValue({
        isConnected: true,
        lastSyncAt: lastSync,
        totalSyncedContacts: 100,
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.lastSyncAt).toEqual(lastSync);
    });

    it('should handle inactive integration', async () => {
      mockMicrosoftContactsService.getIntegrationStatus.mockResolvedValue({
        isConnected: true,
        isActive: false,
        totalSyncedContacts: 50,
        deactivatedAt: new Date(),
        reason: 'Token expired',
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.isActive).toBe(false);
      expect(result).toHaveProperty('reason');
    });

    it('should include sync configuration details', async () => {
      mockMicrosoftContactsService.getIntegrationStatus.mockResolvedValue({
        isConnected: true,
        totalSyncedContacts: 100,
        syncConfig: {
          bidirectionalEnabled: true,
          conflictStrategy: 'LAST_WRITE_WINS',
          autoSyncInterval: 3600,
        },
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.syncConfig).toBeDefined();
      expect(result.syncConfig.bidirectionalEnabled).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle unauthenticated requests', async () => {
      const unauthRequest = { user: null };

      await expect(controller.initiateAuth(unauthRequest)).rejects.toThrow();
      await expect(controller.getImportPreview(unauthRequest)).rejects.toThrow();
      await expect(controller.importContacts(unauthRequest, {} as any)).rejects.toThrow();
      await expect(controller.syncContacts(unauthRequest, {} as any)).rejects.toThrow();
      await expect(controller.disconnectIntegration(unauthRequest)).rejects.toThrow();
    });

    it('should handle malformed request data', async () => {
      const malformedDto = {
        selectedContactIds: 'not-an-array', // Should be array
      };

      await expect(controller.importContacts(mockRequest, malformedDto as any)).rejects.toThrow();
    });

    it('should handle service timeouts', async () => {
      mockMicrosoftContactsService.fetchContacts.mockRejectedValue(new Error('Request timeout'));

      await expect(controller.getImportPreview(mockRequest)).rejects.toThrow('Request timeout');
    });
  });

  describe('Rate limiting', () => {
    it('should respect rate limits on API endpoints', async () => {
      const metadata = Reflect.getMetadata('rate-limit', controller.importContacts);

      expect(metadata).toBeDefined();
    });
  });

  describe('Input validation', () => {
    it('should validate category mapping structure', async () => {
      const dtoWithInvalidCategories = {
        skipDuplicates: true,
        categoryMapping: 'invalid-structure', // Should be object
      };

      await expect(
        controller.importContacts(mockRequest, dtoWithInvalidCategories as any),
      ).rejects.toThrow();
    });

    it('should validate sync configuration', async () => {
      const invalidSyncConfig = {
        strategy: 'INVALID_STRATEGY',
      };

      await expect(
        controller.syncContacts(mockRequest, invalidSyncConfig as any),
      ).rejects.toThrow();
    });
  });
});
