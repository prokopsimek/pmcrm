/**
 * Integration tests for Contacts module
 * Tests database interactions with real Prisma client
 */
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { ContactsService } from '@/modules/contacts/contacts.service';
import { UserFactory, ContactFactory } from '@test/factories';
import { TestDbHelper } from '@test/helpers';

describe('ContactsService Integration', () => {
  let service: ContactsService;
  let prisma: PrismaService;
  let testUser: any;

  beforeAll(async () => {
    prisma = await TestDbHelper.initialize();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  beforeEach(async () => {
    await TestDbHelper.truncateAllTables();
    testUser = await TestDbHelper.seedTestUser();
  });

  afterAll(async () => {
    await TestDbHelper.cleanup();
  });

  describe('create and retrieve', () => {
    it('should persist contact to database', async () => {
      const contactData = ContactFactory.build(testUser.id);

      const created = await service.create(testUser.id, contactData);

      expect(created).toHaveProperty('id');
      expect(created.firstName).toBe(contactData.firstName);

      // Verify persistence
      const retrieved = await service.findOne(testUser.id, created.id);
      expect(retrieved.id).toBe(created.id);
    });

    it('should enforce unique email per user', async () => {
      const email = 'unique@example.com';

      await service.create(testUser.id, {
        firstName: 'First',
        lastName: 'Contact',
        email,
      });

      // Attempting to create another contact with same email should handle gracefully
      await expect(
        service.create(testUser.id, {
          firstName: 'Second',
          lastName: 'Contact',
          email,
        }),
      ).rejects.toThrow();
    });
  });

  describe('search and filtering', () => {
    beforeEach(async () => {
      // Create test contacts
      await ContactFactory.create(prisma, testUser.id, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
      });
      await ContactFactory.create(prisma, testUser.id, {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
      });
      await ContactFactory.create(prisma, testUser.id, {
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
      });
    });

    it('should search contacts by name', async () => {
      const result = await service.findAll(testUser.id, {
        search: 'john',
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.some((c) => c.firstName.toLowerCase().includes('john'))).toBe(true);
    });

    it('should search contacts by email', async () => {
      const result = await service.findAll(testUser.id, {
        search: 'jane.smith',
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].email).toContain('jane.smith');
    });

    it('should paginate results correctly', async () => {
      const page1 = await service.findAll(testUser.id, {
        page: 1,
        limit: 2,
      });

      expect(page1.data).toHaveLength(2);
      expect(page1.total).toBe(3);
      expect(page1.hasMore).toBe(true);

      const page2 = await service.findAll(testUser.id, {
        page: 2,
        limit: 2,
      });

      expect(page2.data).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe('relationship strength updates', () => {
    it('should update relationship strength based on interactions', async () => {
      const contact = await ContactFactory.create(prisma, testUser.id, {
        relationshipStrength: 5,
      });

      // Simulate interaction that increases strength
      await service.updateRelationshipStrength(testUser.id, contact.id, 7);

      const updated = await service.findOne(testUser.id, contact.id);
      expect(updated.relationshipStrength).toBe(7);
    });

    it('should decay relationship strength over time', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90); // 90 days ago

      const contact = await ContactFactory.create(prisma, testUser.id, {
        relationshipStrength: 8,
        lastContactDate: oldDate,
      });

      await service.applyRelationshipDecay(testUser.id);

      const updated = await service.findOne(testUser.id, contact.id);
      expect(updated.relationshipStrength).toBeLessThan(8);
    });
  });

  describe('bulk operations', () => {
    it('should import multiple contacts in single transaction', async () => {
      const contacts = ContactFactory.buildMany(testUser.id, 50);

      const imported = await service.bulkImport(testUser.id, contacts);

      expect(imported).toHaveLength(50);

      const allContacts = await service.findAll(testUser.id, { limit: 100 });
      expect(allContacts.total).toBe(50);
    });

    it('should rollback transaction on error during bulk import', async () => {
      const contacts = ContactFactory.buildMany(testUser.id, 10);

      // Add invalid contact that will cause error
      contacts.push({
        firstName: null, // Invalid
        lastName: 'Test',
        userId: testUser.id,
      } as any);

      await expect(service.bulkImport(testUser.id, contacts)).rejects.toThrow();

      // Verify no contacts were imported
      const allContacts = await service.findAll(testUser.id, {});
      expect(allContacts.total).toBe(0);
    });
  });

  describe('soft delete', () => {
    it('should mark contact as deleted without removing from database', async () => {
      const contact = await ContactFactory.create(prisma, testUser.id);

      await service.delete(testUser.id, contact.id);

      // Should not be returned in normal queries
      const contacts = await service.findAll(testUser.id, {});
      expect(contacts.data.find((c) => c.id === contact.id)).toBeUndefined();

      // Should still exist in database with deletedAt timestamp
      const deleted = await prisma.contact.findUnique({
        where: { id: contact.id },
      });
      expect(deleted).toBeDefined();
      expect(deleted.deletedAt).toBeDefined();
    });
  });

  describe('tenant isolation', () => {
    it('should not allow access to other users contacts', async () => {
      const otherUser = await TestDbHelper.seedTestUser({
        email: 'other@example.com',
      });
      const otherContact = await ContactFactory.create(prisma, otherUser.id);

      await expect(service.findOne(testUser.id, otherContact.id)).rejects.toThrow();
    });

    it('should only return contacts for authenticated user', async () => {
      const otherUser = await TestDbHelper.seedTestUser({
        email: 'other@example.com',
      });

      await ContactFactory.createMany(prisma, testUser.id, 5);
      await ContactFactory.createMany(prisma, otherUser.id, 3);

      const result = await service.findAll(testUser.id, {});

      expect(result.total).toBe(5);
      expect(result.data.every((c) => c.userId === testUser.id)).toBe(true);
    });
  });
});
