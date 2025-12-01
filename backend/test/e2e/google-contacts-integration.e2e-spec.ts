/**
 * End-to-End tests for Google Contacts Integration
 * Test-Driven Development (RED phase)
 * Tests complete OAuth flow and import workflow with mocked Google API
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@/shared/database/prisma.service';
import { AppModule } from '@/app.module';

describe('Google Contacts Integration (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  // Mock Google API responses
  const mockGoogleOAuthTokenResponse = {
    access_token: 'ya29.mock-google-access-token',
    refresh_token: '1//mock-refresh-token',
    expires_in: 3600,
    scope: 'https://www.googleapis.com/auth/contacts.readonly',
    token_type: 'Bearer',
  };

  const mockGoogleContactsResponse = {
    connections: [
      {
        resourceName: 'people/c1',
        etag: '%EgUBAgMFBw==',
        names: [
          {
            metadata: { primary: true, source: { type: 'CONTACT' } },
            displayName: 'John Doe',
            familyName: 'Doe',
            givenName: 'John',
          },
        ],
        emailAddresses: [
          {
            metadata: { primary: true },
            value: 'john.doe@example.com',
          },
        ],
        phoneNumbers: [
          {
            metadata: { primary: true },
            value: '+1-555-0100',
            canonicalForm: '+15550100',
          },
        ],
        organizations: [
          {
            metadata: { primary: true },
            name: 'Acme Corp',
            title: 'Software Engineer',
          },
        ],
        memberships: [
          {
            contactGroupMembership: {
              contactGroupResourceName: 'contactGroups/friends',
            },
          },
        ],
      },
      {
        resourceName: 'people/c2',
        etag: '%EgUBAgMFBw==',
        names: [
          {
            metadata: { primary: true, source: { type: 'CONTACT' } },
            displayName: 'Jane Smith',
            familyName: 'Smith',
            givenName: 'Jane',
          },
        ],
        emailAddresses: [
          {
            metadata: { primary: true },
            value: 'jane.smith@example.com',
          },
        ],
        phoneNumbers: [
          {
            metadata: { primary: true },
            value: '+1-555-0200',
          },
        ],
        memberships: [
          {
            contactGroupMembership: {
              contactGroupResourceName: 'contactGroups/work',
            },
          },
        ],
      },
      {
        resourceName: 'people/c3',
        etag: '%EgUBAgMFBw==',
        names: [
          {
            metadata: { primary: true, source: { type: 'CONTACT' } },
            displayName: 'Bob Johnson',
            familyName: 'Johnson',
            givenName: 'Bob',
          },
        ],
        emailAddresses: [
          {
            metadata: { primary: true },
            value: 'bob.johnson@example.com',
          },
        ],
      },
    ],
    totalPeople: 3,
    totalItems: 3,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test user and get auth token
    const registerResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'test.user@example.com',
      password: 'SecurePassword123!',
      firstName: 'Test',
      lastName: 'User',
    });

    authToken = registerResponse.body.accessToken;
    userId = registerResponse.body.user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.integrationLink.deleteMany({ where: { integration: { userId } } });
    await prisma.integration.deleteMany({ where: { userId } });
    await prisma.contact.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  afterEach(async () => {
    // Clean up integrations and contacts between tests
    await prisma.integrationLink.deleteMany({ where: { integration: { userId } } });
    await prisma.integration.deleteMany({ where: { userId } });
    await prisma.contact.deleteMany({ where: { userId } });
  });

  describe('Complete OAuth Flow', () => {
    it('should initiate OAuth flow and return authorization URL', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/auth')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body).toHaveProperty('state');
      expect(response.body.authUrl).toContain('accounts.google.com');
      expect(response.body.authUrl).toContain('contacts.readonly');
    });

    it('should handle OAuth callback and create integration', async () => {
      // First, initiate OAuth to get state
      const authResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/auth')
        .set('Authorization', `Bearer ${authToken}`);

      const { state } = authResponse.body;

      // Mock Google token exchange
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockGoogleOAuthTokenResponse,
      } as Response);

      // Handle callback
      const callbackResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/callback')
        .query({ code: 'auth-code-123', state })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body).toHaveProperty('integrationId');

      // Verify integration was created in database
      const integration = await prisma.integration.findUnique({
        where: {
          userId_type: {
            userId,
            type: 'GOOGLE_CONTACTS',
          },
        },
      });

      expect(integration).toBeDefined();
      expect(integration.isActive).toBe(true);
      expect(integration.accessToken).toBeDefined();
      expect(integration.refreshToken).toBeDefined();
    });

    it('should reject callback with invalid state', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/integrations/google/callback')
        .query({ code: 'auth-code-123', state: 'invalid-state' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should reject callback without authentication', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/integrations/google/callback')
        .query({ code: 'auth-code-123', state: 'some-state' })
        .expect(401);
    });
  });

  describe('Contact Preview and Deduplication', () => {
    beforeEach(async () => {
      // Create integration
      await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          isActive: true,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });

      // Mock Google People API
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockGoogleContactsResponse,
      } as Response);
    });

    it('should preview contacts with deduplication analysis', async () => {
      // Create existing contact that will be detected as duplicate
      await prisma.contact.create({
        data: {
          userId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          source: 'MANUAL',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totalFetched).toBe(3);
      expect(response.body.summary.new).toBeLessThan(3); // At least one duplicate
      expect(response.body.duplicates).toBeInstanceOf(Array);
      expect(response.body.duplicates.length).toBeGreaterThan(0);

      // Verify duplicate detection
      const duplicate = response.body.duplicates.find(
        (d) => d.importedContact.email === 'john.doe@example.com',
      );
      expect(duplicate).toBeDefined();
      expect(duplicate.similarity).toBeGreaterThan(0.9);
    });

    it('should identify exact duplicates by email', async () => {
      await prisma.contact.create({
        data: {
          userId,
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          source: 'MANUAL',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const exactDuplicate = response.body.duplicates.find(
        (d) => d.matchType === 'EXACT' && d.importedContact.email === 'jane.smith@example.com',
      );

      expect(exactDuplicate).toBeDefined();
      expect(exactDuplicate.similarity).toBe(1.0);
    });

    it('should detect potential duplicates by phone number', async () => {
      await prisma.contact.create({
        data: {
          userId,
          firstName: 'Jonathan',
          lastName: 'D',
          phone: '+15550100',
          source: 'MANUAL',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const potentialDuplicate = response.body.duplicates.find(
        (d) => d.matchedFields && d.matchedFields.includes('phone'),
      );

      expect(potentialDuplicate).toBeDefined();
    });

    it('should show tag preview from Google labels', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.tagsPreview).toBeInstanceOf(Array);
      expect(response.body.tagsPreview).toContain('friends');
      expect(response.body.tagsPreview).toContain('work');
    });

    it('should handle preview with no existing contacts', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totalFetched).toBe(3);
      expect(response.body.summary.new).toBe(3);
      expect(response.body.duplicates).toHaveLength(0);
    });
  });

  describe('Contact Import Flow', () => {
    beforeEach(async () => {
      await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          isActive: true,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockGoogleContactsResponse,
      } as Response);
    });

    it('should import all contacts successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: false,
          updateExisting: false,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.imported).toBe(3);

      // Verify contacts in database
      const contacts = await prisma.contact.findMany({ where: { userId } });
      expect(contacts).toHaveLength(3);

      // Verify contact details
      const johnDoe = contacts.find((c) => c.email === 'john.doe@example.com');
      expect(johnDoe).toBeDefined();
      expect(johnDoe.firstName).toBe('John');
      expect(johnDoe.lastName).toBe('Doe');
      expect(johnDoe.company).toBe('Acme Corp');
      expect(johnDoe.position).toBe('Software Engineer');
      expect(johnDoe.source).toBe('GOOGLE_CONTACTS');
    });

    it('should apply tag mapping during import', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: false,
          updateExisting: false,
          tagMapping: {
            friends: 'personal',
            work: 'professional',
          },
        })
        .expect(201);

      expect(response.body.imported).toBe(3);

      const contacts = await prisma.contact.findMany({ where: { userId } });
      const johnDoe = contacts.find((c) => c.email === 'john.doe@example.com');
      expect(johnDoe.tags).toContain('personal');

      const janeSmith = contacts.find((c) => c.email === 'jane.smith@example.com');
      expect(janeSmith.tags).toContain('professional');
    });

    it('should skip duplicates when skipDuplicates is true', async () => {
      // Create existing contact
      await prisma.contact.create({
        data: {
          userId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          source: 'MANUAL',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: true,
          updateExisting: false,
        })
        .expect(201);

      expect(response.body.imported).toBe(2);
      expect(response.body.skipped).toBe(1);

      const contacts = await prisma.contact.findMany({ where: { userId } });
      expect(contacts).toHaveLength(3); // 1 existing + 2 new
    });

    it('should update existing contacts when updateExisting is true', async () => {
      // Create existing contact with outdated info
      await prisma.contact.create({
        data: {
          userId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          company: 'Old Company',
          source: 'MANUAL',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: false,
          updateExisting: true,
        })
        .expect(201);

      expect(response.body.updated).toBeGreaterThan(0);

      const johnDoe = await prisma.contact.findFirst({
        where: { userId, email: 'john.doe@example.com' },
      });
      expect(johnDoe.company).toBe('Acme Corp'); // Updated from Google
    });

    it('should import only selected contacts', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: false,
          updateExisting: false,
          selectedContactIds: ['people/c1', 'people/c2'],
        })
        .expect(201);

      expect(response.body.imported).toBe(2);

      const contacts = await prisma.contact.findMany({ where: { userId } });
      expect(contacts).toHaveLength(2);
    });

    it('should create integration links for imported contacts', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: false,
          updateExisting: false,
        })
        .expect(201);

      const integration = await prisma.integration.findUnique({
        where: { userId_type: { userId, type: 'GOOGLE_CONTACTS' } },
        include: { links: true },
      });

      expect(integration.links).toHaveLength(3);
      expect(integration.links[0].externalId).toMatch(/^people\//);
    });

    it('should preserve Google contact metadata', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          skipDuplicates: false,
          updateExisting: false,
        })
        .expect(201);

      const contact = await prisma.contact.findFirst({
        where: { userId, email: 'john.doe@example.com' },
      });

      expect(contact.metadata).toBeDefined();
      expect(contact.metadata).toHaveProperty('googleResourceName');
    });
  });

  describe('Incremental Sync', () => {
    let integrationId: string;

    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          isActive: true,
          expiresAt: new Date(Date.now() + 3600 * 1000),
          metadata: {
            syncToken: 'sync-token-123',
          },
        },
      });
      integrationId = integration.id;
    });

    it('should detect and add new contacts since last sync', async () => {
      const mockIncrementalResponse = {
        connections: [
          {
            resourceName: 'people/c4',
            names: [{ givenName: 'Alice', familyName: 'Williams' }],
            emailAddresses: [{ value: 'alice@example.com' }],
          },
        ],
        nextSyncToken: 'new-sync-token-456',
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockIncrementalResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.added).toBe(1);
      expect(response.body.success).toBe(true);

      // Verify new contact was added
      const alice = await prisma.contact.findFirst({
        where: { userId, email: 'alice@example.com' },
      });
      expect(alice).toBeDefined();

      // Verify syncToken was updated
      const updatedIntegration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      expect(updatedIntegration.metadata.syncToken).toBe('new-sync-token-456');
    });

    it('should detect and update modified contacts', async () => {
      // Create existing contact
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Bob',
          lastName: 'Johnson',
          email: 'bob.johnson@example.com',
          company: 'Old Company',
          source: 'GOOGLE_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId,
          contactId: contact.id,
          externalId: 'people/c3',
        },
      });

      const mockUpdateResponse = {
        connections: [
          {
            resourceName: 'people/c3',
            names: [{ givenName: 'Bob', familyName: 'Johnson' }],
            emailAddresses: [{ value: 'bob.johnson@example.com' }],
            organizations: [{ name: 'New Company', title: 'Manager' }],
          },
        ],
        nextSyncToken: 'new-sync-token',
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockUpdateResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.updated).toBe(1);

      const updatedContact = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      expect(updatedContact.company).toBe('New Company');
      expect(updatedContact.position).toBe('Manager');
    });

    it('should handle deleted contacts from Google', async () => {
      // Create contact that will be deleted
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Deleted',
          lastName: 'User',
          email: 'deleted@example.com',
          source: 'GOOGLE_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId,
          contactId: contact.id,
          externalId: 'people/deleted1',
        },
      });

      const mockDeleteResponse = {
        connections: [],
        deletedContactResourceNames: ['people/deleted1'],
        nextSyncToken: 'new-sync-token',
      };

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockDeleteResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.deleted).toBe(1);

      // Contact should be marked as deleted (soft delete)
      const deletedContact = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      expect(deletedContact.metadata).toHaveProperty('deletedFromGoogle', true);
    });

    it('should handle sync when no changes exist', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          connections: [],
          nextSyncToken: 'same-sync-token-123',
        }),
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.added).toBe(0);
      expect(response.body.updated).toBe(0);
      expect(response.body.deleted).toBe(0);
      expect(response.body.success).toBe(true);
    });

    it('should perform full sync when syncToken is invalid', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Invalid syncToken' }),
      } as Response);

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockGoogleContactsResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // Should have performed full sync instead
    });
  });

  describe('Disconnect Integration', () => {
    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          isActive: true,
        },
      });

      // Create some contacts and links
      const contact1 = await prisma.contact.create({
        data: {
          userId,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          source: 'GOOGLE_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId: integration.id,
          contactId: contact1.id,
          externalId: 'people/c1',
        },
      });
    });

    it('should disconnect integration and revoke tokens', async () => {
      // Mock Google token revocation
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
      } as Response);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/integrations/google/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokensRevoked).toBe(true);
      expect(response.body.linksDeleted).toBeGreaterThan(0);

      // Verify integration was deleted
      const integration = await prisma.integration.findUnique({
        where: { userId_type: { userId, type: 'GOOGLE_CONTACTS' } },
      });
      expect(integration).toBeNull();

      // Verify links were deleted
      const links = await prisma.integrationLink.findMany({
        where: { integration: { userId } },
      });
      expect(links).toHaveLength(0);
    });

    it('should preserve imported contacts after disconnect', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
      } as Response);

      await request(app.getHttpServer())
        .delete('/api/v1/integrations/google/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Contacts should still exist
      const contacts = await prisma.contact.findMany({ where: { userId } });
      expect(contacts.length).toBeGreaterThan(0);
    });

    it('should handle disconnect when no integration exists', async () => {
      // Delete existing integration first
      await prisma.integrationLink.deleteMany({});
      await prisma.integration.deleteMany({ where: { userId } });

      await request(app.getHttpServer())
        .delete('/api/v1/integrations/google/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle token revocation failure gracefully', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 400,
      } as Response);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/integrations/google/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokensRevoked).toBe(false);

      // Integration should still be deleted
      const integration = await prisma.integration.findUnique({
        where: { userId_type: { userId, type: 'GOOGLE_CONTACTS' } },
      });
      expect(integration).toBeNull();
    });
  });

  describe('Integration Status', () => {
    it('should return connected status with details', async () => {
      const createdAt = new Date('2024-01-01');
      const lastSyncAt = new Date('2024-01-15');

      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-token',
          isActive: true,
          createdAt,
          metadata: {
            lastSyncAt,
          },
        },
      });

      // Create some contacts
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
          source: 'GOOGLE_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId: integration.id,
          contactId: contact.id,
          externalId: 'people/test',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isConnected).toBe(true);
      expect(response.body.totalSyncedContacts).toBeGreaterThan(0);
      expect(response.body.isActive).toBe(true);
    });

    it('should return not connected status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/google/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isConnected).toBe(false);
      expect(response.body.totalSyncedContacts).toBe(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Google API rate limit errors', async () => {
      await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-token',
          isActive: true,
        },
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit exceeded' }),
      } as Response);

      await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(429);
    });

    it('should handle expired access tokens with refresh', async () => {
      await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-expired-token',
          refreshToken: 'encrypted-refresh-token',
          isActive: true,
          expiresAt: new Date(Date.now() - 1000), // Expired
        },
      });

      // Mock refresh token flow
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          expires_in: 3600,
        }),
      } as Response);

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockGoogleContactsResponse,
      } as Response);

      await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should handle concurrent import requests', async () => {
      await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-token',
          isActive: true,
        },
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => mockGoogleContactsResponse,
      } as Response);

      // Send two import requests simultaneously
      const [response1, response2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/integrations/google/contacts/import')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ skipDuplicates: true }),
        request(app.getHttpServer())
          .post('/api/v1/integrations/google/contacts/import')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ skipDuplicates: true }),
      ]);

      // Both should succeed or one should be locked
      expect([200, 201, 409]).toContain(response1.status);
      expect([200, 201, 409]).toContain(response2.status);
    });

    it('should require authentication for all endpoints', async () => {
      await request(app.getHttpServer()).get('/api/v1/integrations/google/auth').expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/integrations/google/contacts/preview')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/import')
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/integrations/google/contacts/sync')
        .expect(401);

      await request(app.getHttpServer())
        .delete('/api/v1/integrations/google/disconnect')
        .expect(401);
    });
  });

  describe('GDPR Compliance', () => {
    it('should allow user to disconnect and remove all data', async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CONTACTS',
          name: 'Google Contacts',
          accessToken: 'encrypted-token',
          isActive: true,
        },
      });

      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
          source: 'GOOGLE_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId: integration.id,
          contactId: contact.id,
          externalId: 'people/test',
        },
      });

      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
      } as Response);

      await request(app.getHttpServer())
        .delete('/api/v1/integrations/google/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify no integration data remains
      const remainingIntegration = await prisma.integration.findUnique({
        where: { id: integration.id },
      });
      expect(remainingIntegration).toBeNull();

      const remainingLinks = await prisma.integrationLink.findMany({
        where: { integrationId: integration.id },
      });
      expect(remainingLinks).toHaveLength(0);
    });
  });
});
