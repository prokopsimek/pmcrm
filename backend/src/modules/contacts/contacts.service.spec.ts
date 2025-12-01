/**
 * Unit tests for ContactsService
 * Coverage target: 85%+
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { ContactFactory, UserFactory } from '@test/factories';

describe('ContactsService', () => {
  let service: ContactsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    contact: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a contact successfully', async () => {
      const user = UserFactory.build();
      const contactData = ContactFactory.build(user.id as string);

      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id',
        ...contactData,
      });

      const result = await service.create(user.id as string, {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
      });

      expect(result).toHaveProperty('id', 'contact-id');
      expect(result.firstName).toBe(contactData.firstName);
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should enforce subscription limits for free tier', async () => {
      const user = UserFactory.build({ subscriptionTier: 'free' });

      mockPrismaService.contact.count.mockResolvedValue(250); // At limit

      await expect(
        service.create(user.id as string, {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow unlimited contacts for pro tier', async () => {
      const user = UserFactory.build({ subscriptionTier: 'pro' });
      const contactData = ContactFactory.build(user.id as string);

      mockPrismaService.contact.count.mockResolvedValue(1000);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id',
        ...contactData,
      });

      const result = await service.create(user.id as string, {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
      });

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return paginated contacts for user', async () => {
      const user = UserFactory.build();
      const contacts = ContactFactory.buildMany(user.id as string, 10);

      mockPrismaService.contact.findMany.mockResolvedValue(contacts);
      mockPrismaService.contact.count.mockResolvedValue(10);

      const result = await service.findAll(user.id as string, {
        page: 1,
        limit: 10,
      });

      expect(result.data).toHaveLength(10);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
    });

    it('should filter contacts by search query', async () => {
      const user = UserFactory.build();

      mockPrismaService.contact.findMany.mockResolvedValue([]);

      await service.findAll(user.id as string, {
        search: 'john',
      });

      expect(mockPrismaService.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        }),
      );
    });

    it('should sort contacts by relationship strength', async () => {
      const user = UserFactory.build();

      await service.findAll(user.id as string, {
        sortBy: 'relationshipStrength',
        sortOrder: 'desc',
      });

      expect(mockPrismaService.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { relationshipStrength: 'desc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return contact if user owns it', async () => {
      const user = UserFactory.build();
      const contact = ContactFactory.build(user.id as string);

      mockPrismaService.contact.findUnique.mockResolvedValue({
        id: 'contact-id',
        ...contact,
      });

      const result = await service.findOne(user.id as string, 'contact-id');

      expect(result).toBeDefined();
      expect(result.userId).toBe(user.id);
    });

    it('should throw NotFoundException if contact not found', async () => {
      mockPrismaService.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('user-id', 'non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user does not own contact', async () => {
      const contact = ContactFactory.build('other-user-id');

      mockPrismaService.contact.findUnique.mockResolvedValue({
        id: 'contact-id',
        ...contact,
      });

      await expect(service.findOne('different-user-id', 'contact-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    it('should update contact successfully', async () => {
      const user = UserFactory.build();
      const contact = ContactFactory.build(user.id as string);

      mockPrismaService.contact.findUnique.mockResolvedValue({
        id: 'contact-id',
        ...contact,
      });
      mockPrismaService.contact.update.mockResolvedValue({
        id: 'contact-id',
        ...contact,
        firstName: 'Updated',
      });

      const result = await service.update(user.id as string, 'contact-id', {
        firstName: 'Updated',
      });

      expect(result.firstName).toBe('Updated');
    });

    it('should not allow updating userId', async () => {
      const user = UserFactory.build();
      const contact = ContactFactory.build(user.id as string);

      mockPrismaService.contact.findUnique.mockResolvedValue({
        id: 'contact-id',
        ...contact,
      });

      await service.update(user.id as string, 'contact-id', {
        firstName: 'Updated',
        userId: 'malicious-user-id', // Should be ignored
      } as any);

      expect(mockPrismaService.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            userId: 'malicious-user-id',
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should soft delete contact', async () => {
      const user = UserFactory.build();
      const contact = ContactFactory.build(user.id as string);

      mockPrismaService.contact.findUnique.mockResolvedValue({
        id: 'contact-id',
        ...contact,
      });
      mockPrismaService.contact.update.mockResolvedValue({
        id: 'contact-id',
        ...contact,
        deletedAt: new Date(),
      });

      await service.delete(user.id as string, 'contact-id');

      expect(mockPrismaService.contact.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('bulkImport', () => {
    it('should import multiple contacts in transaction', async () => {
      const user = UserFactory.build();
      const contacts = ContactFactory.buildMany(user.id as string, 5);

      mockPrismaService.$transaction.mockResolvedValue(
        contacts.map((c, i) => ({ id: `contact-${i}`, ...c })),
      );

      const result = await service.bulkImport(user.id as string, contacts);

      expect(result).toHaveLength(5);
      expect(mockPrismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should skip duplicate emails during bulk import', async () => {
      const user = UserFactory.build();
      const contacts = [
        ContactFactory.build(user.id as string, { email: 'same@example.com' }),
        ContactFactory.build(user.id as string, { email: 'same@example.com' }),
      ];

      mockPrismaService.$transaction.mockImplementation(async (callback) =>
        callback(mockPrismaService),
      );

      const result = await service.bulkImport(user.id as string, contacts);

      // Should deduplicate by email
      expect(result.length).toBeLessThan(contacts.length);
    });
  });
});
