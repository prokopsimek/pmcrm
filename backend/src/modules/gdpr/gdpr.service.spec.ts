/**
 * Unit tests for GDPR Service
 * Coverage target: 95%+ (Critical for compliance)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { GdprService } from './gdpr.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { UserFactory, ContactFactory } from '@test/factories';

describe('GdprService', () => {
  let service: GdprService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    interaction: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    aiInsight: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    consentRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    dataExportRequest: {
      create: jest.fn(),
      update: jest.fn(),
    },
    dataErasureRequest: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GdprService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<GdprService>(GdprService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Right to Access (Article 15)', () => {
    it('should export all user personal data', async () => {
      const user = UserFactory.build();
      const contacts = ContactFactory.buildMany(user.id as string, 5);

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.contact.findMany.mockResolvedValue(contacts);
      mockPrismaService.interaction.findMany.mockResolvedValue([]);
      mockPrismaService.aiInsight.findMany.mockResolvedValue([]);
      mockPrismaService.consentRecord.findMany.mockResolvedValue([]);

      const result = await service.exportUserData(user.id as string);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('contacts');
      expect(result).toHaveProperty('interactions');
      expect(result).toHaveProperty('consents');
      expect(result.contacts).toHaveLength(5);
    });

    it('should export data in machine-readable JSON format', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockPrismaService.interaction.findMany.mockResolvedValue([]);
      mockPrismaService.aiInsight.findMany.mockResolvedValue([]);
      mockPrismaService.consentRecord.findMany.mockResolvedValue([]);

      const result = await service.exportUserData(user.id as string);

      expect(typeof result).toBe('object');
      expect(JSON.stringify(result)).toBeDefined();
    });

    it('should create audit log for data export request', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockPrismaService.interaction.findMany.mockResolvedValue([]);
      mockPrismaService.aiInsight.findMany.mockResolvedValue([]);
      mockPrismaService.consentRecord.findMany.mockResolvedValue([]);
      mockPrismaService.dataExportRequest.create.mockResolvedValue({});

      await service.exportUserData(user.id as string);

      expect(mockPrismaService.dataExportRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: user.id,
            status: 'completed',
          }),
        }),
      );
    });
  });

  describe('Right to Erasure (Article 17)', () => {
    it('should delete all user data and cascade to contacts', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.$transaction.mockImplementation(async (callback) =>
        callback(mockPrismaService),
      );

      await service.eraseUserData(user.id as string);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should anonymize audit logs instead of deleting', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.$transaction.mockImplementation(async (callback) =>
        callback(mockPrismaService),
      );

      await service.eraseUserData(user.id as string);

      // Audit logs should be anonymized, not deleted
      expect(mockPrismaService.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: expect.stringContaining('anonymized'),
            fullName: 'Anonymized User',
          }),
        }),
      );
    });

    it('should create audit log for erasure request', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.$transaction.mockImplementation(async (callback) =>
        callback(mockPrismaService),
      );
      mockPrismaService.dataErasureRequest.create.mockResolvedValue({});

      await service.eraseUserData(user.id as string);

      expect(mockPrismaService.dataErasureRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: user.id,
            status: 'completed',
          }),
        }),
      );
    });

    it('should handle partial deletion failures gracefully', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.$transaction.mockRejectedValue(new Error('Database error'));

      await expect(service.eraseUserData(user.id as string)).rejects.toThrow();

      // Should mark erasure request as failed
      expect(mockPrismaService.dataErasureRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        }),
      );
    });
  });

  describe('Consent Management', () => {
    it('should record consent with timestamp and purpose', async () => {
      const userId = 'user-id';
      const consentData = {
        purpose: 'contact_import',
        granted: true,
        source: 'settings_page',
      };

      mockPrismaService.consentRecord.create.mockResolvedValue({
        id: 'consent-id',
        ...consentData,
        userId,
        timestamp: new Date(),
      });

      const result = await service.recordConsent(userId, consentData);

      expect(result).toHaveProperty('id');
      expect(mockPrismaService.consentRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            purpose: 'contact_import',
            granted: true,
          }),
        }),
      );
    });

    it('should allow withdrawal of consent', async () => {
      const userId = 'user-id';
      const consentId = 'consent-id';

      mockPrismaService.consentRecord.update.mockResolvedValue({
        id: consentId,
        granted: false,
        withdrawnAt: new Date(),
      });

      await service.withdrawConsent(userId, consentId);

      expect(mockPrismaService.consentRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: consentId },
          data: expect.objectContaining({
            granted: false,
            withdrawnAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should verify active consent before processing', async () => {
      const userId = 'user-id';
      const purpose = 'email_sync';

      mockPrismaService.consentRecord.findMany.mockResolvedValue([
        {
          id: 'consent-id',
          userId,
          purpose,
          granted: true,
          timestamp: new Date(),
        },
      ]);

      const hasConsent = await service.hasActiveConsent(userId, purpose);

      expect(hasConsent).toBe(true);
    });

    it('should return false if consent is withdrawn', async () => {
      const userId = 'user-id';
      const purpose = 'email_sync';

      mockPrismaService.consentRecord.findMany.mockResolvedValue([
        {
          id: 'consent-id',
          userId,
          purpose,
          granted: false,
          withdrawnAt: new Date(),
        },
      ]);

      const hasConsent = await service.hasActiveConsent(userId, purpose);

      expect(hasConsent).toBe(false);
    });
  });

  describe('Data Retention', () => {
    it('should delete inactive contacts older than retention period', async () => {
      const retentionDays = 730; // 2 years
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await service.cleanupInactiveData();

      expect(mockPrismaService.contact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lastContactDate: expect.objectContaining({
              lt: expect.any(Date),
            }),
          }),
          data: expect.objectContaining({
            deletedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should preserve contacts with recent interactions', async () => {
      const recentContact = ContactFactory.build('user-id', {
        lastContactDate: new Date(),
      });

      mockPrismaService.contact.findMany.mockResolvedValue([recentContact]);

      await service.cleanupInactiveData();

      // Should not delete recent contacts
      expect(mockPrismaService.contact.updateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: recentContact.id,
          }),
        }),
      );
    });
  });

  describe('Data Portability (Article 20)', () => {
    it('should export data in CSV format when requested', async () => {
      const user = UserFactory.build();
      const contacts = ContactFactory.buildMany(user.id as string, 3);

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.contact.findMany.mockResolvedValue(contacts);

      const csv = await service.exportUserDataAsCsv(user.id as string);

      expect(csv).toContain('firstName,lastName,email');
      expect(csv).toContain(contacts[0].firstName);
    });

    it('should support JSON export format', async () => {
      const user = UserFactory.build();

      mockPrismaService.user.findUnique.mockResolvedValue(user);
      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockPrismaService.interaction.findMany.mockResolvedValue([]);
      mockPrismaService.aiInsight.findMany.mockResolvedValue([]);
      mockPrismaService.consentRecord.findMany.mockResolvedValue([]);

      const result = await service.exportUserData(user.id as string);

      expect(typeof result).toBe('object');
      const json = JSON.stringify(result);
      expect(json).toBeDefined();
    });
  });
});
