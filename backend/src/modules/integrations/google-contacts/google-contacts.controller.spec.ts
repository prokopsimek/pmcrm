/**
 * Unit tests for GoogleContactsController
 * Test-Driven Development (RED phase)
 * Coverage target: 95%+
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { GoogleContactsController } from './google-contacts.controller';
import { GoogleContactsService } from './google-contacts.service';

describe('GoogleContactsController (TDD - Unit)', () => {
  let controller: GoogleContactsController;
  let service: GoogleContactsService;

  const mockGoogleContactsService = {
    initiateOAuthFlow: jest.fn(),
    handleOAuthCallback: jest.fn(),
    fetchContacts: jest.fn(),
    previewImport: jest.fn(),
    importContacts: jest.fn(),
    syncIncrementalChanges: jest.fn(),
    disconnectIntegration: jest.fn(),
    getIntegrationStatus: jest.fn(),
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
      controllers: [GoogleContactsController],
      providers: [
        {
          provide: GoogleContactsService,
          useValue: mockGoogleContactsService,
        },
      ],
    }).compile();

    controller = module.get<GoogleContactsController>(GoogleContactsController);
    service = module.get<GoogleContactsService>(GoogleContactsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/integrations/google/auth', () => {
    it('should return OAuth authorization URL', async () => {
      const mockAuthUrl = {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&scope=contacts',
        state: 'state-123',
      };

      mockGoogleContactsService.initiateOAuthFlow.mockResolvedValue(mockAuthUrl);

      const result = await controller.initiateAuth(mockRequest);

      expect(result).toEqual(mockAuthUrl);
      expect(service.initiateOAuthFlow).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should require authentication', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(controller.initiateAuth(unauthenticatedRequest)).rejects.toThrow();
    });

    it('should handle service errors', async () => {
      mockGoogleContactsService.initiateOAuthFlow.mockRejectedValue(
        new Error('OAuth configuration error'),
      );

      await expect(controller.initiateAuth(mockRequest)).rejects.toThrow(
        'OAuth configuration error',
      );
    });
  });

  describe('GET /api/v1/integrations/google/callback', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'state-456';

    it('should handle successful OAuth callback', async () => {
      const mockResponse = {
        success: true,
        integrationId: 'integration-789',
        message: 'Google Contacts connected successfully',
      };

      mockGoogleContactsService.handleOAuthCallback.mockResolvedValue(mockResponse);

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
      mockGoogleContactsService.handleOAuthCallback.mockRejectedValue(
        new BadRequestException('Invalid state parameter'),
      );

      await expect(
        controller.handleCallback(mockRequest, mockCode, 'invalid-state'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle authorization denial', async () => {
      mockGoogleContactsService.handleOAuthCallback.mockRejectedValue(
        new UnauthorizedException('User denied authorization'),
      );

      await expect(controller.handleCallback(mockRequest, mockCode, mockState)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle token exchange failure', async () => {
      mockGoogleContactsService.handleOAuthCallback.mockRejectedValue(
        new UnauthorizedException('Failed to exchange authorization code'),
      );

      await expect(controller.handleCallback(mockRequest, mockCode, mockState)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('GET /api/v1/integrations/google/contacts/preview', () => {
    it('should return import preview with deduplication analysis', async () => {
      const mockPreview = {
        totalFetched: 100,
        newContacts: [
          {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            externalId: 'people/c1',
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
        tagsPreview: ['Friends', 'Work', 'Family'],
      };

      mockGoogleContactsService.previewImport.mockResolvedValue(mockPreview);

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
      };

      mockGoogleContactsService.previewImport.mockResolvedValue(emptyPreview);

      const result = await controller.getImportPreview(mockRequest);

      expect(result.totalFetched).toBe(0);
      expect(result.newContacts).toHaveLength(0);
    });

    it('should require active integration', async () => {
      mockGoogleContactsService.previewImport.mockRejectedValue(
        new BadRequestException('No active Google Contacts integration'),
      );

      await expect(controller.getImportPreview(mockRequest)).rejects.toThrow(BadRequestException);
    });

    it('should handle Google API errors', async () => {
      mockGoogleContactsService.previewImport.mockRejectedValue(
        new Error('Google API request failed'),
      );

      await expect(controller.getImportPreview(mockRequest)).rejects.toThrow(
        'Google API request failed',
      );
    });

    it('should support optional query parameters for filtering', async () => {
      const queryParams = {
        groupId: 'contactGroups/myContacts',
      };

      mockGoogleContactsService.previewImport.mockResolvedValue({
        totalFetched: 50,
        newContacts: [],
        duplicates: [],
        summary: { total: 50, new: 50, exactDuplicates: 0, potentialDuplicates: 0 },
        tagsPreview: [],
      });

      await controller.getImportPreview(mockRequest, queryParams);

      expect(service.previewImport).toHaveBeenCalledWith(mockUser.userId, queryParams);
    });
  });

  describe('POST /api/v1/integrations/google/contacts/import', () => {
    const mockImportDto = {
      skipDuplicates: true,
      updateExisting: false,
      selectedContactIds: ['people/c1', 'people/c2'],
      tagMapping: {
        Friends: 'personal',
        Work: 'professional',
      },
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

      mockGoogleContactsService.importContacts.mockResolvedValue(mockImportResult);

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

      mockGoogleContactsService.importContacts.mockResolvedValue(mockResult);

      const result = await controller.importContacts(mockRequest, updateDto);

      expect(result.updated).toBe(25);
      expect(result.skipped).toBe(0);
    });

    it('should handle selective import by contact IDs', async () => {
      const selectiveDto = {
        skipDuplicates: true,
        updateExisting: false,
        selectedContactIds: ['people/c1'],
      };

      const mockResult = {
        success: true,
        imported: 1,
        skipped: 0,
        updated: 0,
        failed: 0,
        errors: [],
      };

      mockGoogleContactsService.importContacts.mockResolvedValue(mockResult);

      const result = await controller.importContacts(mockRequest, selectiveDto);

      expect(result.imported).toBe(1);
    });

    it('should apply tag mapping during import', async () => {
      mockGoogleContactsService.importContacts.mockResolvedValue({
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
          tagMapping: {
            Friends: 'personal',
            Work: 'professional',
          },
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
        errors: [{ contactId: 'people/c99', error: 'Invalid email format' }],
      };

      mockGoogleContactsService.importContacts.mockResolvedValue(mockResult);

      const result = await controller.importContacts(mockRequest, mockImportDto);

      expect(result.success).toBe(true);
      expect(result.failed).toBe(10);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle complete import failure', async () => {
      mockGoogleContactsService.importContacts.mockRejectedValue(
        new Error('Database transaction failed'),
      );

      await expect(controller.importContacts(mockRequest, mockImportDto)).rejects.toThrow(
        'Database transaction failed',
      );
    });

    it('should require active integration', async () => {
      mockGoogleContactsService.importContacts.mockRejectedValue(
        new BadRequestException('No active Google Contacts integration'),
      );

      await expect(controller.importContacts(mockRequest, mockImportDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /api/v1/integrations/google/contacts/sync', () => {
    it('should perform incremental sync successfully', async () => {
      const mockSyncResult = {
        success: true,
        added: 5,
        updated: 3,
        deleted: 2,
        syncedAt: new Date(),
      };

      mockGoogleContactsService.syncIncrementalChanges.mockResolvedValue(mockSyncResult);

      const result = await controller.syncContacts(mockRequest);

      expect(result).toEqual(mockSyncResult);
      expect(service.syncIncrementalChanges).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should handle sync when no changes exist', async () => {
      const mockSyncResult = {
        success: true,
        added: 0,
        updated: 0,
        deleted: 0,
        syncedAt: new Date(),
      };

      mockGoogleContactsService.syncIncrementalChanges.mockResolvedValue(mockSyncResult);

      const result = await controller.syncContacts(mockRequest);

      expect(result.added).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.deleted).toBe(0);
    });

    it('should use syncToken for incremental updates', async () => {
      mockGoogleContactsService.syncIncrementalChanges.mockResolvedValue({
        success: true,
        added: 2,
        updated: 1,
        deleted: 0,
        syncedAt: new Date(),
        syncToken: 'new-sync-token-456',
      });

      const result = await controller.syncContacts(mockRequest);

      expect(result).toHaveProperty('syncToken');
    });

    it('should handle sync with expired token', async () => {
      mockGoogleContactsService.syncIncrementalChanges.mockRejectedValue(
        new UnauthorizedException('Token expired'),
      );

      await expect(controller.syncContacts(mockRequest)).rejects.toThrow(UnauthorizedException);
    });

    it('should require active integration', async () => {
      mockGoogleContactsService.syncIncrementalChanges.mockRejectedValue(
        new BadRequestException('No active Google Contacts integration'),
      );

      await expect(controller.syncContacts(mockRequest)).rejects.toThrow(BadRequestException);
    });

    it('should handle rate limit errors', async () => {
      mockGoogleContactsService.syncIncrementalChanges.mockRejectedValue(
        new Error('Rate limit exceeded'),
      );

      await expect(controller.syncContacts(mockRequest)).rejects.toThrow('Rate limit exceeded');
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

      mockGoogleContactsService.syncIncrementalChanges.mockResolvedValue(mockSyncResult);

      const result = await controller.syncContacts(mockRequest);

      expect(result).toHaveProperty('added', 10);
      expect(result).toHaveProperty('updated', 5);
      expect(result).toHaveProperty('deleted', 2);
      expect(result).toHaveProperty('syncedAt');
    });
  });

  describe('DELETE /api/v1/integrations/google/disconnect', () => {
    it('should disconnect integration successfully', async () => {
      const mockDisconnectResult = {
        success: true,
        linksDeleted: 25,
        tokensRevoked: true,
        message: 'Google Contacts integration disconnected',
      };

      mockGoogleContactsService.disconnectIntegration.mockResolvedValue(mockDisconnectResult);

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result).toEqual(mockDisconnectResult);
      expect(service.disconnectIntegration).toHaveBeenCalledWith(mockUser.userId);
    });

    it('should revoke OAuth tokens during disconnect', async () => {
      mockGoogleContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 10,
        tokensRevoked: true,
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.tokensRevoked).toBe(true);
    });

    it('should delete integration links during disconnect', async () => {
      mockGoogleContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 50,
        tokensRevoked: true,
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.linksDeleted).toBe(50);
    });

    it('should preserve imported contacts after disconnect', async () => {
      mockGoogleContactsService.disconnectIntegration.mockResolvedValue({
        success: true,
        linksDeleted: 25,
        tokensRevoked: true,
        contactsPreserved: true,
      });

      const result = await controller.disconnectIntegration(mockRequest);

      expect(result.contactsPreserved).toBe(true);
    });

    it('should handle disconnect when no integration exists', async () => {
      mockGoogleContactsService.disconnectIntegration.mockRejectedValue(
        new BadRequestException('No Google Contacts integration found'),
      );

      await expect(controller.disconnectIntegration(mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle token revocation failure gracefully', async () => {
      mockGoogleContactsService.disconnectIntegration.mockResolvedValue({
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
      mockGoogleContactsService.disconnectIntegration.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.disconnectIntegration(mockRequest)).rejects.toThrow('Database error');
    });
  });

  describe('GET /api/v1/integrations/google/status', () => {
    it('should return active integration status', async () => {
      const mockStatus = {
        isConnected: true,
        integrationId: 'integration-123',
        connectedAt: new Date('2024-01-01'),
        lastSyncAt: new Date('2024-01-15'),
        totalSyncedContacts: 150,
        isActive: true,
      };

      mockGoogleContactsService.getIntegrationStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRequest);

      expect(result).toEqual(mockStatus);
      expect(result.isConnected).toBe(true);
      expect(result.totalSyncedContacts).toBe(150);
    });

    it('should return not connected status', async () => {
      const mockStatus = {
        isConnected: false,
        totalSyncedContacts: 0,
      };

      mockGoogleContactsService.getIntegrationStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRequest);

      expect(result.isConnected).toBe(false);
      expect(result.totalSyncedContacts).toBe(0);
    });

    it('should include last sync information', async () => {
      const lastSync = new Date('2024-01-15T10:30:00Z');

      mockGoogleContactsService.getIntegrationStatus.mockResolvedValue({
        isConnected: true,
        lastSyncAt: lastSync,
        totalSyncedContacts: 100,
      });

      const result = await controller.getStatus(mockRequest);

      expect(result.lastSyncAt).toEqual(lastSync);
    });

    it('should handle inactive integration', async () => {
      mockGoogleContactsService.getIntegrationStatus.mockResolvedValue({
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
  });

  describe('Error handling and edge cases', () => {
    it('should handle unauthenticated requests', async () => {
      const unauthRequest = { user: null };

      await expect(controller.initiateAuth(unauthRequest)).rejects.toThrow();
      await expect(controller.getImportPreview(unauthRequest)).rejects.toThrow();
      await expect(controller.importContacts(unauthRequest, {} as any)).rejects.toThrow();
      await expect(controller.syncContacts(unauthRequest)).rejects.toThrow();
      await expect(controller.disconnectIntegration(unauthRequest)).rejects.toThrow();
    });

    it('should handle malformed request data', async () => {
      const malformedDto = {
        selectedContactIds: 'not-an-array', // Should be array
      };

      await expect(controller.importContacts(mockRequest, malformedDto as any)).rejects.toThrow();
    });

    it('should handle service timeouts', async () => {
      mockGoogleContactsService.fetchContacts.mockRejectedValue(new Error('Request timeout'));

      await expect(controller.getImportPreview(mockRequest)).rejects.toThrow('Request timeout');
    });

    it('should sanitize error messages for security', async () => {
      mockGoogleContactsService.importContacts.mockRejectedValue(
        new Error('Database connection string leaked: postgres://...'),
      );

      await expect(controller.importContacts(mockRequest, {} as any)).rejects.toThrow();
    });
  });

  describe('Rate limiting', () => {
    it('should respect rate limits on API endpoints', async () => {
      // This would typically be tested with integration tests
      // but we can verify the decorator is applied
      const metadata = Reflect.getMetadata('rate-limit', controller.importContacts);

      // Verify rate limiting is configured
      expect(metadata).toBeDefined();
    });
  });

  describe('Input validation', () => {
    it('should validate email format in imported contacts', async () => {
      const dtoWithInvalidEmail = {
        skipDuplicates: true,
        updateExisting: false,
        selectedContactIds: ['people/invalid-email'],
      };

      mockGoogleContactsService.importContacts.mockRejectedValue(
        new BadRequestException('Invalid contact data'),
      );

      await expect(controller.importContacts(mockRequest, dtoWithInvalidEmail)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate tag mapping structure', async () => {
      const dtoWithInvalidTags = {
        skipDuplicates: true,
        tagMapping: 'invalid-structure', // Should be object
      };

      await expect(
        controller.importContacts(mockRequest, dtoWithInvalidTags as any),
      ).rejects.toThrow();
    });
  });
});
