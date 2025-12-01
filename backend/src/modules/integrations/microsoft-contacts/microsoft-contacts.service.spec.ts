/**
 * Unit tests for MicrosoftContactsService
 * Test-Driven Development (RED phase)
 * Coverage target: 95%+
 *
 * US-011: Import contacts from Microsoft 365
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MicrosoftContactsService } from './microsoft-contacts.service';
import { PrismaService } from '../../../shared/database/prisma.service';
import { OAuthService } from '../shared/oauth.service';
import { DeduplicationService } from '../shared/deduplication.service';
import { GraphApiService } from './services/graph-api.service';
import { ConflictResolverService } from './services/conflict-resolver.service';

describe('MicrosoftContactsService (TDD - Unit)', () => {
  let service: MicrosoftContactsService;
  let prismaService: PrismaService;
  let oauthService: OAuthService;
  let deduplicationService: DeduplicationService;
  let graphApiService: GraphApiService;
  let conflictResolverService: ConflictResolverService;

  const mockPrismaService = {
    integration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    integrationLink: {
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockOAuthService = {
    generateAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeToken: jest.fn(),
    encryptToken: jest.fn(),
    decryptToken: jest.fn(),
  };

  const mockDeduplicationService = {
    findDuplicates: jest.fn(),
    calculateSimilarity: jest.fn(),
    mergeContacts: jest.fn(),
  };

  const mockGraphApiService = {
    getContacts: jest.fn(),
    getContact: jest.fn(),
    createContact: jest.fn(),
    updateContact: jest.fn(),
    deleteContact: jest.fn(),
    getDeltaContacts: jest.fn(),
    getFolderContacts: jest.fn(),
    getContactFolders: jest.fn(),
    batchGetContacts: jest.fn(),
  };

  const mockConflictResolverService = {
    resolveConflict: jest.fn(),
    detectConflicts: jest.fn(),
    applyStrategy: jest.fn(),
    prepareConflictReport: jest.fn(),
  };

  const mockUserId = 'user-123';
  const mockIntegrationId = 'integration-456';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MicrosoftContactsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OAuthService, useValue: mockOAuthService },
        { provide: DeduplicationService, useValue: mockDeduplicationService },
        { provide: GraphApiService, useValue: mockGraphApiService },
        { provide: ConflictResolverService, useValue: mockConflictResolverService },
      ],
    }).compile();

    service = module.get<MicrosoftContactsService>(MicrosoftContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
    oauthService = module.get<OAuthService>(OAuthService);
    deduplicationService = module.get<DeduplicationService>(DeduplicationService);
    graphApiService = module.get<GraphApiService>(GraphApiService);
    conflictResolverService = module.get<ConflictResolverService>(ConflictResolverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateOAuthFlow', () => {
    it('should generate OAuth URL with Microsoft Graph scopes', async () => {
      const expectedUrl =
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=test&scope=Contacts.Read';

      mockOAuthService.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = await service.initiateOAuthFlow(mockUserId);

      expect(result.authUrl).toBe(expectedUrl);
      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith({
        scopes: [
          'https://graph.microsoft.com/Contacts.Read',
          'https://graph.microsoft.com/Contacts.ReadWrite',
          'offline_access',
        ],
        userId: mockUserId,
        provider: 'microsoft',
      });
    });

    it('should include PKCE challenge for security', async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue('https://auth.url');

      await service.initiateOAuthFlow(mockUserId);

      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          usePKCE: true,
        }),
      );
    });

    it('should store state parameter for CSRF protection', async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue('https://auth.url');

      const result = await service.initiateOAuthFlow(mockUserId);

      expect(result).toHaveProperty('state');
      expect(result.state).toBeDefined();
    });

    it('should use correct Microsoft authority URL', async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue('https://auth.url');

      await service.initiateOAuthFlow(mockUserId);

      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          authority: 'https://login.microsoftonline.com/common',
        }),
      );
    });
  });

  describe('handleOAuthCallback', () => {
    const mockCode = 'auth-code-123';
    const mockState = 'state-456';

    it('should exchange code for access and refresh tokens', async () => {
      const mockTokens = {
        access_token: 'access-token-xyz',
        refresh_token: 'refresh-token-abc',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockOAuthService.encryptToken.mockImplementation((token) => `encrypted_${token}`);
      mockPrismaService.integration.create.mockResolvedValue({
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'MICROSOFT_CONTACTS',
      });

      const result = await service.handleOAuthCallback(mockUserId, mockCode, mockState);

      expect(mockOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith({
        code: mockCode,
        provider: 'microsoft',
      });
      expect(result.integrationId).toBe(mockIntegrationId);
      expect(result.success).toBe(true);
    });

    it('should encrypt tokens before storing in database', async () => {
      const mockTokens = {
        access_token: 'access-token-xyz',
        refresh_token: 'refresh-token-abc',
        expires_in: 3600,
      };

      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockOAuthService.encryptToken.mockImplementation((token) => `encrypted_${token}`);
      mockPrismaService.integration.create.mockResolvedValue({
        id: mockIntegrationId,
      });

      await service.handleOAuthCallback(mockUserId, mockCode, mockState);

      expect(mockOAuthService.encryptToken).toHaveBeenCalledWith(mockTokens.access_token);
      expect(mockOAuthService.encryptToken).toHaveBeenCalledWith(mockTokens.refresh_token);
      expect(mockPrismaService.integration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: 'encrypted_access-token-xyz',
            refreshToken: 'encrypted_refresh-token-abc',
          }),
        }),
      );
    });

    it('should validate state parameter to prevent CSRF', async () => {
      const invalidState = 'invalid-state';

      await expect(service.handleOAuthCallback(mockUserId, mockCode, invalidState)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnauthorizedException on token exchange failure', async () => {
      mockOAuthService.exchangeCodeForTokens.mockRejectedValue(new Error('Invalid code'));

      await expect(service.handleOAuthCallback(mockUserId, mockCode, mockState)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should calculate and store token expiration time', async () => {
      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      };

      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockOAuthService.encryptToken.mockImplementation((token) => `encrypted_${token}`);
      mockPrismaService.integration.create.mockResolvedValue({
        id: mockIntegrationId,
      });

      await service.handleOAuthCallback(mockUserId, mockCode, mockState);

      expect(mockPrismaService.integration.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: expect.any(Date),
          }),
        }),
      );

      const call = mockPrismaService.integration.create.mock.calls[0][0];
      const expiresAt = call.data.expiresAt;
      const expectedExpiry = Date.now() + 3600 * 1000;

      expect(Math.abs(expiresAt.getTime() - expectedExpiry)).toBeLessThan(1000);
    });
  });

  describe('fetchContacts', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'MICROSOFT_CONTACTS',
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
      isActive: true,
    };

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
    });

    it('should fetch contacts from Microsoft Graph API', async () => {
      const mockMsftContacts = {
        value: [
          {
            id: 'contact-1',
            givenName: 'John',
            surname: 'Doe',
            emailAddresses: [{ address: 'john@example.com' }],
            mobilePhone: '+1234567890',
          },
          {
            id: 'contact-2',
            givenName: 'Jane',
            surname: 'Smith',
            emailAddresses: [{ address: 'jane@example.com' }],
          },
        ],
        '@odata.count': 2,
      };

      mockGraphApiService.getContacts.mockResolvedValue(mockMsftContacts);

      const result = await service.fetchContacts(mockUserId);

      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0]).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        externalId: 'contact-1',
      });
      expect(result.totalCount).toBe(2);
    });

    it('should respect Microsoft Graph API rate limits', async () => {
      mockGraphApiService.getContacts.mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      });

      await expect(service.fetchContacts(mockUserId)).rejects.toThrow('Rate limit exceeded');
    });

    it('should refresh access token when expired', async () => {
      const expiredIntegration = {
        ...mockIntegration,
        expiresAt: new Date(Date.now() - 1000),
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(expiredIntegration);
      mockOAuthService.refreshAccessToken.mockResolvedValue({
        access_token: 'new-access-token',
        expires_in: 3600,
      });
      mockOAuthService.encryptToken.mockReturnValue('encrypted-new-token');
      mockGraphApiService.getContacts.mockResolvedValue({
        value: [],
        '@odata.count': 0,
      });

      await service.fetchContacts(mockUserId);

      expect(mockOAuthService.refreshAccessToken).toHaveBeenCalled();
      expect(mockPrismaService.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: 'encrypted-new-token',
          }),
        }),
      );
    });

    it('should handle contacts with multiple email addresses', async () => {
      const mockMsftContacts = {
        value: [
          {
            id: 'contact-1',
            givenName: 'John',
            surname: 'Doe',
            emailAddresses: [
              { address: 'john@work.com', name: 'Work' },
              { address: 'john@personal.com', name: 'Personal' },
            ],
          },
        ],
        '@odata.count': 1,
      };

      mockGraphApiService.getContacts.mockResolvedValue(mockMsftContacts);

      const result = await service.fetchContacts(mockUserId);

      expect(result.contacts[0].email).toBe('john@work.com');
      expect(result.contacts[0].metadata).toHaveProperty('alternateEmails');
      expect(result.contacts[0].metadata.alternateEmails).toContain('john@personal.com');
    });

    it('should handle pagination for large contact lists', async () => {
      const mockPage1 = {
        value: Array(100).fill({
          id: 'contact-1',
          givenName: 'Contact',
          surname: 'One',
        }),
        '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/contacts?$skip=100',
        '@odata.count': 250,
      };

      mockGraphApiService.getContacts.mockResolvedValue(mockPage1);

      const result = await service.fetchContacts(mockUserId, { pageSize: 100 });

      expect(result.contacts).toHaveLength(100);
      expect(result.nextPageToken).toBe('https://graph.microsoft.com/v1.0/me/contacts?$skip=100');
      expect(result.totalCount).toBe(250);
    });
  });

  describe('fetchSharedAddressBooks', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'MICROSOFT_CONTACTS',
      accessToken: 'encrypted-access-token',
      isActive: true,
    };

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
    });

    it('should fetch shared contact folders', async () => {
      const mockFolders = {
        value: [
          {
            id: 'folder-1',
            displayName: 'Team Contacts',
            parentFolderId: 'root',
          },
          {
            id: 'folder-2',
            displayName: 'Sales Team',
            parentFolderId: 'root',
          },
        ],
      };

      mockGraphApiService.getContactFolders.mockResolvedValue(mockFolders);

      const result = await service.fetchSharedAddressBooks(mockUserId);

      expect(result.folders).toHaveLength(2);
      expect(result.folders[0].name).toBe('Team Contacts');
      expect(result.folders[1].name).toBe('Sales Team');
    });

    it('should fetch contacts from specific shared folder', async () => {
      const mockFolderContacts = {
        value: [
          {
            id: 'contact-shared-1',
            givenName: 'Shared',
            surname: 'Contact',
            emailAddresses: [{ address: 'shared@example.com' }],
          },
        ],
        '@odata.count': 1,
      };

      mockGraphApiService.getFolderContacts.mockResolvedValue(mockFolderContacts);

      const result = await service.fetchSharedAddressBooks(mockUserId, {
        folderId: 'folder-1',
      });

      expect(result.contacts).toHaveLength(1);
      expect(result.contacts[0].email).toBe('shared@example.com');
    });

    it('should handle empty shared folders', async () => {
      mockGraphApiService.getContactFolders.mockResolvedValue({
        value: [],
      });

      const result = await service.fetchSharedAddressBooks(mockUserId);

      expect(result.folders).toHaveLength(0);
    });

    it('should handle permission errors for shared folders', async () => {
      mockGraphApiService.getContactFolders.mockRejectedValue({
        status: 403,
        message: 'Insufficient permissions',
      });

      await expect(service.fetchSharedAddressBooks(mockUserId)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('mapCategoriesToTags', () => {
    it('should map Outlook categories to CRM tags', () => {
      const contact = {
        id: 'contact-1',
        givenName: 'John',
        surname: 'Doe',
        categories: ['Red category', 'Blue category', 'Important'],
      };

      const categoryMapping = {
        'Red category': 'urgent',
        'Blue category': 'customer',
        Important: 'vip',
      };

      const result = service.mapCategoriesToTags(contact, categoryMapping);

      expect(result.tags).toContain('urgent');
      expect(result.tags).toContain('customer');
      expect(result.tags).toContain('vip');
    });

    it('should preserve original categories when mapping not provided', () => {
      const contact = {
        id: 'contact-1',
        givenName: 'John',
        surname: 'Doe',
        categories: ['Red category', 'Important'],
      };

      const result = service.mapCategoriesToTags(contact, {});

      expect(result.tags).toContain('Red category');
      expect(result.tags).toContain('Important');
    });

    it('should handle contacts without categories', () => {
      const contact = {
        id: 'contact-1',
        givenName: 'John',
        surname: 'Doe',
        categories: [],
      };

      const result = service.mapCategoriesToTags(contact, {});

      expect(result.tags).toEqual([]);
    });

    it('should handle mixed mapped and unmapped categories', () => {
      const contact = {
        id: 'contact-1',
        givenName: 'John',
        surname: 'Doe',
        categories: ['Red category', 'Unmapped', 'Blue category'],
      };

      const categoryMapping = {
        'Red category': 'urgent',
        'Blue category': 'customer',
      };

      const result = service.mapCategoriesToTags(contact, categoryMapping);

      expect(result.tags).toContain('urgent');
      expect(result.tags).toContain('customer');
      expect(result.tags).toContain('Unmapped'); // Preserves unmapped
    });
  });

  describe('bidirectionalSync', () => {
    const mockSyncConfig = {
      enabled: true,
      strategy: 'LAST_WRITE_WINS' as const,
      syncDirection: 'BIDIRECTIONAL' as const,
      conflictResolution: 'LAST_WRITE_WINS' as const,
    };

    it('should sync changes from CRM to Outlook', async () => {
      const mockContact = {
        id: 'crm-contact-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        updatedAt: new Date(),
      };

      const mockIntegrationLink = {
        externalId: 'outlook-contact-1',
        integrationId: mockIntegrationId,
      };

      mockPrismaService.contact.findUnique.mockResolvedValue(mockContact);
      mockPrismaService.integrationLink.findMany.mockResolvedValue([mockIntegrationLink]);
      mockGraphApiService.updateContact.mockResolvedValue({
        id: 'outlook-contact-1',
        givenName: 'John',
        surname: 'Doe',
      });

      const result = await service.bidirectionalSync(mockUserId, 'crm-contact-1', mockSyncConfig);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('CRM_TO_OUTLOOK');
      expect(mockGraphApiService.updateContact).toHaveBeenCalledWith(
        expect.any(String),
        'outlook-contact-1',
        expect.objectContaining({
          givenName: 'John',
          surname: 'Doe',
        }),
      );
    });

    it('should sync changes from Outlook to CRM', async () => {
      const mockOutlookContact = {
        id: 'outlook-contact-1',
        givenName: 'Jane',
        surname: 'Smith',
        emailAddresses: [{ address: 'jane@example.com' }],
        lastModifiedDateTime: new Date().toISOString(),
      };

      const mockCrmContact = {
        id: 'crm-contact-1',
        firstName: 'Jane',
        lastName: 'Smith-Old',
        email: 'jane@example.com',
        updatedAt: new Date(Date.now() - 10000),
      };

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { contactId: 'crm-contact-1', externalId: 'outlook-contact-1' },
      ]);
      mockGraphApiService.getContact.mockResolvedValue(mockOutlookContact);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockCrmContact);
      mockPrismaService.contact.update.mockResolvedValue({
        ...mockCrmContact,
        lastName: 'Smith',
      });

      const result = await service.bidirectionalSync(mockUserId, 'crm-contact-1', mockSyncConfig);

      expect(result.success).toBe(true);
      expect(result.direction).toBe('OUTLOOK_TO_CRM');
      expect(mockPrismaService.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'crm-contact-1' },
          data: expect.objectContaining({
            lastName: 'Smith',
          }),
        }),
      );
    });

    it('should detect conflicts when both sides changed', async () => {
      const recentTime = new Date();
      const mockOutlookContact = {
        id: 'outlook-contact-1',
        givenName: 'John',
        surname: 'Doe-Outlook',
        lastModifiedDateTime: recentTime.toISOString(),
      };

      const mockCrmContact = {
        id: 'crm-contact-1',
        firstName: 'John',
        lastName: 'Doe-CRM',
        updatedAt: recentTime,
      };

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { contactId: 'crm-contact-1', externalId: 'outlook-contact-1' },
      ]);
      mockGraphApiService.getContact.mockResolvedValue(mockOutlookContact);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockCrmContact);
      mockConflictResolverService.detectConflicts.mockResolvedValue([
        {
          field: 'lastName',
          crmValue: 'Doe-CRM',
          outlookValue: 'Doe-Outlook',
          conflictType: 'VALUE_MISMATCH',
        },
      ]);

      const result = await service.bidirectionalSync(mockUserId, 'crm-contact-1', mockSyncConfig);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts).toHaveLength(1);
      expect(mockConflictResolverService.detectConflicts).toHaveBeenCalled();
    });

    it('should apply LAST_WRITE_WINS strategy on conflict', async () => {
      const olderTime = new Date(Date.now() - 10000);
      const newerTime = new Date();

      const mockOutlookContact = {
        id: 'outlook-contact-1',
        givenName: 'John',
        surname: 'Doe-Outlook',
        lastModifiedDateTime: newerTime.toISOString(),
      };

      const mockCrmContact = {
        id: 'crm-contact-1',
        firstName: 'John',
        lastName: 'Doe-CRM',
        updatedAt: olderTime,
      };

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { contactId: 'crm-contact-1', externalId: 'outlook-contact-1' },
      ]);
      mockGraphApiService.getContact.mockResolvedValue(mockOutlookContact);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockCrmContact);
      mockConflictResolverService.detectConflicts.mockResolvedValue([
        {
          field: 'lastName',
          crmValue: 'Doe-CRM',
          outlookValue: 'Doe-Outlook',
        },
      ]);
      mockConflictResolverService.applyStrategy.mockResolvedValue({
        resolvedValue: 'Doe-Outlook',
        appliedStrategy: 'LAST_WRITE_WINS',
      });
      mockPrismaService.contact.update.mockResolvedValue({
        ...mockCrmContact,
        lastName: 'Doe-Outlook',
      });

      const result = await service.bidirectionalSync(mockUserId, 'crm-contact-1', mockSyncConfig);

      expect(mockConflictResolverService.applyStrategy).toHaveBeenCalledWith(
        expect.anything(),
        'LAST_WRITE_WINS',
      );
      expect(result.conflictsResolved).toBe(1);
    });

    it('should apply CRM_PRIORITY strategy on conflict', async () => {
      const crmPriorityConfig = {
        ...mockSyncConfig,
        conflictResolution: 'CRM_PRIORITY' as const,
      };

      const mockOutlookContact = {
        id: 'outlook-contact-1',
        givenName: 'John',
        surname: 'Doe-Outlook',
      };

      const mockCrmContact = {
        id: 'crm-contact-1',
        firstName: 'John',
        lastName: 'Doe-CRM',
      };

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { contactId: 'crm-contact-1', externalId: 'outlook-contact-1' },
      ]);
      mockGraphApiService.getContact.mockResolvedValue(mockOutlookContact);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockCrmContact);
      mockConflictResolverService.detectConflicts.mockResolvedValue([
        {
          field: 'lastName',
          crmValue: 'Doe-CRM',
          outlookValue: 'Doe-Outlook',
        },
      ]);
      mockConflictResolverService.applyStrategy.mockResolvedValue({
        resolvedValue: 'Doe-CRM',
        appliedStrategy: 'CRM_PRIORITY',
      });
      mockGraphApiService.updateContact.mockResolvedValue({});

      await service.bidirectionalSync(mockUserId, 'crm-contact-1', crmPriorityConfig);

      expect(mockConflictResolverService.applyStrategy).toHaveBeenCalledWith(
        expect.anything(),
        'CRM_PRIORITY',
      );
      expect(mockGraphApiService.updateContact).toHaveBeenCalled();
    });

    it('should queue conflict for manual review when strategy is MANUAL_REVIEW', async () => {
      const manualReviewConfig = {
        ...mockSyncConfig,
        conflictResolution: 'MANUAL_REVIEW' as const,
      };

      const mockOutlookContact = {
        id: 'outlook-contact-1',
        givenName: 'John',
        surname: 'Doe-Outlook',
      };

      const mockCrmContact = {
        id: 'crm-contact-1',
        firstName: 'John',
        lastName: 'Doe-CRM',
      };

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { contactId: 'crm-contact-1', externalId: 'outlook-contact-1' },
      ]);
      mockGraphApiService.getContact.mockResolvedValue(mockOutlookContact);
      mockPrismaService.contact.findUnique.mockResolvedValue(mockCrmContact);
      mockConflictResolverService.detectConflicts.mockResolvedValue([
        {
          field: 'lastName',
          crmValue: 'Doe-CRM',
          outlookValue: 'Doe-Outlook',
        },
      ]);
      mockConflictResolverService.prepareConflictReport.mockResolvedValue({
        contactId: 'crm-contact-1',
        conflicts: [{ field: 'lastName' }],
        status: 'PENDING_REVIEW',
      });

      const result = await service.bidirectionalSync(
        mockUserId,
        'crm-contact-1',
        manualReviewConfig,
      );

      expect(result.requiresManualReview).toBe(true);
      expect(mockConflictResolverService.prepareConflictReport).toHaveBeenCalled();
    });

    it('should handle sync when contact does not exist in Outlook', async () => {
      const mockCrmContact = {
        id: 'crm-contact-1',
        firstName: 'New',
        lastName: 'Contact',
        email: 'new@example.com',
      };

      mockPrismaService.contact.findUnique.mockResolvedValue(mockCrmContact);
      mockPrismaService.integrationLink.findMany.mockResolvedValue([]);
      mockGraphApiService.createContact.mockResolvedValue({
        id: 'new-outlook-contact',
        givenName: 'New',
        surname: 'Contact',
      });
      mockPrismaService.integrationLink.create.mockResolvedValue({});

      const result = await service.bidirectionalSync(mockUserId, 'crm-contact-1', mockSyncConfig);

      expect(result.success).toBe(true);
      expect(result.action).toBe('CREATED_IN_OUTLOOK');
      expect(mockGraphApiService.createContact).toHaveBeenCalled();
      expect(mockPrismaService.integrationLink.create).toHaveBeenCalled();
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve conflicts using specified strategy', async () => {
      const conflicts = [
        {
          contactId: 'contact-1',
          field: 'email',
          crmValue: 'old@example.com',
          outlookValue: 'new@example.com',
        },
      ];

      mockConflictResolverService.resolveConflict.mockResolvedValue({
        contactId: 'contact-1',
        field: 'email',
        resolvedValue: 'new@example.com',
        strategy: 'LAST_WRITE_WINS',
      });

      const result = await service.resolveConflicts(mockUserId, conflicts, 'LAST_WRITE_WINS');

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].resolvedValue).toBe('new@example.com');
    });

    it('should batch process multiple conflicts', async () => {
      const conflicts = [
        { contactId: 'contact-1', field: 'email' },
        { contactId: 'contact-2', field: 'phone' },
        { contactId: 'contact-3', field: 'company' },
      ];

      mockConflictResolverService.resolveConflict.mockResolvedValue({
        resolvedValue: 'resolved',
      });

      const result = await service.resolveConflicts(mockUserId, conflicts, 'CRM_PRIORITY');

      expect(result.resolved).toHaveLength(3);
      expect(mockConflictResolverService.resolveConflict).toHaveBeenCalledTimes(3);
    });

    it('should handle resolution failures gracefully', async () => {
      const conflicts = [{ contactId: 'contact-1', field: 'email' }];

      mockConflictResolverService.resolveConflict.mockRejectedValue(new Error('Resolution failed'));

      await expect(
        service.resolveConflicts(mockUserId, conflicts, 'LAST_WRITE_WINS'),
      ).rejects.toThrow('Resolution failed');
    });
  });

  describe('incrementalSync (Delta Queries)', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'MICROSOFT_CONTACTS',
      accessToken: 'encrypted-access-token',
      metadata: {
        deltaLink: 'https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=xyz',
      },
    };

    it('should use deltaLink for incremental sync', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('access-token');

      const mockDeltaResponse = {
        value: [],
        '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=abc',
      };

      mockGraphApiService.getDeltaContacts.mockResolvedValue(mockDeltaResponse);

      await service.incrementalSync(mockUserId);

      expect(mockGraphApiService.getDeltaContacts).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          deltaLink: mockIntegration.metadata.deltaLink,
        }),
      );
    });

    it('should update deltaLink after successful sync', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('access-token');

      const newDeltaLink = 'https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=new';
      mockGraphApiService.getDeltaContacts.mockResolvedValue({
        value: [],
        '@odata.deltaLink': newDeltaLink,
      });

      await service.incrementalSync(mockUserId);

      expect(mockPrismaService.integration.update).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        data: {
          metadata: expect.objectContaining({
            deltaLink: newDeltaLink,
          }),
        },
      });
    });

    it('should detect new contacts since last sync', async () => {
      const mockNewContacts = [
        {
          id: 'new-contact-1',
          givenName: 'New',
          surname: 'Contact',
          emailAddresses: [{ address: 'new@example.com' }],
        },
      ];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('access-token');
      mockGraphApiService.getDeltaContacts.mockResolvedValue({
        value: mockNewContacts,
        '@odata.deltaLink': 'new-delta-link',
      });
      mockPrismaService.integrationLink.findMany.mockResolvedValue([]);
      mockPrismaService.contact.create.mockResolvedValue({});
      mockPrismaService.integrationLink.create.mockResolvedValue({});

      const result = await service.incrementalSync(mockUserId);

      expect(result.added).toBe(1);
      expect(mockPrismaService.contact.create).toHaveBeenCalled();
    });

    it('should detect updated contacts since last sync', async () => {
      const mockUpdatedContacts = [
        {
          id: 'existing-contact-1',
          givenName: 'Updated',
          surname: 'Name',
          emailAddresses: [{ address: 'updated@example.com' }],
        },
      ];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('access-token');
      mockGraphApiService.getDeltaContacts.mockResolvedValue({
        value: mockUpdatedContacts,
        '@odata.deltaLink': 'new-delta-link',
      });
      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        {
          id: 'link-1',
          externalId: 'existing-contact-1',
          contactId: 'crm-contact-1',
        },
      ]);
      mockPrismaService.contact.update.mockResolvedValue({});

      const result = await service.incrementalSync(mockUserId);

      expect(result.updated).toBe(1);
      expect(mockPrismaService.contact.update).toHaveBeenCalled();
    });

    it('should detect deleted contacts (removed property)', async () => {
      const mockDeletedContacts = [
        {
          id: 'deleted-contact-1',
          '@removed': {
            reason: 'deleted',
          },
        },
      ];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('access-token');
      mockGraphApiService.getDeltaContacts.mockResolvedValue({
        value: mockDeletedContacts,
        '@odata.deltaLink': 'new-delta-link',
      });
      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { externalId: 'deleted-contact-1', contactId: 'crm-contact-1' },
      ]);
      mockPrismaService.contact.update.mockResolvedValue({});

      const result = await service.incrementalSync(mockUserId);

      expect(result.deleted).toBe(1);
    });

    it('should perform initial sync if no deltaLink exists', async () => {
      const integrationWithoutDelta = {
        ...mockIntegration,
        metadata: {},
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(integrationWithoutDelta);
      mockOAuthService.decryptToken.mockReturnValue('access-token');
      mockGraphApiService.getDeltaContacts.mockResolvedValue({
        value: [],
        '@odata.deltaLink': 'initial-delta-link',
      });

      await service.incrementalSync(mockUserId);

      expect(mockGraphApiService.getDeltaContacts).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          deltaLink: undefined,
        }),
      );
    });

    it('should handle delta query pagination', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('access-token');

      const page1 = {
        value: Array(100).fill({ id: 'contact-1', givenName: 'John' }),
        '@odata.nextLink': 'next-page-url',
      };

      const page2 = {
        value: Array(50).fill({ id: 'contact-2', givenName: 'Jane' }),
        '@odata.deltaLink': 'final-delta-link',
      };

      mockGraphApiService.getDeltaContacts
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce(page2);

      mockPrismaService.integrationLink.findMany.mockResolvedValue([]);
      mockPrismaService.contact.create.mockResolvedValue({});
      mockPrismaService.integrationLink.create.mockResolvedValue({});

      const result = await service.incrementalSync(mockUserId);

      expect(result.added).toBe(150);
      expect(mockGraphApiService.getDeltaContacts).toHaveBeenCalledTimes(2);
    });
  });

  describe('disconnectIntegration', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'MICROSOFT_CONTACTS',
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
    };

    it('should revoke OAuth tokens', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.deleteMany.mockResolvedValue({ count: 0 });

      await service.disconnectIntegration(mockUserId);

      expect(mockOAuthService.revokeToken).toHaveBeenCalledWith('access-token', 'microsoft');
    });

    it('should delete integration from database', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.deleteMany.mockResolvedValue({ count: 0 });

      await service.disconnectIntegration(mockUserId);

      expect(mockPrismaService.integration.delete).toHaveBeenCalledWith({
        where: {
          userId_type: {
            userId: mockUserId,
            type: 'MICROSOFT_CONTACTS',
          },
        },
      });
    });

    it('should delete all integration links', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.deleteMany.mockResolvedValue({
        count: 10,
      });

      const result = await service.disconnectIntegration(mockUserId);

      expect(mockPrismaService.integrationLink.deleteMany).toHaveBeenCalledWith({
        where: { integrationId: mockIntegrationId },
      });
      expect(result.linksDeleted).toBe(10);
    });

    it('should NOT delete imported contacts (preserve data)', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.deleteMany.mockResolvedValue({ count: 0 });

      await service.disconnectIntegration(mockUserId);

      expect(mockPrismaService.contact.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle revocation failure gracefully', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
      mockOAuthService.revokeToken.mockRejectedValue(new Error('Revocation failed'));
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.deleteMany.mockResolvedValue({ count: 0 });

      await service.disconnectIntegration(mockUserId);

      expect(mockPrismaService.integration.delete).toHaveBeenCalled();
    });

    it('should throw error if integration not found', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      await expect(service.disconnectIntegration(mockUserId)).rejects.toThrow();
    });
  });

  describe('getIntegrationStatus', () => {
    it('should return active integration status', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'MICROSOFT_CONTACTS',
        isActive: true,
        createdAt: new Date(),
        metadata: {
          deltaLink: 'delta-link-123',
          lastSyncAt: new Date(),
        },
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.findMany.mockResolvedValue(Array(25).fill({}));

      const result = await service.getIntegrationStatus(mockUserId);

      expect(result.isConnected).toBe(true);
      expect(result.totalSyncedContacts).toBe(25);
      expect(result.lastSyncAt).toBeDefined();
    });

    it('should return not connected if no integration exists', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      const result = await service.getIntegrationStatus(mockUserId);

      expect(result.isConnected).toBe(false);
      expect(result.totalSyncedContacts).toBe(0);
    });
  });
});
