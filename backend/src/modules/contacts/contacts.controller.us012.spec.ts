/**
 * US-012: Manual Contact Addition - Controller Tests (TDD RED Phase)
 * Testing API endpoints for quick-add, OCR, autocomplete, enrichment
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { UserFactory } from '@test/factories';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('ContactsController - US-012: Manual Contact Addition', () => {
  let controller: ContactsController;
  let service: ContactsService;

  const mockContactsService = {
    createContact: jest.fn(),
    parseBusinessCard: jest.fn(),
    autoCompleteCompany: jest.fn(),
    enrichFromLinkedIn: jest.fn(),
    checkDuplicate: jest.fn(),
    assignTags: jest.fn(),
    setReminderFrequency: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactsController],
      providers: [{ provide: ContactsService, useValue: mockContactsService }],
    }).compile();

    controller = module.get<ContactsController>(ContactsController);
    service = module.get<ContactsService>(ContactsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/contacts - Create Contact', () => {
    it('should create contact with authenticated user', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.createContact.mockResolvedValue({
        id: 'contact-id',
        ...createDto,
      });

      const result = await controller.create(mockRequest as any, createDto);

      expect(result).toHaveProperty('id', 'contact-id');
      expect(mockContactsService.createContact).toHaveBeenCalledWith(user.id, createDto);
    });

    it('should return 401 if user not authenticated', async () => {
      const createDto = {
        firstName: 'John',
      };

      const mockRequest = { user: null };

      await expect(controller.create(mockRequest as any, createDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 400 for invalid email format', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
        email: 'invalid-email',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.createContact.mockRejectedValue(
        new BadRequestException('Invalid email format'),
      );

      await expect(controller.create(mockRequest as any, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return 400 for invalid phone format', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'John',
        phone: '123',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.createContact.mockRejectedValue(
        new BadRequestException('Invalid phone format'),
      );

      await expect(controller.create(mockRequest as any, createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create contact with tags', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'Jane',
        tags: ['Client', 'High Priority'],
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.createContact.mockResolvedValue({
        id: 'contact-id',
        firstName: 'Jane',
      });

      await controller.create(mockRequest as any, createDto);

      expect(mockContactsService.createContact).toHaveBeenCalled();
    });

    it('should create contact with reminder frequency', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'Bob',
        contactFrequencyDays: 30,
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.createContact.mockResolvedValue({
        id: 'contact-id',
        contactFrequencyDays: 30,
      });

      const result = await controller.create(mockRequest as any, createDto);

      expect(result.contactFrequencyDays).toBe(30);
    });

    it('should create contact with meeting context', async () => {
      const user = UserFactory.build();
      const createDto = {
        firstName: 'Alice',
        meetingContext: {
          location: 'Coffee Shop',
          when: '2025-11-29T10:00:00Z',
          topic: 'Business discussion',
        },
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.createContact.mockResolvedValue({
        id: 'contact-id',
        firstName: 'Alice',
      });

      await controller.create(mockRequest as any, createDto);

      expect(mockContactsService.createContact).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({
          meetingContext: createDto.meetingContext,
        }),
      );
    });
  });

  describe('POST /api/v1/contacts/business-card - OCR Upload', () => {
    it('should parse business card and return extracted data', async () => {
      const user = UserFactory.build();
      const scanDto = {
        imageData: 'base64-image-data',
        mimeType: 'image/jpeg',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.parseBusinessCard.mockResolvedValue({
        firstName: 'Michael',
        lastName: 'Chen',
        email: 'mchen@tech.com',
        company: 'TechCorp',
        confidence: 0.92,
        rawText: 'Business card text',
      });

      const result = await controller.scanBusinessCard(mockRequest as any, scanDto);

      expect(result.firstName).toBe('Michael');
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(mockContactsService.parseBusinessCard).toHaveBeenCalledWith(user.id, scanDto);
    });

    it('should return 400 for unsupported image format', async () => {
      const user = UserFactory.build();
      const scanDto = {
        imageData: 'base64-data',
        mimeType: 'image/gif' as any,
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.parseBusinessCard.mockRejectedValue(
        new BadRequestException('Unsupported image format'),
      );

      await expect(controller.scanBusinessCard(mockRequest as any, scanDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return 400 for image larger than 5MB', async () => {
      const user = UserFactory.build();
      const largeImage = 'x'.repeat(6 * 1024 * 1024);
      const scanDto = {
        imageData: largeImage,
        mimeType: 'image/jpeg',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.parseBusinessCard.mockRejectedValue(
        new BadRequestException('Image too large'),
      );

      await expect(controller.scanBusinessCard(mockRequest as any, scanDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle low confidence OCR results', async () => {
      const user = UserFactory.build();
      const scanDto = {
        imageData: 'blurry-image',
        mimeType: 'image/jpeg',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.parseBusinessCard.mockResolvedValue({
        confidence: 0.45,
        rawText: 'Partially readable',
      });

      const result = await controller.scanBusinessCard(mockRequest as any, scanDto);

      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('GET /api/v1/organizations/autocomplete - Company Search', () => {
    it('should return autocomplete results for company query', async () => {
      const user = UserFactory.build();
      const query = 'Acme';

      const mockRequest = { user: { id: user.id } };

      mockContactsService.autoCompleteCompany.mockResolvedValue([
        { id: 'org-1', name: 'Acme Corp' },
        { id: 'org-2', name: 'ACME Industries' },
        { id: 'org-3', name: 'Acme Labs' },
      ]);

      const result = await controller.autoCompleteCompany(mockRequest as any, query);

      expect(result).toHaveLength(3);
      expect(result[0].name).toContain('Acme');
      expect(mockContactsService.autoCompleteCompany).toHaveBeenCalledWith(user.id, query);
    });

    it('should return empty array for no matches', async () => {
      const user = UserFactory.build();
      const mockRequest = { user: { id: user.id } };

      mockContactsService.autoCompleteCompany.mockResolvedValue([]);

      const result = await controller.autoCompleteCompany(mockRequest as any, 'NonExistent');

      expect(result).toEqual([]);
    });

    it('should limit results to 10 items', async () => {
      const user = UserFactory.build();
      const mockRequest = { user: { id: user.id } };

      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        id: `org-${i}`,
        name: `Company ${i}`,
      }));

      mockContactsService.autoCompleteCompany.mockResolvedValue(manyResults);

      const result = await controller.autoCompleteCompany(mockRequest as any, 'Co');

      expect(result.length).toBeLessThanOrEqual(10);
    });

    it('should return 400 for empty query', async () => {
      const user = UserFactory.build();
      const mockRequest = { user: { id: user.id } };

      await expect(controller.autoCompleteCompany(mockRequest as any, '')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return 400 for query shorter than 2 characters', async () => {
      const user = UserFactory.build();
      const mockRequest = { user: { id: user.id } };

      await expect(controller.autoCompleteCompany(mockRequest as any, 'A')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('POST /api/v1/contacts/:id/enrich/linkedin - LinkedIn Enrichment', () => {
    it('should enrich contact from LinkedIn URL', async () => {
      const user = UserFactory.build();
      const contactId = 'contact-id';
      const enrichDto = {
        linkedinUrl: 'https://linkedin.com/in/johndoe',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.enrichFromLinkedIn.mockResolvedValue({
        success: true,
        firstName: 'John',
        lastName: 'Doe',
        headline: 'Software Engineer',
        source: 'apollo',
      });

      const result = await controller.enrichFromLinkedIn(mockRequest as any, contactId, enrichDto);

      expect(result.success).toBe(true);
      expect(mockContactsService.enrichFromLinkedIn).toHaveBeenCalledWith(
        user.id,
        contactId,
        enrichDto,
      );
    });

    it('should return 400 for invalid LinkedIn URL', async () => {
      const user = UserFactory.build();
      const enrichDto = {
        linkedinUrl: 'https://twitter.com/user',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.enrichFromLinkedIn.mockRejectedValue(
        new BadRequestException('Invalid LinkedIn URL'),
      );

      await expect(
        controller.enrichFromLinkedIn(mockRequest as any, 'contact-id', enrichDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle LinkedIn API errors gracefully', async () => {
      const user = UserFactory.build();
      const enrichDto = {
        linkedinUrl: 'https://linkedin.com/in/test',
      };

      const mockRequest = { user: { id: user.id } };

      mockContactsService.enrichFromLinkedIn.mockResolvedValue({
        success: false,
      });

      const result = await controller.enrichFromLinkedIn(
        mockRequest as any,
        'contact-id',
        enrichDto,
      );

      expect(result.success).toBe(false);
    });
  });

  describe('GET /api/v1/contacts/check-duplicate - Duplicate Check', () => {
    it('should check for duplicate by email', async () => {
      const user = UserFactory.build();
      const email = 'john@example.com';

      const mockRequest = { user: { id: user.id } };

      mockContactsService.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        existingContact: {
          id: 'existing-id',
          firstName: 'John',
          email: 'john@example.com',
        },
      });

      const result = await controller.checkDuplicate(mockRequest as any, email, undefined);

      expect(result.isDuplicate).toBe(true);
      expect(result.existingContact).toBeDefined();
    });

    it('should check for duplicate by phone', async () => {
      const user = UserFactory.build();
      const phone = '+14155552671';

      const mockRequest = { user: { id: user.id } };

      mockContactsService.checkDuplicate.mockResolvedValue({
        isDuplicate: true,
        existingContact: {
          id: 'existing-id',
          firstName: 'Jane',
          phone: '+14155552671',
        },
      });

      const result = await controller.checkDuplicate(mockRequest as any, undefined, phone);

      expect(result.isDuplicate).toBe(true);
    });

    it('should return no duplicate when contact does not exist', async () => {
      const user = UserFactory.build();

      const mockRequest = { user: { id: user.id } };

      mockContactsService.checkDuplicate.mockResolvedValue({
        isDuplicate: false,
      });

      const result = await controller.checkDuplicate(
        mockRequest as any,
        'new@example.com',
        undefined,
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.existingContact).toBeUndefined();
    });

    it('should return 400 if neither email nor phone provided', async () => {
      const user = UserFactory.build();
      const mockRequest = { user: { id: user.id } };

      await expect(
        controller.checkDuplicate(mockRequest as any, undefined, undefined),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
