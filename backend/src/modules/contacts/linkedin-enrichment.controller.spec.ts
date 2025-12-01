/**
 * Unit tests for LinkedIn Enrichment Controller (US-013)
 * TDD RED Phase - Controller endpoint tests
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { LinkedInEnrichmentController } from './linkedin-enrichment.controller';
import { LinkedInEnrichmentService } from './services/linkedin-enrichment.service';

describe('LinkedInEnrichmentController (US-013 TDD)', () => {
  let controller: LinkedInEnrichmentController;
  let service: LinkedInEnrichmentService;

  const mockUserId = 'user-123';
  const mockContactId = 'contact-456';
  const mockLinkedInUrl = 'https://www.linkedin.com/in/john-doe';

  const mockEnrichmentResult = {
    photoUrl: 'https://media.linkedin.com/photo.jpg',
    headline: 'Senior Software Engineer at Google',
    currentPosition: {
      company: 'Google',
      title: 'Senior Software Engineer',
      startDate: '2020-01',
      isCurrent: true,
    },
    positions: [],
    skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'System Design'],
    education: [],
    location: 'San Francisco, United States',
    source: 'proxycurl',
    success: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LinkedInEnrichmentController],
      providers: [
        {
          provide: LinkedInEnrichmentService,
          useValue: {
            enrichByLinkedInUrl: jest.fn(),
            autoMatchByEmail: jest.fn(),
            autoMatchByName: jest.fn(),
            manualRefresh: jest.fn(),
            getEnrichmentStatus: jest.fn(),
            getEnrichmentCosts: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LinkedInEnrichmentController>(LinkedInEnrichmentController);
    service = module.get<LinkedInEnrichmentService>(LinkedInEnrichmentService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // POST /api/v1/contacts/:id/enrich/linkedin - Manual enrichment
  // ============================================================================

  describe('POST /api/v1/contacts/:id/enrich/linkedin', () => {
    it('should require authentication', async () => {
      const req = { user: null };

      await expect(
        controller.enrichFromLinkedIn(req as any, mockContactId, {
          linkedinUrl: mockLinkedInUrl,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should validate LinkedIn URL in request body', async () => {
      const req = { user: { id: mockUserId } };

      await expect(
        controller.enrichFromLinkedIn(req as any, mockContactId, {
          linkedinUrl: 'invalid-url',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call enrichByLinkedInUrl service method', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'enrichByLinkedInUrl').mockResolvedValue(mockEnrichmentResult as any);

      await controller.enrichFromLinkedIn(req as any, mockContactId, {
        linkedinUrl: mockLinkedInUrl,
      });

      expect(service.enrichByLinkedInUrl).toHaveBeenCalledWith(
        mockUserId,
        mockContactId,
        mockLinkedInUrl,
      );
    });

    it('should return enrichment result on success', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'enrichByLinkedInUrl').mockResolvedValue(mockEnrichmentResult as any);

      const result = await controller.enrichFromLinkedIn(req as any, mockContactId, {
        linkedinUrl: mockLinkedInUrl,
      });

      expect(result).toMatchObject({
        success: true,
        data: mockEnrichmentResult,
      });
    });

    it('should handle not found errors', async () => {
      const req = { user: { id: mockUserId } };
      jest
        .spyOn(service, 'enrichByLinkedInUrl')
        .mockRejectedValue(new NotFoundException('Contact not found'));

      await expect(
        controller.enrichFromLinkedIn(req as any, mockContactId, {
          linkedinUrl: mockLinkedInUrl,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ============================================================================
  // POST /api/v1/contacts/:id/enrich/linkedin/auto - Auto-match enrichment
  // ============================================================================

  describe('POST /api/v1/contacts/:id/enrich/linkedin/auto', () => {
    it('should require authentication', async () => {
      const req = { user: null };

      await expect(controller.autoEnrichContact(req as any, mockContactId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should attempt auto-match by email first', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'autoMatchByEmail').mockResolvedValue({
        linkedinUrl: mockLinkedInUrl,
        matchScore: 0.95,
      } as any);
      jest.spyOn(service, 'enrichByLinkedInUrl').mockResolvedValue(mockEnrichmentResult as any);

      await controller.autoEnrichContact(req as any, mockContactId);

      expect(service.autoMatchByEmail).toHaveBeenCalled();
    });

    it('should fall back to name matching if email fails', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'autoMatchByEmail').mockResolvedValue(null);
      jest.spyOn(service, 'autoMatchByName').mockResolvedValue({
        linkedinUrl: mockLinkedInUrl,
        matchScore: 0.88,
      } as any);
      jest.spyOn(service, 'enrichByLinkedInUrl').mockResolvedValue(mockEnrichmentResult as any);

      await controller.autoEnrichContact(req as any, mockContactId);

      expect(service.autoMatchByName).toHaveBeenCalled();
    });

    it('should return 404 if no match found', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'autoMatchByEmail').mockResolvedValue(null);
      jest.spyOn(service, 'autoMatchByName').mockResolvedValue(null);

      await expect(controller.autoEnrichContact(req as any, mockContactId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should enrich contact after successful match', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'autoMatchByEmail').mockResolvedValue({
        linkedinUrl: mockLinkedInUrl,
        matchScore: 0.95,
      } as any);
      jest.spyOn(service, 'enrichByLinkedInUrl').mockResolvedValue(mockEnrichmentResult as any);

      const result = await controller.autoEnrichContact(req as any, mockContactId);

      expect(service.enrichByLinkedInUrl).toHaveBeenCalledWith(
        mockUserId,
        mockContactId,
        mockLinkedInUrl,
      );
      expect(result.data.matchScore).toBe(0.95);
    });
  });

  // ============================================================================
  // GET /api/v1/contacts/:id/enrichment/status - Get enrichment status
  // ============================================================================

  describe('GET /api/v1/contacts/:id/enrichment/status', () => {
    it('should require authentication', async () => {
      const req = { user: null };

      await expect(controller.getEnrichmentStatus(req as any, mockContactId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return enrichment status', async () => {
      const req = { user: { id: mockUserId } };
      const mockStatus = {
        isEnriched: true,
        lastUpdate: new Date('2025-01-15'),
        provider: 'proxycurl',
        cacheValid: true,
        daysUntilExpiry: 25,
      };

      jest.spyOn(service, 'getEnrichmentStatus').mockResolvedValue(mockStatus as any);

      const result = await controller.getEnrichmentStatus(req as any, mockContactId);

      expect(result).toMatchObject(mockStatus);
      expect(service.getEnrichmentStatus).toHaveBeenCalledWith(mockUserId, mockContactId);
    });

    it('should indicate if cache is expired', async () => {
      const req = { user: { id: mockUserId } };
      const mockStatus = {
        isEnriched: true,
        lastUpdate: new Date('2024-11-15'),
        provider: 'proxycurl',
        cacheValid: false,
        daysUntilExpiry: -35,
      };

      jest.spyOn(service, 'getEnrichmentStatus').mockResolvedValue(mockStatus as any);

      const result = await controller.getEnrichmentStatus(req as any, mockContactId);

      expect(result.cacheValid).toBe(false);
      expect(result.daysUntilExpiry).toBeLessThan(0);
    });
  });

  // ============================================================================
  // POST /api/v1/contacts/:id/enrichment/refresh - Force refresh
  // ============================================================================

  describe('POST /api/v1/contacts/:id/enrichment/refresh', () => {
    it('should require authentication', async () => {
      const req = { user: null };

      await expect(controller.refreshEnrichment(req as any, mockContactId)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should call manualRefresh service method', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'manualRefresh').mockResolvedValue(mockEnrichmentResult as any);

      await controller.refreshEnrichment(req as any, mockContactId);

      expect(service.manualRefresh).toHaveBeenCalledWith(mockUserId, mockContactId);
    });

    it('should return refreshed data', async () => {
      const req = { user: { id: mockUserId } };
      jest.spyOn(service, 'manualRefresh').mockResolvedValue(mockEnrichmentResult as any);

      const result = await controller.refreshEnrichment(req as any, mockContactId);

      expect(result.success).toBe(true);
      expect(result.data.source).toBe('proxycurl');
    });

    it('should throw error if linkedinUrl not set', async () => {
      const req = { user: { id: mockUserId } };
      jest
        .spyOn(service, 'manualRefresh')
        .mockRejectedValue(new BadRequestException('LinkedIn URL not set'));

      await expect(controller.refreshEnrichment(req as any, mockContactId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================================================
  // GET /api/v1/enrichment/credits - Get API credit usage
  // ============================================================================

  describe('GET /api/v1/enrichment/credits', () => {
    it('should require authentication', async () => {
      const req = { user: null };

      await expect(controller.getEnrichmentCredits(req as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return enrichment cost summary', async () => {
      const req = { user: { id: mockUserId } };
      const mockCosts = {
        totalCost: 1.5,
        successfulEnrichments: 50,
        failedEnrichments: 5,
        currentMonthCost: 0.3,
        averageCostPerEnrichment: 0.03,
      };

      jest.spyOn(service, 'getEnrichmentCosts').mockResolvedValue(mockCosts as any);

      const result = await controller.getEnrichmentCredits(req as any);

      expect(result).toMatchObject(mockCosts);
      expect(service.getEnrichmentCosts).toHaveBeenCalledWith(mockUserId);
    });

    it('should include breakdown by provider', async () => {
      const req = { user: { id: mockUserId } };
      const mockCosts = {
        totalCost: 1.5,
        successfulEnrichments: 50,
        failedEnrichments: 5,
        byProvider: {
          proxycurl: { count: 45, cost: 1.35 },
          apollo: { count: 5, cost: 0.15 },
        },
      };

      jest.spyOn(service, 'getEnrichmentCosts').mockResolvedValue(mockCosts as any);

      const result = await controller.getEnrichmentCredits(req as any);

      expect(result.byProvider).toBeDefined();
      expect(result.byProvider.proxycurl).toMatchObject({ count: 45, cost: 1.35 });
    });
  });

  // ============================================================================
  // Rate Limiting Tests
  // ============================================================================

  describe('Rate Limiting', () => {
    it('should enforce rate limits on enrichment endpoints', async () => {
      // This test verifies that rate limiting decorators are applied
      const metadata = Reflect.getMetadata('throttler', controller.enrichFromLinkedIn);
      expect(metadata).toBeDefined();
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      const req = { user: { id: mockUserId } };
      jest
        .spyOn(service, 'enrichByLinkedInUrl')
        .mockRejectedValue(new Error('Proxycurl API error'));

      await expect(
        controller.enrichFromLinkedIn(req as any, mockContactId, {
          linkedinUrl: mockLinkedInUrl,
        }),
      ).rejects.toThrow();
    });

    it('should return proper error structure', async () => {
      const req = { user: { id: mockUserId } };
      jest
        .spyOn(service, 'enrichByLinkedInUrl')
        .mockRejectedValue(new BadRequestException('Invalid LinkedIn URL'));

      try {
        await controller.enrichFromLinkedIn(req as any, mockContactId, {
          linkedinUrl: 'bad-url',
        });
      } catch (error: any) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect(error.message).toBe('Invalid LinkedIn URL');
      }
    });
  });
});
