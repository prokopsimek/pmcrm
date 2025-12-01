/**
 * Unit tests for EmailMatcherService
 * US-030: Email communication sync
 * TDD: RED phase - Tests written FIRST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EmailMatcherService } from './email-matcher.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { EmailMessage } from '../interfaces/email.interface';

describe('EmailMatcherService', () => {
  let service: EmailMatcherService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    contact: {
      findMany: jest.fn(),
    },
    emailSyncConfig: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailMatcherService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<EmailMatcherService>(EmailMatcherService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('matchEmailToContacts', () => {
    const sampleEmail: EmailMessage = {
      id: 'email-123',
      threadId: 'thread-456',
      from: { email: 'john@example.com', name: 'John Doe' },
      to: [{ email: 'user@example.com', name: 'User' }],
      cc: [{ email: 'jane@example.com', name: 'Jane Smith' }],
      subject: 'Test email',
      body: 'Email body',
      snippet: 'Email snippet',
      receivedAt: new Date(),
    };

    it('should match email participants to existing contacts', async () => {
      const mockContacts = [
        { id: 'contact-1', email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
        { id: 'contact-2', email: 'jane@example.com', firstName: 'Jane', lastName: 'Smith' },
      ];

      mockPrismaService.contact.findMany.mockResolvedValue(mockContacts);

      const result = await service.matchEmailToContacts('user-id', sampleEmail);

      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('contact-1');
      expect(result[1]?.id).toBe('contact-2');
      expect(mockPrismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          email: {
            in: expect.arrayContaining(['john@example.com', 'jane@example.com']),
          },
          deletedAt: null,
        },
      });
    });

    it('should extract all participant emails (from, to, cc)', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      await service.matchEmailToContacts('user-id', sampleEmail);

      expect(mockPrismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          email: {
            in: expect.arrayContaining(['john@example.com', 'jane@example.com']),
          },
          deletedAt: null,
        },
      });
    });

    it('should handle emails with no CC field', async () => {
      const emailWithoutCC: EmailMessage = {
        ...sampleEmail,
        cc: undefined,
      };

      mockPrismaService.contact.findMany.mockResolvedValue([]);

      await service.matchEmailToContacts('user-id', emailWithoutCC);

      expect(mockPrismaService.contact.findMany).toHaveBeenCalled();
    });

    it('should return empty array if no contacts match', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.matchEmailToContacts('user-id', sampleEmail);

      expect(result).toHaveLength(0);
    });

    it('should deduplicate email addresses', async () => {
      const emailWithDuplicates: EmailMessage = {
        ...sampleEmail,
        to: [
          { email: 'john@example.com', name: 'John' },
          { email: 'john@example.com', name: 'John Doe' },
        ],
      };

      mockPrismaService.contact.findMany.mockResolvedValue([]);

      await service.matchEmailToContacts('user-id', emailWithDuplicates);

      const callArgs = mockPrismaService.contact.findMany.mock.calls[0]?.[0];
      const emails = callArgs?.where?.email?.in as string[];
      const uniqueEmails = [...new Set(emails)];
      expect(emails.length).toBe(uniqueEmails.length);
    });

    it('should exclude user own email from matching', async () => {
      const emailFromUser: EmailMessage = {
        ...sampleEmail,
        from: { email: 'user@example.com', name: 'User' },
      };

      mockPrismaService.contact.findMany.mockResolvedValue([]);

      await service.matchEmailToContacts('user-id', emailFromUser, 'user@example.com');

      const callArgs = mockPrismaService.contact.findMany.mock.calls[0]?.[0];
      const emails = callArgs?.where?.email?.in as string[];
      expect(emails).not.toContain('user@example.com');
    });
  });

  describe('shouldExcludeEmail', () => {
    it('should exclude emails in exclusion list', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        excludedEmails: ['spam@example.com', 'marketing@example.com'],
        excludedDomains: [],
      });

      const result = await service.shouldExcludeEmail('user-id', 'spam@example.com');

      expect(result).toBe(true);
    });

    it('should exclude emails from excluded domains', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        excludedEmails: [],
        excludedDomains: ['spam.com', 'marketing.io'],
      });

      const result = await service.shouldExcludeEmail('user-id', 'anyone@spam.com');

      expect(result).toBe(true);
    });

    it('should not exclude emails not in exclusion list', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        excludedEmails: ['spam@example.com'],
        excludedDomains: ['spam.com'],
      });

      const result = await service.shouldExcludeEmail('user-id', 'valid@example.com');

      expect(result).toBe(false);
    });

    it('should handle case-insensitive email comparison', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue({
        excludedEmails: ['SPAM@EXAMPLE.COM'],
        excludedDomains: [],
      });

      const result = await service.shouldExcludeEmail('user-id', 'spam@example.com');

      expect(result).toBe(true);
    });

    it('should return false if no config exists', async () => {
      mockPrismaService.emailSyncConfig.findUnique.mockResolvedValue(null);

      const result = await service.shouldExcludeEmail('user-id', 'anyone@example.com');

      expect(result).toBe(false);
    });
  });

  describe('extractEmailAddresses', () => {
    it('should extract all unique email addresses from email', () => {
      const email: EmailMessage = {
        id: 'email-123',
        threadId: 'thread-456',
        from: { email: 'from@example.com' },
        to: [{ email: 'to1@example.com' }, { email: 'to2@example.com' }],
        cc: [{ email: 'cc1@example.com' }],
        subject: 'Test',
        body: 'Body',
        snippet: 'Snippet',
        receivedAt: new Date(),
      };

      const result = service.extractEmailAddresses(email);

      expect(result).toHaveLength(4);
      expect(result).toContain('from@example.com');
      expect(result).toContain('to1@example.com');
      expect(result).toContain('to2@example.com');
      expect(result).toContain('cc1@example.com');
    });

    it('should exclude specified email addresses', () => {
      const email: EmailMessage = {
        id: 'email-123',
        threadId: 'thread-456',
        from: { email: 'from@example.com' },
        to: [{ email: 'exclude@example.com' }, { email: 'include@example.com' }],
        subject: 'Test',
        body: 'Body',
        snippet: 'Snippet',
        receivedAt: new Date(),
      };

      const result = service.extractEmailAddresses(email, 'exclude@example.com');

      expect(result).toHaveLength(2);
      expect(result).not.toContain('exclude@example.com');
      expect(result).toContain('from@example.com');
      expect(result).toContain('include@example.com');
    });
  });
});
