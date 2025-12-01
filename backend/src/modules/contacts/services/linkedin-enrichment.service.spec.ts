/**
 * Unit tests for LinkedInEnrichmentService (US-013)
 * TDD RED Phase - Tests written BEFORE implementation
 * Coverage: enrichByLinkedInUrl, autoMatchByEmail, autoMatchByName, caching, manual refresh
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LinkedInEnrichmentService } from './linkedin-enrichment.service';
import { ProxycurlClientService } from './proxycurl-client.service';
import { ProfileMatcherService } from './profile-matcher.service';
import { PrismaService } from '@/shared/database/prisma.service';

describe('LinkedInEnrichmentService (US-013 TDD)', () => {
  let service: LinkedInEnrichmentService;
  let proxycurlClient: ProxycurlClientService;
  let profileMatcher: ProfileMatcherService;
  let prismaService: PrismaService;

  // Mock data
  const mockUserId = 'user-123';
  const mockContactId = 'contact-456';
  const mockLinkedInUrl = 'https://www.linkedin.com/in/john-doe';

  const mockProxycurlResponse = {
    public_identifier: 'john-doe',
    profile_pic_url: 'https://media.linkedin.com/photo.jpg',
    first_name: 'John',
    last_name: 'Doe',
    headline: 'Senior Software Engineer at Google',
    summary: 'Experienced engineer with 10+ years...',
    country_full_name: 'United States',
    city: 'San Francisco',
    experiences: [
      {
        company: 'Google',
        title: 'Senior Software Engineer',
        description: 'Leading backend development',
        starts_at: { year: 2020, month: 1 },
        ends_at: null,
      },
      {
        company: 'Microsoft',
        title: 'Software Engineer',
        description: 'Cloud infrastructure',
        starts_at: { year: 2015, month: 6 },
        ends_at: { year: 2020, month: 1 },
      },
    ],
    education: [
      {
        school: 'Stanford University',
        degree_name: 'Bachelor of Science',
        field_of_study: 'Computer Science',
        starts_at: { year: 2011, month: 9 },
        ends_at: { year: 2015, month: 6 },
      },
    ],
    skills: ['JavaScript', 'TypeScript', 'Node.js', 'React', 'System Design'],
  };

  const mockContact = {
    id: mockContactId,
    userId: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    linkedinUrl: mockLinkedInUrl,
    enrichmentData: null,
    enrichedAt: null,
    enrichmentProvider: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LinkedInEnrichmentService,
        {
          provide: ProxycurlClientService,
          useValue: {
            fetchProfile: jest.fn(),
            searchByEmail: jest.fn(),
            searchByName: jest.fn(),
          },
        },
        {
          provide: ProfileMatcherService,
          useValue: {
            fuzzyMatchByName: jest.fn(),
            calculateMatchScore: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            contact: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            enrichmentLog: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'PROXYCURL_API_KEY') return 'test-api-key';
              if (key === 'ENRICHMENT_CACHE_TTL_DAYS') return 30;
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LinkedInEnrichmentService>(LinkedInEnrichmentService);
    proxycurlClient = module.get<ProxycurlClientService>(ProxycurlClientService);
    profileMatcher = module.get<ProfileMatcherService>(ProfileMatcherService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: LinkedIn URL input or auto-match by email/name
  // ============================================================================

  describe('enrichByLinkedInUrl', () => {
    it('should validate LinkedIn URL format', async () => {
      const invalidUrls = [
        'http://google.com',
        'linkedin.com/in/john',
        'https://linkedin.com/company/google',
        'not-a-url',
      ];

      for (const url of invalidUrls) {
        await expect(service.enrichByLinkedInUrl(mockUserId, mockContactId, url)).rejects.toThrow(
          BadRequestException,
        );
      }
    });

    it('should accept valid LinkedIn profile URLs', async () => {
      const validUrls = [
        'https://www.linkedin.com/in/john-doe',
        'https://linkedin.com/in/jane-smith/',
        'http://www.linkedin.com/in/bob-jones',
      ];

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      for (const url of validUrls) {
        await expect(
          service.enrichByLinkedInUrl(mockUserId, mockContactId, url),
        ).resolves.not.toThrow();
      }
    });

    it('should throw NotFoundException if contact does not exist', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(null);

      await expect(
        service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if contact belongs to different user', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(null);

      await expect(
        service.enrichByLinkedInUrl('different-user', mockContactId, mockLinkedInUrl),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fetch profile data from Proxycurl API', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(proxycurlClient.fetchProfile).toHaveBeenCalledWith(mockLinkedInUrl);
    });

    it('should save enrichment data to contact record', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      const updateSpy = jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(updateSpy).toHaveBeenCalledWith({
        where: { id: mockContactId },
        data: expect.objectContaining({
          enrichmentData: expect.any(Object),
          enrichedAt: expect.any(Date),
          enrichmentProvider: 'proxycurl',
          linkedinUrl: mockLinkedInUrl,
        }),
      });
    });

    it('should create enrichment log on success', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      const logSpy = jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(logSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: mockContactId,
          provider: 'proxycurl',
          success: true,
          cost: expect.any(Number),
        }),
      });
    });

    it('should create enrichment log on failure', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockRejectedValue(new Error('API Error'));
      const logSpy = jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      await expect(
        service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl),
      ).rejects.toThrow();

      expect(logSpy).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contactId: mockContactId,
          provider: 'proxycurl',
          success: false,
          errorMessage: 'API Error',
        }),
      });
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Fetch photo, position, company, headline, location
  // ============================================================================

  describe('fetchProfileData', () => {
    it('should return structured profile data with photo', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result).toMatchObject({
        photoUrl: 'https://media.linkedin.com/photo.jpg',
        headline: 'Senior Software Engineer at Google',
        currentPosition: expect.objectContaining({
          company: 'Google',
          title: 'Senior Software Engineer',
        }),
        location: 'San Francisco, United States',
      });
    });

    it('should extract current position from employment history', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.currentPosition).toEqual({
        company: 'Google',
        title: 'Senior Software Engineer',
        startDate: '2020-01',
        isCurrent: true,
      });
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Employment history (last 3-5 positions)
  // ============================================================================

  describe('fetchEmploymentHistory', () => {
    it('should return last 5 positions', async () => {
      const responseWithManyPositions = {
        ...mockProxycurlResponse,
        experiences: Array(10)
          .fill(null)
          .map((_, i) => ({
            company: `Company ${i}`,
            title: `Position ${i}`,
            starts_at: { year: 2020 - i, month: 1 },
            ends_at: i === 0 ? null : { year: 2021 - i, month: 12 },
          })),
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest
        .spyOn(proxycurlClient, 'fetchProfile')
        .mockResolvedValue(responseWithManyPositions as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.positions).toHaveLength(5);
    });

    it('should mark current position with isCurrent: true', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      const currentPosition = result.positions.find((p: any) => p.isCurrent);
      expect(currentPosition).toBeDefined();
      expect(currentPosition.company).toBe('Google');
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Education
  // ============================================================================

  describe('fetchEducation', () => {
    it('should return education history', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.education).toHaveLength(1);
      expect(result.education[0]).toMatchObject({
        school: 'Stanford University',
        degree: 'Bachelor of Science',
        fieldOfStudy: 'Computer Science',
      });
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Skills (top 5)
  // ============================================================================

  describe('fetchSkills', () => {
    it('should return top 5 skills', async () => {
      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.skills).toHaveLength(5);
      expect(result.skills).toEqual([
        'JavaScript',
        'TypeScript',
        'Node.js',
        'React',
        'System Design',
      ]);
    });

    it('should limit skills to top 5 if more available', async () => {
      const responseWithManySkills = {
        ...mockProxycurlResponse,
        skills: Array(20)
          .fill(null)
          .map((_, i) => `Skill ${i}`),
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(mockContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(responseWithManySkills as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.skills).toHaveLength(5);
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Cache enrichment data (30-day TTL)
  // ============================================================================

  describe('cacheEnrichmentData', () => {
    it('should return cached data if within 30-day TTL', async () => {
      const cachedContact = {
        ...mockContact,
        enrichedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        enrichmentData: {
          photoUrl: 'cached-photo.jpg',
          headline: 'Cached headline',
        },
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(cachedContact as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.source).toBe('cache');
      expect(result.photoUrl).toBe('cached-photo.jpg');
      expect(proxycurlClient.fetchProfile).not.toHaveBeenCalled();
    });

    it('should fetch new data if cache expired (> 30 days)', async () => {
      const expiredContact = {
        ...mockContact,
        enrichedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        enrichmentData: { photoUrl: 'old-photo.jpg' },
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(expiredContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(result.source).toBe('proxycurl');
      expect(proxycurlClient.fetchProfile).toHaveBeenCalled();
    });

    it('should fetch new data if no enrichment data exists', async () => {
      const contactWithoutEnrichment = {
        ...mockContact,
        enrichedAt: null,
        enrichmentData: null,
      };

      jest
        .spyOn(prismaService.contact, 'findFirst')
        .mockResolvedValue(contactWithoutEnrichment as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.enrichByLinkedInUrl(mockUserId, mockContactId, mockLinkedInUrl);

      expect(proxycurlClient.fetchProfile).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Manual refresh on-demand
  // ============================================================================

  describe('manualRefresh', () => {
    it('should force refresh even if cache is valid', async () => {
      const cachedContact = {
        ...mockContact,
        enrichedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        enrichmentData: { photoUrl: 'cached-photo.jpg' },
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(cachedContact as any);
      jest.spyOn(proxycurlClient, 'fetchProfile').mockResolvedValue(mockProxycurlResponse as any);
      jest.spyOn(prismaService.contact, 'update').mockResolvedValue({} as any);
      jest.spyOn(prismaService.enrichmentLog, 'create').mockResolvedValue({} as any);

      const result = await service.manualRefresh(mockUserId, mockContactId);

      expect(proxycurlClient.fetchProfile).toHaveBeenCalled();
      expect(result.source).toBe('proxycurl');
    });

    it('should require linkedinUrl to be set before refresh', async () => {
      const contactWithoutUrl = {
        ...mockContact,
        linkedinUrl: null,
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(contactWithoutUrl as any);

      await expect(service.manualRefresh(mockUserId, mockContactId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Auto-match by email
  // ============================================================================

  describe('autoMatchByEmail', () => {
    it('should search Proxycurl by email', async () => {
      const email = 'john.doe@example.com';
      jest.spyOn(proxycurlClient, 'searchByEmail').mockResolvedValue({
        linkedinUrl: mockLinkedInUrl,
        matchScore: 0.95,
      } as any);

      const result = await service.autoMatchByEmail(email);

      expect(proxycurlClient.searchByEmail).toHaveBeenCalledWith(email);
      expect(result.linkedinUrl).toBe(mockLinkedInUrl);
      expect(result.matchScore).toBeGreaterThan(0.9);
    });

    it('should return null if no match found', async () => {
      jest.spyOn(proxycurlClient, 'searchByEmail').mockResolvedValue(null);

      const result = await service.autoMatchByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Auto-match by name
  // ============================================================================

  describe('autoMatchByName', () => {
    it('should use fuzzy matching for name search', async () => {
      const firstName = 'John';
      const lastName = 'Doe';
      const company = 'Google';

      jest
        .spyOn(proxycurlClient, 'searchByName')
        .mockResolvedValue([
          { linkedinUrl: mockLinkedInUrl, name: 'John Doe', company: 'Google' },
        ] as any);
      jest.spyOn(profileMatcher, 'fuzzyMatchByName').mockReturnValue(0.92);

      const result = await service.autoMatchByName(firstName, lastName, company);

      expect(proxycurlClient.searchByName).toHaveBeenCalledWith(firstName, lastName, company);
      expect(result?.linkedinUrl).toBe(mockLinkedInUrl);
    });

    it('should return match only if score > 0.85', async () => {
      jest
        .spyOn(proxycurlClient, 'searchByName')
        .mockResolvedValue([
          { linkedinUrl: mockLinkedInUrl, name: 'John Smith', company: 'Different Corp' },
        ] as any);
      jest.spyOn(profileMatcher, 'fuzzyMatchByName').mockReturnValue(0.7);

      const result = await service.autoMatchByName('John', 'Doe', 'Google');

      expect(result).toBeNull();
    });

    it('should prioritize company name in matching', async () => {
      jest.spyOn(proxycurlClient, 'searchByName').mockResolvedValue([
        { linkedinUrl: 'url1', name: 'John Doe', company: 'Google' },
        { linkedinUrl: 'url2', name: 'John Doe', company: 'Microsoft' },
      ] as any);
      jest
        .spyOn(profileMatcher, 'fuzzyMatchByName')
        .mockReturnValueOnce(0.9)
        .mockReturnValueOnce(0.88);

      const result = await service.autoMatchByName('John', 'Doe', 'Google');

      expect(result?.linkedinUrl).toBe('url1');
    });
  });

  // ============================================================================
  // ACCEPTANCE CRITERIA: Indication when enrichment was last updated
  // ============================================================================

  describe('getEnrichmentStatus', () => {
    it('should return enrichment status with last update timestamp', async () => {
      const enrichedContact = {
        ...mockContact,
        enrichedAt: new Date('2025-01-15'),
        enrichmentProvider: 'proxycurl',
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(enrichedContact as any);

      const result = await service.getEnrichmentStatus(mockUserId, mockContactId);

      expect(result).toMatchObject({
        isEnriched: true,
        lastUpdate: new Date('2025-01-15'),
        provider: 'proxycurl',
        cacheValid: expect.any(Boolean),
        daysUntilExpiry: expect.any(Number),
      });
    });

    it('should indicate if cache is expired', async () => {
      const expiredContact = {
        ...mockContact,
        enrichedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(expiredContact as any);

      const result = await service.getEnrichmentStatus(mockUserId, mockContactId);

      expect(result.cacheValid).toBe(false);
      expect(result.daysUntilExpiry).toBeLessThan(0);
    });

    it('should return not enriched status if no data', async () => {
      const unenrichedContact = {
        ...mockContact,
        enrichedAt: null,
        enrichmentData: null,
      };

      jest.spyOn(prismaService.contact, 'findFirst').mockResolvedValue(unenrichedContact as any);

      const result = await service.getEnrichmentStatus(mockUserId, mockContactId);

      expect(result.isEnriched).toBe(false);
      expect(result.lastUpdate).toBeNull();
    });
  });

  // ============================================================================
  // COST TRACKING
  // ============================================================================

  describe('getCostTracking', () => {
    it('should calculate total enrichment costs', async () => {
      const mockLogs = [
        { cost: 0.03, success: true },
        { cost: 0.03, success: true },
        { cost: 0.03, success: false },
      ];

      jest.spyOn(prismaService, '$transaction').mockResolvedValue(mockLogs as any);

      const result = await service.getEnrichmentCosts(mockUserId);

      expect(result.totalCost).toBe(0.09);
      expect(result.successfulEnrichments).toBe(2);
      expect(result.failedEnrichments).toBe(1);
    });
  });
});
