/**
 * US-012: Manual Contact Addition - E2E Tests (TDD RED Phase)
 * End-to-end testing of complete contact creation flows
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/shared/database/prisma.service';
import { UserFactory, ContactFactory } from '@test/factories';
import { AuthHelper } from '@test/helpers';

describe('Contact Creation E2E - US-012', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authHelper: AuthHelper;
  let accessToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    prisma = app.get<PrismaService>(PrismaService);
    authHelper = new AuthHelper(app);

    await app.init();

    // Create test user and get auth token
    const user = await prisma.user.create({
      data: UserFactory.build(),
    });
    userId = user.id;
    accessToken = authHelper.generateToken(user);
  });

  afterAll(async () => {
    await prisma.contact.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  afterEach(async () => {
    await prisma.contact.deleteMany({ where: { userId } });
  });

  describe('POST /api/v1/contacts - Quick Add Flow', () => {
    it('should create contact with minimal data (name only)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'John',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.firstName).toBe('John');

      // Verify in database
      const contact = await prisma.contact.findUnique({
        where: { id: response.body.id },
      });
      expect(contact).toBeDefined();
      expect(contact?.userId).toBe(userId);
    });

    it('should create contact with all quick-add fields', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          phone: '+14155552671',
          company: 'Acme Corp',
          notes: 'Met at conference',
        })
        .expect(201);

      expect(response.body.email).toBe('jane.smith@example.com');
      expect(response.body.phone).toBe('+14155552671');
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'John',
          email: 'invalid-email',
        })
        .expect(400);
    });

    it('should reject invalid phone format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'John',
          phone: '123',
        })
        .expect(400);
    });

    it('should accept valid E.164 phone format', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Bob',
          phone: '+14155552222',
        })
        .expect(201);

      expect(response.body.phone).toBe('+14155552222');
    });

    it('should create contact with tags', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Alice',
          tags: ['Client', 'High Priority'],
        })
        .expect(201);

      // Verify tags were created
      const contactTags = await prisma.contactTag.findMany({
        where: { contactId: response.body.id },
        include: { tag: true },
      });

      expect(contactTags).toHaveLength(2);
      expect(contactTags.map((ct) => ct.tag.name)).toContain('Client');
    });

    it('should create contact with reminder frequency', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Charlie',
          contactFrequencyDays: 30,
        })
        .expect(201);

      expect(response.body.contactFrequencyDays).toBe(30);
    });

    it('should reject frequency outside 1-365 range', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Test',
          contactFrequencyDays: 400,
        })
        .expect(400);
    });

    it('should create contact with meeting context', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'David',
          meetingContext: {
            location: 'Starbucks on Market St',
            when: '2025-11-29T10:00:00Z',
            topic: 'Discussed partnership opportunities',
          },
        })
        .expect(201);

      // Verify interaction was created
      const interactions = await prisma.interaction.findMany({
        where: { userId },
        include: { participants: true },
      });

      expect(interactions.length).toBeGreaterThan(0);
      const meeting = interactions.find((i) => i.interactionType === 'meeting');
      expect(meeting).toBeDefined();
      expect(meeting?.summary).toBe('Discussed partnership opportunities');
    });

    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .send({
          firstName: 'Test',
        })
        .expect(401);
    });
  });

  describe('POST /api/v1/contacts/business-card - OCR Flow', () => {
    it('should parse business card and create contact', async () => {
      const fakeImageData = Buffer.from('fake-business-card-image').toString('base64');

      const parseResponse = await request(app.getHttpServer())
        .post('/api/v1/contacts/business-card')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          imageData: fakeImageData,
          mimeType: 'image/jpeg',
        })
        .expect(200);

      expect(parseResponse.body).toHaveProperty('rawText');
      expect(parseResponse.body).toHaveProperty('confidence');

      // If confidence is high enough, create contact
      if (parseResponse.body.firstName) {
        const createResponse = await request(app.getHttpServer())
          .post('/api/v1/contacts')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            firstName: parseResponse.body.firstName,
            lastName: parseResponse.body.lastName,
            email: parseResponse.body.email,
            phone: parseResponse.body.phone,
            company: parseResponse.body.company,
          })
          .expect(201);

        expect(createResponse.body.firstName).toBe(parseResponse.body.firstName);
      }
    });

    it('should reject unsupported image format', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/contacts/business-card')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          imageData: 'fake-data',
          mimeType: 'image/gif',
        })
        .expect(400);
    });

    it('should reject images larger than 5MB', async () => {
      const largeImage = Buffer.alloc(6 * 1024 * 1024, 'x').toString('base64');

      await request(app.getHttpServer())
        .post('/api/v1/contacts/business-card')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          imageData: largeImage,
          mimeType: 'image/jpeg',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/organizations/autocomplete - Company Autocomplete', () => {
    beforeEach(async () => {
      // Create test organizations
      await prisma.organization.createMany({
        data: [
          { userId, name: 'Acme Corporation' },
          { userId, name: 'ACME Industries' },
          { userId, name: 'Acme Labs' },
          { userId, name: 'TechCorp' },
        ],
      });
    });

    it('should return matching companies', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/autocomplete')
        .query({ q: 'Acme' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(3);
      expect(response.body.every((org: any) => org.name.includes('Acme'))).toBe(true);
    });

    it('should return empty array for no matches', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/autocomplete')
        .query({ q: 'NonExistent' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should limit results to 10 items', async () => {
      // Create many organizations
      const orgs = Array.from({ length: 20 }, (_, i) => ({
        userId,
        name: `Company ${i}`,
      }));
      await prisma.organization.createMany({ data: orgs });

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/autocomplete')
        .query({ q: 'Company' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should respond in under 100ms', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/organizations/autocomplete')
        .query({ q: 'Acme' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(100);
    });

    it('should only return user-owned organizations', async () => {
      // Create organization for different user
      const otherUser = await prisma.user.create({
        data: UserFactory.build(),
      });
      await prisma.organization.create({
        data: { userId: otherUser.id, name: 'Other User Acme' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations/autocomplete')
        .query({ q: 'Acme' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.every((org: any) => org.userId === userId)).toBe(true);

      await prisma.organization.deleteMany({ where: { userId: otherUser.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('POST /api/v1/contacts/:id/enrich/linkedin - LinkedIn Enrichment', () => {
    it('should enrich contact with LinkedIn data', async () => {
      const contact = await prisma.contact.create({
        data: ContactFactory.build(userId, {
          firstName: 'John',
          linkedinUrl: 'https://linkedin.com/in/johndoe',
        }),
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/contacts/${contact.id}/enrich/linkedin`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          linkedinUrl: 'https://linkedin.com/in/johndoe',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success');

      // Verify enrichment data was saved
      const enrichedContact = await prisma.contact.findUnique({
        where: { id: contact.id },
      });

      expect(enrichedContact?.enrichmentLastUpdate).toBeDefined();
    });

    it('should not allow enriching other users contacts', async () => {
      const otherUser = await prisma.user.create({
        data: UserFactory.build(),
      });
      const otherContact = await prisma.contact.create({
        data: ContactFactory.build(otherUser.id),
      });

      await request(app.getHttpServer())
        .post(`/api/v1/contacts/${otherContact.id}/enrich/linkedin`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          linkedinUrl: 'https://linkedin.com/in/test',
        })
        .expect(404);

      await prisma.contact.delete({ where: { id: otherContact.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('GET /api/v1/contacts/check-duplicate - Duplicate Prevention', () => {
    beforeEach(async () => {
      await prisma.contact.create({
        data: ContactFactory.build(userId, {
          firstName: 'Existing',
          email: 'existing@example.com',
        }),
      });
    });

    it('should detect duplicate by email', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/check-duplicate')
        .query({ email: 'existing@example.com' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.isDuplicate).toBe(true);
      expect(response.body.existingContact).toBeDefined();
      expect(response.body.existingContact.email).toBe('existing@example.com');
    });

    it('should detect duplicate by phone', async () => {
      await prisma.contact.create({
        data: ContactFactory.build(userId, {
          phone: '+14155552222',
        }),
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/check-duplicate')
        .query({ phone: '+14155552222' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.isDuplicate).toBe(true);
    });

    it('should return no duplicate for new contact', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/contacts/check-duplicate')
        .query({ email: 'new@example.com' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.isDuplicate).toBe(false);
      expect(response.body.existingContact).toBeUndefined();
    });
  });

  describe('Complete Contact Creation Flow', () => {
    it('should complete full workflow: check duplicate -> create -> assign tags -> set reminder', async () => {
      // Step 1: Check for duplicate
      const duplicateCheck = await request(app.getHttpServer())
        .get('/api/v1/contacts/check-duplicate')
        .query({ email: 'workflow@example.com' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(duplicateCheck.body.isDuplicate).toBe(false);

      // Step 2: Create contact
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'Workflow',
          lastName: 'Test',
          email: 'workflow@example.com',
          phone: '+14155559999',
          company: 'Test Corp',
          tags: ['Client', 'VIP'],
          contactFrequencyDays: 14,
          meetingContext: {
            location: 'Office',
            when: new Date().toISOString(),
            topic: 'Initial meeting',
          },
        })
        .expect(201);

      const contactId = createResponse.body.id;

      // Step 3: Verify everything was created
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          contactTags: {
            include: { tag: true },
          },
        },
      });

      expect(contact).toBeDefined();
      expect(contact?.contactFrequencyDays).toBe(14);
      expect(contact?.contactTags.length).toBe(2);

      const interaction = await prisma.interaction.findFirst({
        where: {
          userId,
          interactionType: 'meeting',
        },
      });

      expect(interaction).toBeDefined();
      expect(interaction?.summary).toBe('Initial meeting');
    });
  });
});
