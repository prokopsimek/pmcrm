/**
 * Unit tests for GoogleContactsService
 * Test-Driven Development (RED phase)
 * Coverage target: 95%+
 */
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/database/prisma.service';
import { DeduplicationService } from '../shared/deduplication.service';
import { OAuthService } from '../shared/oauth.service';
import { GoogleContactsService } from './google-contacts.service';

describe('GoogleContactsService (TDD - Unit)', () => {
  let service: GoogleContactsService;
  let prismaService: PrismaService;
  let oauthService: OAuthService;
  let deduplicationService: DeduplicationService;

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

  const mockUserId = 'user-123';
  const mockIntegrationId = 'integration-456';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleContactsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OAuthService, useValue: mockOAuthService },
        { provide: DeduplicationService, useValue: mockDeduplicationService },
      ],
    }).compile();

    service = module.get<GoogleContactsService>(GoogleContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
    oauthService = module.get<OAuthService>(OAuthService);
    deduplicationService = module.get<DeduplicationService>(DeduplicationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiateOAuthFlow', () => {
    it('should generate OAuth URL with correct scopes', async () => {
      const expectedUrl =
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=test&scope=contacts.readonly&redirect_uri=callback&state=state123';

      mockOAuthService.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = await service.initiateOAuthFlow(mockUserId);

      expect(result.authUrl).toBe(expectedUrl);
      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith({
        scopes: [
          'https://www.googleapis.com/auth/contacts.readonly',
          'https://www.googleapis.com/auth/contacts.other.readonly',
        ],
        userId: mockUserId,
        provider: 'google',
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
        type: 'GOOGLE_CONTACTS',
      });

      const result = await service.handleOAuthCallback(mockUserId, mockCode, mockState);

      expect(mockOAuthService.exchangeCodeForTokens).toHaveBeenCalledWith({
        code: mockCode,
        provider: 'google',
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
      type: 'GOOGLE_CONTACTS',
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
      isActive: true,
    };

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
    });

    it('should fetch contacts from Google People API', async () => {
      const mockGoogleContacts = {
        connections: [
          {
            resourceName: 'people/c1',
            names: [{ givenName: 'John', familyName: 'Doe' }],
            emailAddresses: [{ value: 'john@example.com' }],
            phoneNumbers: [{ value: '+1234567890' }],
          },
          {
            resourceName: 'people/c2',
            names: [{ givenName: 'Jane', familyName: 'Smith' }],
            emailAddresses: [{ value: 'jane@example.com' }],
          },
        ],
        totalPeople: 2,
      };

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue(mockGoogleContacts);

      const result = await service.fetchContacts(mockUserId);

      expect(result.contacts).toHaveLength(2);
      expect(result.contacts[0]).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        externalId: 'people/c1',
      });
      expect(result.totalCount).toBe(2);
    });

    it('should respect Google API rate limits', async () => {
      jest
        .spyOn(service as any, 'callGooglePeopleApi')
        .mockRejectedValue({ status: 429, message: 'Rate limit exceeded' });

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

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: [],
        totalPeople: 0,
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
      const mockGoogleContacts = {
        connections: [
          {
            resourceName: 'people/c1',
            names: [{ givenName: 'John', familyName: 'Doe' }],
            emailAddresses: [
              { value: 'john@work.com', metadata: { primary: true } },
              { value: 'john@personal.com' },
            ],
          },
        ],
        totalPeople: 1,
      };

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue(mockGoogleContacts);

      const result = await service.fetchContacts(mockUserId);

      expect(result.contacts[0].email).toBe('john@work.com');
      expect(result.contacts[0].metadata).toHaveProperty('alternateEmails');
    });

    it('should preserve Google contact labels/groups as tags', async () => {
      const mockGoogleContacts = {
        connections: [
          {
            resourceName: 'people/c1',
            names: [{ givenName: 'John', familyName: 'Doe' }],
            emailAddresses: [{ value: 'john@example.com' }],
            memberships: [
              { contactGroupMembership: { contactGroupResourceName: 'Family' } },
              { contactGroupMembership: { contactGroupResourceName: 'Colleagues' } },
            ],
          },
        ],
        totalPeople: 1,
      };

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue(mockGoogleContacts);

      const result = await service.fetchContacts(mockUserId);

      expect(result.contacts[0].tags).toContain('Family');
      expect(result.contacts[0].tags).toContain('Colleagues');
    });

    it('should handle pagination for large contact lists', async () => {
      const mockPage1 = {
        connections: Array(100).fill({
          resourceName: 'people/c1',
          names: [{ givenName: 'Contact', familyName: 'One' }],
        }),
        nextPageToken: 'page2-token',
        totalPeople: 250,
      };

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValueOnce(mockPage1);

      const result = await service.fetchContacts(mockUserId, { pageSize: 100 });

      expect(result.contacts).toHaveLength(100);
      expect(result.nextPageToken).toBe('page2-token');
      expect(result.totalCount).toBe(250);
    });
  });

  describe('previewImport', () => {
    const mockFetchedContacts = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        externalId: 'people/c1',
        tags: ['Friends'],
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '+9876543210',
        externalId: 'people/c2',
        tags: ['Work'],
      },
    ];

    const mockExistingContacts = [
      {
        id: 'contact-existing-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        userId: mockUserId,
      },
    ];

    it('should return preview with deduplication analysis', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockFetchedContacts,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue(mockExistingContacts);

      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockFetchedContacts[0],
          existingContact: mockExistingContacts[0],
          similarity: 0.95,
          matchedFields: ['email', 'firstName', 'lastName'],
        },
      ]);

      const result = await service.previewImport(mockUserId);

      expect(result.totalFetched).toBe(2);
      expect(result.newContacts).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].similarity).toBe(0.95);
    });

    it('should identify exact duplicates based on email', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockFetchedContacts,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue(mockExistingContacts);

      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockFetchedContacts[0],
          existingContact: mockExistingContacts[0],
          similarity: 1.0,
          matchedFields: ['email'],
          matchType: 'EXACT',
        },
      ]);

      const result = await service.previewImport(mockUserId);

      expect(result.duplicates[0].matchType).toBe('EXACT');
      expect(result.duplicates[0].similarity).toBe(1.0);
    });

    it('should identify potential duplicates based on phone number', async () => {
      const contactWithSamePhone = {
        id: 'contact-phone-match',
        firstName: 'Jonathan',
        lastName: 'D',
        phone: '+1234567890',
        userId: mockUserId,
      };

      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockFetchedContacts,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([contactWithSamePhone]);

      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockFetchedContacts[0],
          existingContact: contactWithSamePhone,
          similarity: 0.85,
          matchedFields: ['phone'],
          matchType: 'POTENTIAL',
        },
      ]);

      const result = await service.previewImport(mockUserId);

      expect(result.duplicates[0].matchType).toBe('POTENTIAL');
      expect(result.duplicates[0].matchedFields).toContain('phone');
    });

    it('should use fuzzy matching for similar names', async () => {
      const similarNameContact = {
        id: 'contact-similar',
        firstName: 'Jon',
        lastName: 'Doe',
        email: 'different@example.com',
        userId: mockUserId,
      };

      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockFetchedContacts,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([similarNameContact]);

      mockDeduplicationService.calculateSimilarity.mockReturnValue(0.88);
      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockFetchedContacts[0],
          existingContact: similarNameContact,
          similarity: 0.88,
          matchedFields: ['firstName', 'lastName'],
          matchType: 'FUZZY',
        },
      ]);

      const result = await service.previewImport(mockUserId);

      expect(result.duplicates[0].matchType).toBe('FUZZY');
      expect(result.duplicates[0].similarity).toBeGreaterThan(0.85);
    });

    it('should group contacts by deduplication status', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockFetchedContacts,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue(mockExistingContacts);

      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockFetchedContacts[0],
          existingContact: mockExistingContacts[0],
          similarity: 0.95,
          matchedFields: ['email'],
        },
      ]);

      const result = await service.previewImport(mockUserId);

      expect(result.summary).toMatchObject({
        total: 2,
        new: 1,
        exactDuplicates: expect.any(Number),
        potentialDuplicates: expect.any(Number),
      });
    });

    it('should include preview of tags that will be imported', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockFetchedContacts,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);

      const result = await service.previewImport(mockUserId);

      expect(result.tagsPreview).toContain('Friends');
      expect(result.tagsPreview).toContain('Work');
    });
  });

  describe('importContacts', () => {
    const mockImportDto = {
      skipDuplicates: true,
      updateExisting: false,
      selectedContactIds: ['people/c1', 'people/c2'],
      tagMapping: {
        Friends: 'personal',
        Work: 'professional',
      },
    };

    const mockContactsToImport = [
      {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        externalId: 'people/c1',
        tags: ['Friends'],
      },
      {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        externalId: 'people/c2',
        tags: ['Work'],
      },
    ];

    it('should import contacts successfully', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockImplementation((data) => ({
        id: `contact-${Math.random()}`,
        ...data.data,
      }));

      mockPrismaService.integrationLink.create.mockResolvedValue({});

      const result = await service.importContacts(mockUserId, mockImportDto);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.success).toBe(true);
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(2);
    });

    it('should apply tag mapping during import', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockImplementation((data) => ({
        id: `contact-${Math.random()}`,
        ...data.data,
      }));

      await service.importContacts(mockUserId, mockImportDto);

      const calls = mockPrismaService.contact.create.mock.calls;
      expect(calls[0][0].data.tags).toContain('personal');
      expect(calls[1][0].data.tags).toContain('professional');
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([
        { id: 'existing-1', email: 'john@example.com', userId: mockUserId },
      ]);

      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockContactsToImport[0],
          existingContact: { email: 'john@example.com' },
          similarity: 1.0,
        },
      ]);

      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockImplementation((data) => ({
        id: `contact-${Math.random()}`,
        ...data.data,
      }));

      const result = await service.importContacts(mockUserId, mockImportDto);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should update existing contacts when updateExisting is true', async () => {
      const updateDto = {
        ...mockImportDto,
        skipDuplicates: false,
        updateExisting: true,
      };

      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([
        { id: 'existing-1', email: 'john@example.com', userId: mockUserId },
      ]);

      mockDeduplicationService.findDuplicates.mockResolvedValue([
        {
          importedContact: mockContactsToImport[0],
          existingContact: {
            id: 'existing-1',
            email: 'john@example.com',
          },
          similarity: 1.0,
        },
      ]);

      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.update.mockResolvedValue({
        id: 'existing-1',
        email: 'john@example.com',
      });

      mockPrismaService.integrationLink.upsert.mockResolvedValue({});

      const result = await service.importContacts(mockUserId, updateDto);

      expect(result.updated).toBe(1);
      expect(mockPrismaService.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'existing-1' },
          data: expect.objectContaining({
            source: 'GOOGLE_CONTACTS',
          }),
        }),
      );
    });

    it('should create integration links for imported contacts', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockImplementation((data) => ({
        id: `contact-${Math.random()}`,
        ...data.data,
      }));

      mockPrismaService.integrationLink.create.mockResolvedValue({});

      await service.importContacts(mockUserId, mockImportDto);

      expect(mockPrismaService.integrationLink.create).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.integrationLink.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            integrationId: mockIntegrationId,
            externalId: expect.any(String),
          }),
        }),
      );
    });

    it('should use transaction for atomic import', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      await service.importContacts(mockUserId, mockImportDto);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by selectedContactIds if provided', async () => {
      const selectiveDto = {
        ...mockImportDto,
        selectedContactIds: ['people/c1'],
      };

      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockImplementation((data) => ({
        id: `contact-${Math.random()}`,
        ...data.data,
      }));

      const result = await service.importContacts(mockUserId, selectiveDto);

      expect(result.imported).toBe(1);
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should handle import errors gracefully', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockRejectedValue(new Error('Database error'));

      await expect(service.importContacts(mockUserId, mockImportDto)).rejects.toThrow();
    });

    it('should set contact source to GOOGLE_CONTACTS', async () => {
      jest.spyOn(service, 'fetchContacts').mockResolvedValue({
        contacts: mockContactsToImport,
        totalCount: 2,
      });

      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockDeduplicationService.findDuplicates.mockResolvedValue([]);
      mockPrismaService.integration.findUnique.mockResolvedValue({
        id: mockIntegrationId,
      });

      mockPrismaService.contact.create.mockImplementation((data) => ({
        id: `contact-${Math.random()}`,
        ...data.data,
      }));

      await service.importContacts(mockUserId, mockImportDto);

      const calls = mockPrismaService.contact.create.mock.calls;
      calls.forEach((call) => {
        expect(call[0].data.source).toBe('GOOGLE_CONTACTS');
      });
    });
  });

  describe('syncIncrementalChanges', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'GOOGLE_CONTACTS',
      accessToken: 'encrypted-access-token',
      metadata: {
        syncToken: 'sync-token-123',
      },
    };

    it('should use syncToken for incremental sync', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      const mockApiSpy = jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: [],
        nextSyncToken: 'new-sync-token-456',
      });

      await service.syncIncrementalChanges(mockUserId);

      expect(mockApiSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          syncToken: 'sync-token-123',
        }),
      );
    });

    it('should update syncToken after successful sync', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: [],
        nextSyncToken: 'new-sync-token-456',
      });

      await service.syncIncrementalChanges(mockUserId);

      expect(mockPrismaService.integration.update).toHaveBeenCalledWith({
        where: { id: mockIntegrationId },
        data: {
          metadata: expect.objectContaining({
            syncToken: 'new-sync-token-456',
          }),
        },
      });
    });

    it('should detect new contacts since last sync', async () => {
      const mockNewContacts = [
        {
          resourceName: 'people/new1',
          names: [{ givenName: 'New', familyName: 'Contact' }],
          emailAddresses: [{ value: 'new@example.com' }],
        },
      ];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: mockNewContacts,
        nextSyncToken: 'new-sync-token',
      });

      mockPrismaService.integrationLink.findMany.mockResolvedValue([]);
      mockPrismaService.contact.create.mockResolvedValue({});
      mockPrismaService.integrationLink.create.mockResolvedValue({});

      const result = await service.syncIncrementalChanges(mockUserId);

      expect(result.added).toBe(1);
      expect(mockPrismaService.contact.create).toHaveBeenCalled();
    });

    it('should detect updated contacts since last sync', async () => {
      const mockUpdatedContacts = [
        {
          resourceName: 'people/existing1',
          names: [{ givenName: 'Updated', familyName: 'Name' }],
          emailAddresses: [{ value: 'updated@example.com' }],
        },
      ];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: mockUpdatedContacts,
        nextSyncToken: 'new-sync-token',
      });

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        {
          id: 'link-1',
          externalId: 'people/existing1',
          contactId: 'contact-1',
        },
      ]);

      mockPrismaService.contact.upsert.mockResolvedValue({});

      const result = await service.syncIncrementalChanges(mockUserId);

      expect(result.updated).toBe(1);
      expect(mockPrismaService.contact.upsert).toHaveBeenCalled();
    });

    it('should detect deleted contacts since last sync', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: [],
        deletedContactResourceNames: ['people/deleted1', 'people/deleted2'],
        nextSyncToken: 'new-sync-token',
      });

      mockPrismaService.integrationLink.findMany.mockResolvedValue([
        { externalId: 'people/deleted1', contactId: 'contact-1' },
        { externalId: 'people/deleted2', contactId: 'contact-2' },
      ]);

      mockPrismaService.contact.update.mockResolvedValue({});

      const result = await service.syncIncrementalChanges(mockUserId);

      expect(result.deleted).toBe(2);
    });

    it('should perform full sync if syncToken is invalid', async () => {
      const integrationWithoutToken = {
        ...mockIntegration,
        metadata: {},
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(integrationWithoutToken);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: [],
        nextSyncToken: 'initial-sync-token',
      });

      const fullSyncSpy = jest.spyOn(service as any, 'performFullSync');
      fullSyncSpy.mockResolvedValue({
        added: 0,
        updated: 0,
        deleted: 0,
      });

      await service.syncIncrementalChanges(mockUserId);

      expect(fullSyncSpy).toHaveBeenCalled();
    });

    it('should respect rate limits during sync', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockRejectedValue({ status: 429 });

      await expect(service.syncIncrementalChanges(mockUserId)).rejects.toThrow();
    });

    it('should return sync statistics', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);

      jest.spyOn(service as any, 'callGooglePeopleApi').mockResolvedValue({
        connections: [],
        nextSyncToken: 'new-sync-token',
      });

      const result = await service.syncIncrementalChanges(mockUserId);

      expect(result).toMatchObject({
        added: expect.any(Number),
        updated: expect.any(Number),
        deleted: expect.any(Number),
        syncedAt: expect.any(Date),
      });
    });
  });

  describe('disconnectIntegration', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'GOOGLE_CONTACTS',
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

      expect(mockOAuthService.revokeToken).toHaveBeenCalledWith('access-token', 'google');
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
            type: 'GOOGLE_CONTACTS',
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

      // Should still complete disconnection even if revocation fails
      await service.disconnectIntegration(mockUserId);

      expect(mockPrismaService.integration.delete).toHaveBeenCalled();
    });

    it('should throw error if integration not found', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      await expect(service.disconnectIntegration(mockUserId)).rejects.toThrow();
    });

    it('should return disconnection summary', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.integrationLink.deleteMany.mockResolvedValue({
        count: 15,
      });

      const result = await service.disconnectIntegration(mockUserId);

      expect(result).toMatchObject({
        success: true,
        linksDeleted: 15,
        tokensRevoked: true,
      });
    });
  });

  describe('getIntegrationStatus', () => {
    it('should return active integration status', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'GOOGLE_CONTACTS',
        isActive: true,
        createdAt: new Date(),
        metadata: {
          syncToken: 'token-123',
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
