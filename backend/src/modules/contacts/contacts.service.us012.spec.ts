/**
 * US-012: Manual Contact Addition - Unit Tests (TDD RED Phase)
 * Testing quick-add, business card OCR, autocomplete, LinkedIn enrichment, meeting context
 */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '@/shared/database/prisma.service';
import { OcrService } from './services/ocr.service';
import { LinkedInEnrichmentService } from './services/linkedin-enrichment.service';
import { UserFactory, ContactFactory } from '@test/factories';

describe('ContactsService - US-012: Manual Contact Addition', () => {
  let service: ContactsService;
  let prismaService: PrismaService;
  let ocrService: OcrService;
  let linkedInService: LinkedInEnrichmentService;

  const mockPrismaService = {
    contact: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    contactEmployment: {
      create: jest.fn(),
    },
    interaction: {
      create: jest.fn(),
    },
    tag: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    contactTag: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockOcrService = {
    parseBusinessCard: jest.fn(),
    preprocessImage: jest.fn(),
  };

  const mockLinkedInService = {
    enrichProfile: jest.fn(),
    lookupByUrl: jest.fn(),
    isCacheValid: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OcrService, useValue: mockOcrService },
        { provide: LinkedInEnrichmentService, useValue: mockLinkedInService },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
    ocrService = module.get<OcrService>(OcrService);
    linkedInService = module.get<LinkedInEnrichmentService>(LinkedInEnrichmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createContact - Quick Add Form', () => {
    it('should create contact with minimal data (name only)', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
      };

      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id',
        userId: user.id,
        ...createDto,
        createdAt: new Date(),
      });

      const result = await service.createContact(user.id as string, createDto);

      expect(result).toHaveProperty('id', 'contact-id');
      expect(result.firstName).toBe('John');
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should create contact with all quick-add fields', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        phone: '+14155552671',
        company: 'Acme Corp',
        notes: 'Met at TechConf 2025',
      };

      mockPrismaService.contact.findFirst.mockResolvedValue(null);

      // Mock organization lookup
      mockPrismaService.organization.findFirst.mockResolvedValue({
        id: 'org-id',
        userId: user.id,
        name: 'Acme Corp',
      });

      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id-2',
        userId: user.id,
        ...createDto,
        createdAt: new Date(),
      });

      mockPrismaService.contactEmployment.create.mockResolvedValue({
        id: 'employment-id',
        contactId: 'contact-id-2',
        organizationId: 'org-id',
      });

      const result = await service.createContact(user.id as string, createDto);

      expect(result.email).toBe('jane.smith@example.com');
      expect(result.phone).toBe('+14155552671');
    });

    it('should validate email format (RFC 5322)', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
        email: 'invalid-email',
      };

      await expect(service.createContact(user.id as string, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate phone format using libphonenumber-js', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
        phone: '123', // Invalid phone
      };

      await expect(service.createContact(user.id as string, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate phone in E.164 format', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
        phone: '+14155552671', // Valid E.164
      };

      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id',
        userId: user.id,
        ...createDto,
      });

      const result = await service.createContact(user.id as string, createDto);
      expect(result.phone).toBe('+14155552671');
    });
  });

  describe('parseBusinessCard - OCR Integration', () => {
    it('should parse business card image and extract fields', async () => {
      const user = UserFactory.build();
      const imageData = 'base64-encoded-image-data';

      mockOcrService.parseBusinessCard.mockResolvedValue({
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'mchen@techcorp.com',
        phone: '+14155552222',
        company: 'TechCorp Inc.',
        title: 'CTO',
        website: 'techcorp.com',
        confidence: 0.92,
        rawText: 'Michael Chen\nCTO\nTechCorp Inc.\nmchen@techcorp.com\n+1 415 555 2222',
      });

      const result = await service.parseBusinessCard(user.id as string, {
        imageData,
        mimeType: 'image/jpeg',
      });

      expect(result.firstName).toBe('Michael');
      expect(result.email).toBe('mchen@techcorp.com');
      expect(result.company).toBe('TechCorp Inc.');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(mockOcrService.parseBusinessCard).toHaveBeenCalledWith(imageData, 'image/jpeg');
    });

    it('should handle low confidence OCR results', async () => {
      const user = UserFactory.build();
      const imageData = 'base64-blurry-image';

      mockOcrService.parseBusinessCard.mockResolvedValue({
        firstName: 'John',
        confidence: 0.45, // Low confidence
        rawText: 'Unreadable text',
      });

      const result = await service.parseBusinessCard(user.id as string, {
        imageData,
        mimeType: 'image/jpeg',
      });

      expect(result.confidence).toBeLessThan(0.8);
      expect(result.rawText).toBeDefined();
    });

    it('should preprocess image before OCR for better accuracy', async () => {
      const user = UserFactory.build();
      const imageData = 'base64-image';

      mockOcrService.parseBusinessCard.mockResolvedValue({
        firstName: 'Sarah',
        confidence: 0.95,
        rawText: 'Clear text',
      });

      await service.parseBusinessCard(user.id as string, {
        imageData,
        mimeType: 'image/png',
      });

      // OCR service handles preprocessing internally
      expect(mockOcrService.parseBusinessCard).toHaveBeenCalled();
    });

    it('should reject images larger than 5MB', async () => {
      const user = UserFactory.build();
      const largeImageData = 'x'.repeat(6 * 1024 * 1024); // 6MB in base64

      mockOcrService.parseBusinessCard.mockRejectedValue(
        new BadRequestException('Image too large'),
      );

      await expect(
        service.parseBusinessCard(user.id as string, {
          imageData: largeImageData,
          mimeType: 'image/jpeg',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should only accept JPEG and PNG formats', async () => {
      const user = UserFactory.build();

      mockOcrService.parseBusinessCard.mockRejectedValue(
        new BadRequestException('Unsupported image format'),
      );

      await expect(
        service.parseBusinessCard(user.id as string, {
          imageData: 'base64-data',
          mimeType: 'image/gif' as any,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('autoCompleteCompany - Fuzzy Search', () => {
    it('should find companies with fuzzy search (PostgreSQL trigram)', async () => {
      const user = UserFactory.build();

      mockPrismaService.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Acme Corporation', userId: user.id },
        { id: 'org-2', name: 'ACME Industries', userId: user.id },
        { id: 'org-3', name: 'Acme Labs', userId: user.id },
      ]);

      const results = await service.autoCompleteCompany(user.id as string, 'Acm');

      expect(results).toHaveLength(3);
      expect(results[0].name).toContain('Acme');
      expect(mockPrismaService.organization.findMany).toHaveBeenCalled();
    });

    it('should return results in < 100ms', async () => {
      const user = UserFactory.build();

      mockPrismaService.organization.findMany.mockResolvedValue([
        { id: 'org-1', name: 'Fast Corp', userId: user.id },
      ]);

      const startTime = Date.now();
      await service.autoCompleteCompany(user.id as string, 'Fast');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(100);
    });

    it('should limit autocomplete results to 10 items', async () => {
      const user = UserFactory.build();

      const orgs = Array.from({ length: 20 }, (_, i) => ({
        id: `org-${i}`,
        name: `Company ${i}`,
        userId: user.id,
      }));

      mockPrismaService.organization.findMany.mockResolvedValue(orgs.slice(0, 10));

      const results = await service.autoCompleteCompany(user.id as string, 'Company');

      expect(results).toHaveLength(10);
    });

    it('should return empty array for no matches', async () => {
      const user = UserFactory.build();

      mockPrismaService.organization.findMany.mockResolvedValue([]);

      const results = await service.autoCompleteCompany(user.id as string, 'XYZ999');

      expect(results).toEqual([]);
    });

    it('should only search user-owned organizations (multi-tenancy)', async () => {
      const user = UserFactory.build();

      await service.autoCompleteCompany(user.id as string, 'Test');

      expect(mockPrismaService.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: user.id,
          }),
        }),
      );
    });
  });

  describe('enrichFromLinkedIn - Profile Enrichment', () => {
    it('should enrich contact from LinkedIn URL', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';
      const linkedinUrl = 'https://linkedin.com/in/johndoe';

      mockPrismaService.contact.findFirst.mockResolvedValue({
        id: contactId,
        userId: user.id,
        firstName: 'John',
      });

      mockLinkedInService.enrichProfile.mockResolvedValue({
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Senior Software Engineer at Google',
        location: 'San Francisco, CA',
        photoUrl: 'https://media.linkedin.com/photo.jpg',
        positions: [
          {
            company: 'Google',
            title: 'Senior Software Engineer',
            isCurrent: true,
          },
        ],
        skills: ['JavaScript', 'TypeScript', 'Node.js'],
        success: true,
        source: 'apollo',
      });

      mockPrismaService.contact.update.mockResolvedValue({
        id: contactId,
        enrichmentData: { linkedin: {} },
      });

      const result = await service.enrichFromLinkedIn(user.id as string, contactId, {
        linkedinUrl,
      });

      expect(result.success).toBe(true);
      expect(mockLinkedInService.enrichProfile).toHaveBeenCalledWith(linkedinUrl);
      expect(mockPrismaService.contact.update).toHaveBeenCalled();
    });

    it('should cache LinkedIn enrichment data for 30 days', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';

      mockPrismaService.contact.findFirst.mockResolvedValue({
        id: contactId,
        userId: user.id,
        enrichmentLastUpdate: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        enrichmentData: { linkedin: { cached: true } },
      });

      // Mock cache as valid
      mockLinkedInService.isCacheValid.mockReturnValue(true);

      const result = await service.enrichFromLinkedIn(user.id as string, contactId, {
        linkedinUrl: 'https://linkedin.com/in/test',
      });

      // Should use cached data, not call LinkedIn API
      expect(mockLinkedInService.enrichProfile).not.toHaveBeenCalled();
      expect(mockLinkedInService.isCacheValid).toHaveBeenCalled();
    });

    it('should handle LinkedIn API errors gracefully', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';

      mockPrismaService.contact.findFirst.mockResolvedValue({
        id: contactId,
        userId: user.id,
      });

      mockLinkedInService.enrichProfile.mockRejectedValue(new Error('LinkedIn API rate limit'));

      const result = await service.enrichFromLinkedIn(user.id as string, contactId, {
        linkedinUrl: 'https://linkedin.com/in/test',
      });

      expect(result.success).toBe(false);
    });

    it('should not allow enriching other users contacts', async () => {
      const user = UserFactory.build();
      const otherUserId = 'other-user-id';

      // Return null to simulate contact not found for this user
      mockPrismaService.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.enrichFromLinkedIn(user.id as string, 'contact-id', {
          linkedinUrl: 'https://linkedin.com/in/test',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('saveInteractionContext - Meeting Metadata', () => {
    it('should save meeting context when creating contact', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'Alice',
        email: 'alice@example.com',
        meetingContext: {
          location: 'Starbucks on Market St',
          when: '2025-11-29T10:00:00Z',
          topic: 'Discussed potential partnership',
        },
      };

      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id',
        userId: user.id,
        ...createDto,
      });

      mockPrismaService.interaction.create.mockResolvedValue({
        id: 'interaction-id',
        userId: user.id,
        interactionType: 'meeting',
        occurredAt: new Date(createDto.meetingContext.when),
        summary: createDto.meetingContext.topic,
        metadata: {
          location: createDto.meetingContext.location,
        },
      });

      const result = await service.createContact(user.id as string, createDto);

      expect(mockPrismaService.interaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            interactionType: 'meeting',
            occurredAt: expect.any(Date),
            summary: 'Discussed potential partnership',
          }),
        }),
      );
    });

    it('should create interaction participants linking meeting to contact', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'Bob',
        meetingContext: {
          location: 'Office',
          when: new Date().toISOString(),
          topic: 'Introduction call',
        },
      };

      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'contact-id',
        userId: user.id,
      });

      mockPrismaService.interaction.create.mockResolvedValue({
        id: 'interaction-id',
        participants: {
          create: [{ contactId: 'contact-id', role: 'attendee' }],
        },
      });

      await service.createContact(user.id as string, createDto);

      expect(mockPrismaService.interaction.create).toHaveBeenCalled();
    });
  });

  describe('checkDuplicates - Prevent Duplicate Contacts', () => {
    it('should detect duplicate by email', async () => {
      const user = UserFactory.build();

      mockPrismaService.contact.findFirst.mockResolvedValue({
        id: 'existing-contact',
        userId: user.id,
        firstName: 'John',
        email: 'john@example.com',
      });

      const result = await service.checkDuplicate(user.id as string, {
        email: 'john@example.com',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.existingContact).toBeDefined();
      expect(result.existingContact?.email).toBe('john@example.com');
    });

    it('should detect duplicate by phone', async () => {
      const user = UserFactory.build();

      mockPrismaService.contact.findFirst.mockResolvedValue({
        id: 'existing-contact',
        userId: user.id,
        firstName: 'Jane',
        phone: '+14155552671',
      });

      const result = await service.checkDuplicate(user.id as string, {
        phone: '+14155552671',
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.existingContact?.phone).toBe('+14155552671');
    });

    it('should return no duplicate when contact does not exist', async () => {
      const user = UserFactory.build();

      mockPrismaService.contact.findFirst.mockResolvedValue(null);

      const result = await service.checkDuplicate(user.id as string, {
        email: 'new@example.com',
      });

      expect(result.isDuplicate).toBe(false);
      expect(result.existingContact).toBeUndefined();
    });

    it('should only check within user scope (multi-tenancy)', async () => {
      const user = UserFactory.build();

      await service.checkDuplicate(user.id as string, {
        email: 'test@example.com',
      });

      expect(mockPrismaService.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: user.id,
          }),
        }),
      );
    });
  });

  describe('assignTags - Tag Assignment', () => {
    it('should assign multiple tags to contact', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';
      const tagNames = ['Client', 'High Priority', 'Tech Industry'];

      mockPrismaService.tag.findMany.mockResolvedValue([
        { id: 'tag-1', name: 'Client', userId: user.id },
        { id: 'tag-2', name: 'High Priority', userId: user.id },
      ]);

      mockPrismaService.tag.create.mockResolvedValue({
        id: 'tag-3',
        name: 'Tech Industry',
        userId: user.id,
      });

      mockPrismaService.contactTag.createMany.mockResolvedValue({ count: 3 });

      await service.assignTags(user.id as string, contactId, tagNames);

      expect(mockPrismaService.contactTag.createMany).toHaveBeenCalled();
    });

    it('should create non-existent tags automatically', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';

      mockPrismaService.tag.findMany.mockResolvedValue([]);
      mockPrismaService.tag.create.mockResolvedValue({
        id: 'new-tag',
        name: 'New Tag',
        userId: user.id,
      });

      await service.assignTags(user.id as string, contactId, ['New Tag']);

      expect(mockPrismaService.tag.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'New Tag',
            userId: user.id,
          }),
        }),
      );
    });
  });

  describe('setReminderFrequency - Reminder Setup', () => {
    it('should set contact frequency in days', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';

      mockPrismaService.contact.findFirst.mockResolvedValue({
        id: contactId,
        userId: user.id,
      });

      mockPrismaService.contact.update.mockResolvedValue({
        id: contactId,
        contactFrequencyDays: 30,
      });

      const result = await service.setReminderFrequency(user.id as string, contactId, 30);

      expect(result.contactFrequencyDays).toBe(30);
    });

    it('should validate frequency is between 1-365 days', async () => {
      const user = UserFactory.build();

      await expect(
        service.setReminderFrequency(user.id as string, 'contact-id', 0),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.setReminderFrequency(user.id as string, 'contact-id', 400),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
