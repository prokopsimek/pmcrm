/**
 * End-to-End tests for Microsoft 365 Contacts Integration
 * Test-Driven Development (RED phase)
 * Tests complete OAuth flow, bidirectional sync, and conflict resolution with mocked Microsoft Graph API
 *
 * US-011: Import contacts from Microsoft 365
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@/shared/database/prisma.service';
import { AppModule } from '@/app.module';

describe('Microsoft 365 Contacts Integration (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  // Mock Microsoft Graph API responses
  const mockMsftOAuthTokenResponse = {
    access_token: 'EwBAA-mock-microsoft-access-token',
    refresh_token: 'M.R3_BAY-mock-refresh-token',
    expires_in: 3600,
    scope: 'Contacts.Read Contacts.ReadWrite offline_access',
    token_type: 'Bearer',
  };

  const mockMsftContactsResponse = {
    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('user-id')/contacts",
    '@odata.count': 3,
    value: [
      {
        id: 'AAMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgBGAAAAAAAqFxqgTXC=',
        createdDateTime: '2024-01-01T10:00:00Z',
        lastModifiedDateTime: '2024-01-15T14:30:00Z',
        changeKey: 'EQAAABYAAACa7VdH0123456789==',
        categories: ['Red category', 'Important'],
        parentFolderId: 'AAMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXC=',
        birthday: null,
        fileAs: 'Doe, John',
        displayName: 'John Doe',
        givenName: 'John',
        surname: 'Doe',
        title: 'Software Engineer',
        companyName: 'Acme Corp',
        emailAddresses: [
          {
            address: 'john.doe@acmecorp.com',
            name: 'John Doe',
          },
        ],
        mobilePhone: '+1-555-0100',
        businessPhones: ['+1-555-0101'],
        homePhones: [],
      },
      {
        id: 'BBMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgBGAAAAAAAqFxqgTXD=',
        createdDateTime: '2024-01-05T09:00:00Z',
        lastModifiedDateTime: '2024-01-20T11:45:00Z',
        changeKey: 'EQAAABYAAACa7VdH0987654321==',
        categories: ['Blue category', 'Customer'],
        parentFolderId: 'AAMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXC=',
        fileAs: 'Smith, Jane',
        displayName: 'Jane Smith',
        givenName: 'Jane',
        surname: 'Smith',
        title: 'Product Manager',
        companyName: 'TechCorp Inc',
        emailAddresses: [
          {
            address: 'jane.smith@techcorp.com',
            name: 'Jane Smith',
          },
        ],
        mobilePhone: '+1-555-0200',
        businessPhones: [],
        homePhones: ['+1-555-0201'],
      },
      {
        id: 'CCMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgBGAAAAAAAqFxqgTXE=',
        createdDateTime: '2024-01-10T15:20:00Z',
        lastModifiedDateTime: '2024-01-10T15:20:00Z',
        changeKey: 'EQAAABYAAACa7VdH0111111111==',
        categories: [],
        parentFolderId: 'AAMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXC=',
        fileAs: 'Johnson, Bob',
        displayName: 'Bob Johnson',
        givenName: 'Bob',
        surname: 'Johnson',
        emailAddresses: [
          {
            address: 'bob.johnson@example.com',
            name: 'Bob Johnson',
          },
        ],
        mobilePhone: null,
        businessPhones: ['+1-555-0300'],
        homePhones: [],
      },
    ],
  };

  const mockMsftContactFoldersResponse = {
    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('user-id')/contactFolders",
    value: [
      {
        id: 'AAMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXC=',
        displayName: 'Contacts',
        parentFolderId: null,
      },
      {
        id: 'BBMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXD=',
        displayName: 'Team Contacts',
        parentFolderId: 'AAMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXC=',
      },
    ],
  };

  const mockDeltaResponse = {
    '@odata.context': "https://graph.microsoft.com/v1.0/$metadata#users('user-id')/contacts/$delta",
    '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=abc123xyz',
    value: [
      {
        id: 'DDMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgBGAAAAAAAqFxqgTXF=',
        givenName: 'New',
        surname: 'Contact',
        emailAddresses: [{ address: 'new.contact@example.com' }],
      },
    ],
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
      email: 'msft.test@example.com',
      password: 'SecurePassword123!',
      firstName: 'Microsoft',
      lastName: 'Tester',
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
    it('should initiate OAuth flow and return Microsoft authorization URL', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/auth')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('authUrl');
      expect(response.body).toHaveProperty('state');
      expect(response.body.authUrl).toContain('login.microsoftonline.com');
      expect(response.body.authUrl).toContain('Contacts.Read');
    });

    it('should handle OAuth callback and create integration', async () => {
      // First, initiate OAuth to get state
      const authResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/auth')
        .set('Authorization', `Bearer ${authToken}`);

      const { state } = authResponse.body;

      // Mock Microsoft token exchange
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftOAuthTokenResponse,
      } as Response);

      // Handle callback
      const callbackResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/callback')
        .query({ code: 'auth-code-123', state })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body).toHaveProperty('integrationId');
      expect(callbackResponse.body.message).toContain('Microsoft 365');

      // Verify integration was created in database
      const integration = await prisma.integration.findUnique({
        where: {
          userId_type: {
            userId,
            type: 'MICROSOFT_CONTACTS',
          },
        },
      });

      expect(integration).toBeDefined();
      expect(integration.type).toBe('MICROSOFT_CONTACTS');
      expect(integration.isActive).toBe(true);
      expect(integration.accessToken).toBeDefined(); // Should be encrypted
      expect(integration.refreshToken).toBeDefined();
    });

    it('should reject invalid state parameter in callback', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/callback')
        .query({ code: 'auth-code-123', state: 'invalid-state' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should require authentication for OAuth endpoints', async () => {
      await request(app.getHttpServer()).get('/api/v1/integrations/microsoft/auth').expect(401);

      await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/callback')
        .query({ code: 'code', state: 'state' })
        .expect(401);
    });
  });

  describe('Fetch Contacts and Shared Address Books', () => {
    let integrationId: string;

    beforeEach(async () => {
      // Create integration
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
      });
      integrationId = integration.id;
    });

    it('should fetch contacts from Microsoft Graph API', async () => {
      // Mock Graph API call
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactsResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totalFetched).toBe(3);
      expect(response.body.newContacts).toHaveLength(3);
      expect(response.body.tagsPreview).toContain('Red category');
      expect(response.body.tagsPreview).toContain('Blue category');
    });

    it('should fetch shared contact folders', async () => {
      // Mock Graph API call
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactFoldersResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/contacts/folders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.folders).toHaveLength(2);
      expect(response.body.folders[0].name).toBe('Contacts');
      expect(response.body.folders[1].name).toBe('Team Contacts');
    });

    it('should map Outlook categories to tags in preview', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactsResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const contactWithCategories = response.body.newContacts.find((c) => c.firstName === 'John');

      expect(contactWithCategories.tags).toContain('Red category');
      expect(contactWithCategories.tags).toContain('Important');
    });
  });

  describe('Import Contacts with Category Mapping', () => {
    let integrationId: string;

    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
      });
      integrationId = integration.id;
    });

    it('should import contacts with category mapping', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactsResponse,
      } as Response);

      const importDto = {
        skipDuplicates: true,
        updateExisting: false,
        categoryMapping: {
          'Red category': 'urgent',
          'Blue category': 'customer',
          Important: 'vip',
        },
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.imported).toBe(3);
      expect(response.body.skipped).toBe(0);

      // Verify contacts were created with mapped tags
      const contacts = await prisma.contact.findMany({
        where: { userId },
      });

      expect(contacts).toHaveLength(3);

      const johnContact = contacts.find((c) => c.firstName === 'John');
      expect(johnContact.tags).toContain('urgent');
      expect(johnContact.tags).toContain('vip');

      const janeContact = contacts.find((c) => c.firstName === 'Jane');
      expect(janeContact.tags).toContain('customer');
    });

    it('should import contacts from specific folders', async () => {
      // Mock folder contacts request
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockMsftContactsResponse,
          value: [mockMsftContactsResponse.value[0]], // Only one contact
        }),
      } as Response);

      const importDto = {
        skipDuplicates: true,
        updateExisting: false,
        includeFolders: ['BBMkADAwATM0MDAAMS1iNTcwLTI2MmMtMDACLTAwCgAuAAAAAAAqFxqgTXD='],
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send(importDto)
        .expect(201);

      expect(response.body.imported).toBe(1);
    });

    it('should skip duplicates when option enabled', async () => {
      // First import
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactsResponse,
      } as Response);

      await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skipDuplicates: true, updateExisting: false })
        .expect(201);

      // Second import (should skip)
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactsResponse,
      } as Response);

      const secondImport = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skipDuplicates: true, updateExisting: false })
        .expect(201);

      expect(secondImport.body.imported).toBe(0);
      expect(secondImport.body.skipped).toBe(3);
    });

    it('should update existing contacts when option enabled', async () => {
      // First import
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockMsftContactsResponse,
      } as Response);

      await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skipDuplicates: false, updateExisting: false })
        .expect(201);

      // Mock updated contact
      const updatedResponse = {
        ...mockMsftContactsResponse,
        value: [
          {
            ...mockMsftContactsResponse.value[0],
            title: 'Senior Software Engineer', // Updated title
          },
        ],
      };

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => updatedResponse,
      } as Response);

      const secondImport = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/import')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ skipDuplicates: false, updateExisting: true })
        .expect(201);

      expect(secondImport.body.updated).toBe(1);

      // Verify update
      const contact = await prisma.contact.findFirst({
        where: { firstName: 'John', userId },
      });
      expect(contact.position).toBe('Senior Software Engineer');
    });
  });

  describe('Bidirectional Sync', () => {
    let integrationId: string;
    let contactId: string;

    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
      });
      integrationId = integration.id;

      // Create a contact
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
          source: 'MICROSOFT_CONTACTS',
        },
      });
      contactId = contact.id;

      // Create integration link
      await prisma.integrationLink.create({
        data: {
          integrationId,
          contactId,
          externalId: 'msft-contact-123',
        },
      });
    });

    it('should push CRM contact changes to Outlook', async () => {
      // Update contact in CRM
      await prisma.contact.update({
        where: { id: contactId },
        data: { lastName: 'Updated' },
      });

      // Mock Graph API update
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msft-contact-123',
          givenName: 'Test',
          surname: 'Updated',
        }),
      } as Response);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/integrations/microsoft/contacts/${contactId}/push`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ strategy: 'LAST_WRITE_WINS' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.direction).toBe('CRM_TO_OUTLOOK');
    });

    it('should detect conflicts and apply LAST_WRITE_WINS strategy', async () => {
      const olderTime = new Date(Date.now() - 10000);
      const newerTime = new Date();

      // Update CRM contact (older)
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastName: 'CRM-Updated',
          updatedAt: olderTime,
        },
      });

      // Mock Outlook contact (newer)
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msft-contact-123',
          givenName: 'Test',
          surname: 'Outlook-Updated',
          lastModifiedDateTime: newerTime.toISOString(),
        }),
      } as Response);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/integrations/microsoft/contacts/${contactId}/push`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ strategy: 'LAST_WRITE_WINS' })
        .expect(200);

      expect(response.body.hasConflicts).toBe(true);
      expect(response.body.direction).toBe('OUTLOOK_TO_CRM');

      // Verify CRM was updated with Outlook value
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });
      expect(contact.lastName).toBe('Outlook-Updated');
    });

    it('should apply CRM_PRIORITY strategy on conflict', async () => {
      // Create conflict scenario
      await prisma.contact.update({
        where: { id: contactId },
        data: { lastName: 'CRM-Priority' },
      });

      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'msft-contact-123',
            givenName: 'Test',
            surname: 'Outlook-Value',
            lastModifiedDateTime: new Date().toISOString(),
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'msft-contact-123',
            surname: 'CRM-Priority',
          }),
        } as Response);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/integrations/microsoft/contacts/${contactId}/push`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ strategy: 'CRM_PRIORITY' })
        .expect(200);

      expect(response.body.hasConflicts).toBe(true);
      expect(response.body.conflictsResolved).toBeGreaterThan(0);
    });

    it('should flag conflicts for manual review', async () => {
      await prisma.contact.update({
        where: { id: contactId },
        data: { email: 'crm@example.com' },
      });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'msft-contact-123',
          emailAddresses: [{ address: 'outlook@example.com' }],
          lastModifiedDateTime: new Date().toISOString(),
        }),
      } as Response);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/integrations/microsoft/contacts/${contactId}/push`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ strategy: 'MANUAL_REVIEW' })
        .expect(200);

      expect(response.body.requiresManualReview).toBe(true);
      expect(response.body.conflicts).toBeDefined();
      expect(response.body.conflicts.length).toBeGreaterThan(0);
    });

    it('should create contact in Outlook if not exists', async () => {
      // Delete integration link
      await prisma.integrationLink.deleteMany({
        where: { contactId },
      });

      // Mock Graph API create
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'new-msft-contact-id',
          givenName: 'Test',
          surname: 'Contact',
        }),
      } as Response);

      const response = await request(app.getHttpServer())
        .put(`/api/v1/integrations/microsoft/contacts/${contactId}/push`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ strategy: 'LAST_WRITE_WINS' })
        .expect(200);

      expect(response.body.action).toBe('CREATED_IN_OUTLOOK');
      expect(response.body.externalId).toBe('new-msft-contact-id');

      // Verify link was created
      const link = await prisma.integrationLink.findFirst({
        where: { contactId },
      });
      expect(link).toBeDefined();
      expect(link.externalId).toBe('new-msft-contact-id');
    });
  });

  describe('Incremental Sync with Delta Queries', () => {
    let integrationId: string;

    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          metadata: {
            deltaLink: 'https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=old',
          },
        },
      });
      integrationId = integration.id;
    });

    it('should use delta query for incremental sync', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeltaResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: true,
          strategy: 'LAST_WRITE_WINS',
          syncDirection: 'BIDIRECTIONAL',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.added).toBe(1);

      // Verify deltaLink was updated
      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      expect(integration.metadata.deltaLink).toBe(
        'https://graph.microsoft.com/v1.0/me/contacts/delta?$deltatoken=abc123xyz',
      );
    });

    it('should detect and sync new contacts', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockDeltaResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: true,
          strategy: 'LAST_WRITE_WINS',
          syncDirection: 'OUTLOOK_TO_CRM',
        })
        .expect(201);

      expect(response.body.added).toBe(1);

      const contact = await prisma.contact.findFirst({
        where: { firstName: 'New', userId },
      });
      expect(contact).toBeDefined();
      expect(contact.lastName).toBe('Contact');
    });

    it('should detect deleted contacts', async () => {
      const deletedDeltaResponse = {
        '@odata.deltaLink': 'new-delta-link',
        value: [
          {
            id: 'deleted-contact-id',
            '@removed': {
              reason: 'deleted',
            },
          },
        ],
      };

      // Create a linked contact
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'To',
          lastName: 'Delete',
          email: 'delete@example.com',
          source: 'MICROSOFT_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId,
          contactId: contact.id,
          externalId: 'deleted-contact-id',
        },
      });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => deletedDeltaResponse,
      } as Response);

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          enabled: true,
          strategy: 'LAST_WRITE_WINS',
          syncDirection: 'OUTLOOK_TO_CRM',
        })
        .expect(201);

      expect(response.body.deleted).toBe(1);

      // Verify contact was soft-deleted or marked
      const deletedContact = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      expect(deletedContact.deletedAt).toBeDefined();
    });
  });

  describe('Conflict Resolution', () => {
    it('should resolve batch conflicts', async () => {
      const conflicts = [
        {
          contactId: 'contact-1',
          field: 'email',
          crmValue: 'old@example.com',
          outlookValue: 'new@example.com',
        },
        {
          contactId: 'contact-2',
          field: 'phone',
          crmValue: '+1111111111',
          outlookValue: '+2222222222',
        },
      ];

      const response = await request(app.getHttpServer())
        .post('/api/v1/integrations/microsoft/contacts/conflicts/resolve')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conflicts,
          strategy: 'LAST_WRITE_WINS',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.resolved).toHaveLength(2);
    });
  });

  describe('Disconnect Integration', () => {
    let integrationId: string;

    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
      });
      integrationId = integration.id;

      // Create some contacts and links
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Linked',
          lastName: 'Contact',
          email: 'linked@example.com',
          source: 'MICROSOFT_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId,
          contactId: contact.id,
          externalId: 'external-123',
        },
      });
    });

    it('should disconnect integration and revoke tokens', async () => {
      // Mock token revocation
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const response = await request(app.getHttpServer())
        .delete('/api/v1/integrations/microsoft/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.tokensRevoked).toBe(true);
      expect(response.body.linksDeleted).toBe(1);

      // Verify integration was deleted
      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      expect(integration).toBeNull();

      // Verify links were deleted
      const links = await prisma.integrationLink.findMany({
        where: { integrationId },
      });
      expect(links).toHaveLength(0);

      // Verify contacts were preserved
      const contacts = await prisma.contact.findMany({
        where: { userId },
      });
      expect(contacts).toHaveLength(1);
    });

    it('should preserve imported contacts after disconnect', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const contactCountBefore = await prisma.contact.count({
        where: { userId },
      });

      await request(app.getHttpServer())
        .delete('/api/v1/integrations/microsoft/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const contactCountAfter = await prisma.contact.count({
        where: { userId },
      });

      expect(contactCountAfter).toBe(contactCountBefore);
    });
  });

  describe('Integration Status', () => {
    it('should return not connected status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isConnected).toBe(false);
      expect(response.body.totalSyncedContacts).toBe(0);
    });

    it('should return connected status with sync details', async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
          metadata: {
            lastSyncAt: new Date(),
            deltaLink: 'delta-link',
          },
        },
      });

      // Create some linked contacts
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
          source: 'MICROSOFT_CONTACTS',
        },
      });

      await prisma.integrationLink.create({
        data: {
          integrationId: integration.id,
          contactId: contact.id,
          externalId: 'external-123',
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.isConnected).toBe(true);
      expect(response.body.totalSyncedContacts).toBe(1);
      expect(response.body.isActive).toBe(true);
      expect(response.body.lastSyncAt).toBeDefined();
    });
  });

  describe('Error Handling and Rate Limiting', () => {
    let integrationId: string;

    beforeEach(async () => {
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'MICROSOFT_CONTACTS',
          accessToken: 'encrypted-access-token',
          refreshToken: 'encrypted-refresh-token',
          expiresAt: new Date(Date.now() + 3600000),
          isActive: true,
        },
      });
      integrationId = integration.id;
    });

    it('should handle Microsoft Graph API rate limit errors', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: {
            code: 'activityLimitReached',
            message: 'Rate limit exceeded',
          },
        }),
      } as Response);

      await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(429);
    });

    it('should refresh expired tokens automatically', async () => {
      // Set expired token
      await prisma.integration.update({
        where: { id: integrationId },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      // Mock token refresh
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: 'new-access-token',
            expires_in: 3600,
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockMsftContactsResponse,
        } as Response);

      await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify token was refreshed
      const integration = await prisma.integration.findUnique({
        where: { id: integrationId },
      });
      expect(integration.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle network errors gracefully', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

      await request(app.getHttpServer())
        .get('/api/v1/integrations/microsoft/contacts/preview')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);
    });
  });
});
