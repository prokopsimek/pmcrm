/**
 * Unit tests for CalendarContactImporterService
 * Tests contact import from calendar events
 */
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { OAuthService } from '../../shared/oauth.service';
import { CalendarEventDto } from '../dto';
import { AttendeeMatcherService } from './attendee-matcher.service';
import { CalendarContactImporterService } from './calendar-contact-importer.service';
import { GoogleCalendarClientService } from './google-calendar-client.service';
import { OutlookCalendarClientService } from './outlook-calendar-client.service';

describe('CalendarContactImporterService', () => {
  let service: CalendarContactImporterService;
  let prismaService: jest.Mocked<PrismaService>;
  let googleCalendarClient: jest.Mocked<GoogleCalendarClientService>;

  const mockPrismaService = {
    integration: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    integrationLink: {
      create: jest.fn(),
    },
  };

  const mockOAuthService = {
    decryptToken: jest.fn(),
    encryptToken: jest.fn(),
    refreshAccessToken: jest.fn(),
  };

  const mockGoogleCalendarClient = {
    fetchEvents: jest.fn(),
  };

  const mockOutlookCalendarClient = {
    fetchEvents: jest.fn(),
  };

  const mockAttendeeMatcherService = {
    matchAttendeesToContacts: jest.fn(),
    createContactFromAttendee: jest.fn(),
  };

  const mockUserId = 'user-123';
  const mockIntegrationId = 'integration-456';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarContactImporterService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OAuthService, useValue: mockOAuthService },
        { provide: GoogleCalendarClientService, useValue: mockGoogleCalendarClient },
        { provide: OutlookCalendarClientService, useValue: mockOutlookCalendarClient },
        { provide: AttendeeMatcherService, useValue: mockAttendeeMatcherService },
      ],
    }).compile();

    service = module.get<CalendarContactImporterService>(CalendarContactImporterService);
    prismaService = module.get(PrismaService);
    googleCalendarClient = module.get(GoogleCalendarClientService);
  });

  describe('previewImport', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'GOOGLE_CALENDAR',
      accessToken: 'encrypted-token',
      refreshToken: 'encrypted-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    };

    const mockEvents: CalendarEventDto[] = [
      {
        externalId: 'event-1',
        subject: 'Meeting with John',
        startTime: new Date('2024-11-01T10:00:00Z'),
        endTime: new Date('2024-11-01T11:00:00Z'),
        attendees: [
          { email: 'john@company.com', displayName: 'John Doe' },
          { email: 'jane@company.com', displayName: 'Jane Smith' },
          { email: 'user@example.com', organizer: true },
        ],
      },
      {
        externalId: 'event-2',
        subject: 'Meeting with Jane',
        startTime: new Date('2024-11-02T14:00:00Z'),
        endTime: new Date('2024-11-02T15:00:00Z'),
        attendees: [
          { email: 'jane@company.com', displayName: 'Jane Smith' },
          { email: 'user@example.com', organizer: true },
        ],
      },
    ];

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: mockEvents,
        nextPageToken: undefined,
      });
    });

    it('should return preview with new contacts and duplicates', async () => {
      // Existing contact - Jane is already in the system
      mockPrismaService.contact.findMany.mockResolvedValue([
        {
          id: 'contact-1',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@company.com',
          company: null,
          source: 'MANUAL',
        },
      ]);

      const result = await service.previewImport(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        endDate: '2024-11-30T23:59:59Z',
      });

      expect(result.summary.totalEvents).toBe(2);
      expect(result.summary.totalAttendees).toBe(2); // John and Jane (organizers excluded)
      expect(result.summary.newContacts).toBe(1); // John
      expect(result.summary.exactDuplicates).toBe(1); // Jane
      expect(result.newContacts).toHaveLength(1);
      expect(result.newContacts[0].email).toBe('john@company.com');
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].attendee.email).toBe('jane@company.com');
    });

    it('should aggregate meeting counts for attendees', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.previewImport(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        endDate: '2024-11-30T23:59:59Z',
      });

      // Jane appears in 2 meetings
      const janeAttendee = result.newContacts.find((a) => a.email === 'jane@company.com');
      expect(janeAttendee?.meetingCount).toBe(2);

      // John appears in 1 meeting
      const johnAttendee = result.newContacts.find((a) => a.email === 'john@company.com');
      expect(johnAttendee?.meetingCount).toBe(1);
    });

    it('should extract company from email domain', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.previewImport(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        endDate: '2024-11-30T23:59:59Z',
      });

      const johnAttendee = result.newContacts.find((a) => a.email === 'john@company.com');
      expect(johnAttendee?.company).toBe('Company');
    });

    it('should not extract company for common email providers', async () => {
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: [
          {
            externalId: 'event-3',
            subject: 'Meeting',
            startTime: new Date('2024-11-01T10:00:00Z'),
            endTime: new Date('2024-11-01T11:00:00Z'),
            attendees: [{ email: 'person@gmail.com', displayName: 'Person Name' }],
          },
        ],
        nextPageToken: undefined,
      });
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.previewImport(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        endDate: '2024-11-30T23:59:59Z',
      });

      const gmailAttendee = result.newContacts.find((a) => a.email === 'person@gmail.com');
      expect(gmailAttendee?.company).toBeUndefined();
    });

    it('should throw NotFoundException when no calendar integration exists', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      await expect(
        service.previewImport(mockUserId, {
          startDate: '2024-11-01T00:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('importContacts', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'GOOGLE_CALENDAR',
      accessToken: 'encrypted-token',
      refreshToken: 'encrypted-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    };

    const mockEvents: CalendarEventDto[] = [
      {
        externalId: 'event-1',
        subject: 'Meeting',
        startTime: new Date('2024-11-01T10:00:00Z'),
        endTime: new Date('2024-11-01T11:00:00Z'),
        attendees: [
          { email: 'new@company.com', displayName: 'New Person' },
          { email: 'existing@company.com', displayName: 'Existing Person' },
        ],
      },
    ];

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: mockEvents,
        nextPageToken: undefined,
      });
    });

    it('should import new contacts and skip duplicates', async () => {
      // Existing contact
      mockPrismaService.contact.findMany.mockResolvedValue([
        {
          id: 'existing-contact',
          email: 'existing@company.com',
        },
      ]);

      // Mock contact creation
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'new-contact-id',
        firstName: 'New',
        lastName: 'Person',
        email: 'new@company.com',
      });

      mockPrismaService.integrationLink.create.mockResolvedValue({
        id: 'link-id',
        integrationId: mockIntegrationId,
        contactId: 'new-contact-id',
        externalId: 'calendar-attendee-new@company.com',
      });

      const result = await service.importContacts(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        skipDuplicates: true,
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.failed).toBe(0);
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(1);
    });

    it('should import only selected emails when provided', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'new-contact-id',
        firstName: 'New',
        lastName: 'Person',
        email: 'new@company.com',
      });
      mockPrismaService.integrationLink.create.mockResolvedValue({});

      const result = await service.importContacts(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        selectedEmails: ['new@company.com'],
      });

      expect(result.imported).toBe(1);
      // Only the selected email should be imported
      expect(mockPrismaService.contact.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'new@company.com',
          }),
        }),
      );
    });

    it('should set contact source as GOOGLE_CALENDAR', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'new-contact-id',
        firstName: 'New',
        lastName: 'Person',
        email: 'new@company.com',
      });
      mockPrismaService.integrationLink.create.mockResolvedValue({});

      await service.importContacts(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
        selectedEmails: ['new@company.com'],
      });

      expect(mockPrismaService.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'GOOGLE_CALENDAR',
          }),
        }),
      );
    });

    it('should handle import errors gracefully', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue([]);
      mockPrismaService.contact.create.mockRejectedValue(new Error('Database error'));

      const result = await service.importContacts(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
      });

      expect(result.success).toBe(false);
      expect(result.failed).toBe(2); // Both attendees failed
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0]).toContain('Database error');
    });

    it('should throw NotFoundException when no calendar integration exists', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      await expect(
        service.importContacts(mockUserId, {
          startDate: '2024-11-01T00:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('name parsing', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'GOOGLE_CALENDAR',
      accessToken: 'encrypted-token',
      expiresAt: new Date(Date.now() + 3600000),
      isActive: true,
    };

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockPrismaService.contact.findMany.mockResolvedValue([]);
    });

    it('should parse display name into first and last name', async () => {
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: [
          {
            externalId: 'event-1',
            subject: 'Meeting',
            startTime: new Date('2024-11-01T10:00:00Z'),
            endTime: new Date('2024-11-01T11:00:00Z'),
            attendees: [{ email: 'john@company.com', displayName: 'John Michael Doe' }],
          },
        ],
        nextPageToken: undefined,
      });

      const result = await service.previewImport(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
      });

      expect(result.newContacts[0].firstName).toBe('John');
      expect(result.newContacts[0].lastName).toBe('Michael Doe');
    });

    it('should extract name from email when no display name', async () => {
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: [
          {
            externalId: 'event-1',
            subject: 'Meeting',
            startTime: new Date('2024-11-01T10:00:00Z'),
            endTime: new Date('2024-11-01T11:00:00Z'),
            attendees: [{ email: 'john.doe@company.com' }],
          },
        ],
        nextPageToken: undefined,
      });

      const result = await service.previewImport(mockUserId, {
        startDate: '2024-11-01T00:00:00Z',
      });

      expect(result.newContacts[0].firstName).toBe('John');
      expect(result.newContacts[0].lastName).toBe('Doe');
    });
  });
});



