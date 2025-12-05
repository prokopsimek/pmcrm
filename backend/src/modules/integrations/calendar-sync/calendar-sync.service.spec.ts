/**
 * Unit tests for CalendarSyncService (US-031)
 * Test-Driven Development (RED phase)
 * Coverage target: 95%+
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../shared/database/prisma.service';
import { OAuthService } from '../shared/oauth.service';
import { CalendarSyncService } from './calendar-sync.service';
import { AttendeeMatcherService } from './services/attendee-matcher.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { OutlookCalendarClientService } from './services/outlook-calendar-client.service';

describe('CalendarSyncService (TDD - Unit)', () => {
  let service: CalendarSyncService;
  let prismaService: PrismaService;
  let oauthService: OAuthService;
  let googleCalendarClient: GoogleCalendarClientService;
  let outlookCalendarClient: OutlookCalendarClientService;
  let attendeeMatcher: AttendeeMatcherService;

  const mockPrismaService = {
    integration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    calendarSyncConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    interaction: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    interactionParticipant: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockOAuthService = {
    generateAuthUrl: jest.fn(),
    exchangeCodeForTokens: jest.fn(),
    refreshAccessToken: jest.fn(),
    revokeToken: jest.fn(),
    encryptToken: jest.fn(),
    decryptToken: jest.fn(),
  };

  const mockGoogleCalendarClient = {
    fetchEvents: jest.fn(),
    fetchEventById: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
  };

  const mockOutlookCalendarClient = {
    fetchEvents: jest.fn(),
    fetchEventById: jest.fn(),
    createEvent: jest.fn(),
    updateEvent: jest.fn(),
  };

  const mockAttendeeMatcherService = {
    matchAttendeesToContacts: jest.fn(),
    createContactFromAttendee: jest.fn(),
  };

  const mockUserId = 'user-123';
  const mockIntegrationId = 'integration-456';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalendarSyncService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: OAuthService, useValue: mockOAuthService },
        { provide: GoogleCalendarClientService, useValue: mockGoogleCalendarClient },
        { provide: OutlookCalendarClientService, useValue: mockOutlookCalendarClient },
        { provide: AttendeeMatcherService, useValue: mockAttendeeMatcherService },
      ],
    }).compile();

    service = module.get<CalendarSyncService>(CalendarSyncService);
    prismaService = module.get<PrismaService>(PrismaService);
    oauthService = module.get<OAuthService>(OAuthService);
    googleCalendarClient = module.get<GoogleCalendarClientService>(GoogleCalendarClientService);
    outlookCalendarClient = module.get<OutlookCalendarClientService>(OutlookCalendarClientService);
    attendeeMatcher = module.get<AttendeeMatcherService>(AttendeeMatcherService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connectGoogleCalendar', () => {
    it('should generate OAuth URL with calendar.readonly scope', async () => {
      const expectedUrl = 'https://accounts.google.com/o/oauth2/v2/auth?scope=calendar.readonly';

      mockOAuthService.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = await service.connectGoogleCalendar(mockUserId);

      expect(result.authUrl).toBe(expectedUrl);
      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith({
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        userId: mockUserId,
        provider: 'google',
        usePKCE: false,
        integration: 'google-calendar',
      });
    });

    it('should include state parameter for CSRF protection', async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue('https://auth.url');

      const result = await service.connectGoogleCalendar(mockUserId);

      expect(result).toHaveProperty('state');
      expect(result.state).toBeDefined();
    });

    it('should request offline access for refresh token', async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue('https://auth.url');

      await service.connectGoogleCalendar(mockUserId);

      const callArgs = mockOAuthService.generateAuthUrl.mock.calls[0][0];
      expect(callArgs.scopes).toContain('https://www.googleapis.com/auth/calendar.readonly');
    });
  });

  describe('connectOutlookCalendar', () => {
    it('should generate OAuth URL with Calendars.Read scope', async () => {
      const expectedUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

      mockOAuthService.generateAuthUrl.mockReturnValue(expectedUrl);

      const result = await service.connectOutlookCalendar(mockUserId);

      expect(result.authUrl).toBe(expectedUrl);
      expect(mockOAuthService.generateAuthUrl).toHaveBeenCalledWith({
        scopes: ['Calendars.Read', 'offline_access'],
        userId: mockUserId,
        provider: 'microsoft',
        usePKCE: false,
        integration: 'outlook-calendar',
      });
    });

    it('should request offline_access for refresh token', async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue('https://auth.url');

      await service.connectOutlookCalendar(mockUserId);

      const callArgs = mockOAuthService.generateAuthUrl.mock.calls[0][0];
      expect(callArgs.scopes).toContain('offline_access');
    });
  });

  describe('handleOAuthCallback', () => {
    const mockCode = 'auth-code-123';
    const mockProvider = 'google';

    // Helper to initiate OAuth and get state
    const initiateOAuthAndGetState = async () => {
      mockOAuthService.generateAuthUrl.mockReturnValue(
        `https://accounts.google.com/o/oauth2/auth?state=test-state-123&redirect_uri=...`,
      );
      const result = await service.connectGoogleCalendar(mockUserId);
      return result.state;
    };

    it('should exchange code for tokens and store integration', async () => {
      const mockState = await initiateOAuthAndGetState();

      const mockTokens = {
        access_token: 'access-token-xyz',
        refresh_token: 'refresh-token-abc',
        expires_in: 3600,
      };

      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockOAuthService.encryptToken.mockImplementation((token) => `encrypted_${token}`);
      mockPrismaService.integration.create.mockResolvedValue({
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'GOOGLE_CALENDAR',
      });
      mockPrismaService.calendarSyncConfig.create.mockResolvedValue({
        id: 'config-123',
        userId: mockUserId,
      });

      const result = await service.handleOAuthCallback(mockCode, mockState, mockProvider);

      expect(result.integrationId).toBe(mockIntegrationId);
      expect(result.success).toBe(true);
      expect(mockPrismaService.integration.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          type: 'GOOGLE_CALENDAR',
          name: 'Google Calendar',
          accessToken: 'encrypted_access-token-xyz',
          refreshToken: 'encrypted_refresh-token-abc',
          expiresAt: expect.any(Date),
          isActive: true,
        },
      });
    });

    it('should create CalendarSyncConfig after integration setup', async () => {
      const mockState = await initiateOAuthAndGetState();

      const mockTokens = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
      };

      mockOAuthService.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockOAuthService.encryptToken.mockImplementation((token) => `encrypted_${token}`);
      mockPrismaService.integration.create.mockResolvedValue({
        id: mockIntegrationId,
      });
      mockPrismaService.calendarSyncConfig.create.mockResolvedValue({});

      await service.handleOAuthCallback(mockCode, mockState, mockProvider);

      expect(mockPrismaService.calendarSyncConfig.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          syncEnabled: false, // User needs to select calendars first
          selectedCalendarIds: [],
        },
      });
    });

    it('should validate state parameter to prevent CSRF', async () => {
      // Don't initiate OAuth - state won't be in store
      await expect(
        service.handleOAuthCallback(mockCode, 'invalid-state', mockProvider),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException on token exchange failure', async () => {
      const mockState = await initiateOAuthAndGetState();

      mockOAuthService.exchangeCodeForTokens.mockRejectedValue(
        new Error('Invalid authorization code'),
      );

      await expect(service.handleOAuthCallback(mockCode, mockState, mockProvider)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('fetchEvents', () => {
    const mockIntegration = {
      id: mockIntegrationId,
      userId: mockUserId,
      type: 'GOOGLE_CALENDAR',
      accessToken: 'encrypted-access-token',
      refreshToken: 'encrypted-refresh-token',
      isActive: true,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    };

    beforeEach(() => {
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockImplementation((token) => token.replace('encrypted-', ''));
    });

    it('should fetch upcoming events from Google Calendar', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          summary: 'Team Meeting',
          start: { dateTime: '2025-12-01T10:00:00Z' },
          end: { dateTime: '2025-12-01T11:00:00Z' },
          attendees: [
            { email: 'john@example.com', displayName: 'John Doe' },
            { email: 'jane@example.com', displayName: 'Jane Smith' },
          ],
        },
      ];

      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: mockEvents,
        nextPageToken: null,
      });

      const result = await service.fetchEvents(mockUserId, 'upcoming');

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        externalId: 'event-1',
        subject: 'Team Meeting',
        startTime: expect.any(Date),
        endTime: expect.any(Date),
        attendees: expect.arrayContaining([expect.objectContaining({ email: 'john@example.com' })]),
      });
    });

    it('should fetch past events with time range', async () => {
      const mockEvents = [
        {
          id: 'event-past',
          summary: 'Past Meeting',
          start: { dateTime: '2025-11-20T10:00:00Z' },
          end: { dateTime: '2025-11-20T11:00:00Z' },
          attendees: [],
        },
      ];

      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: mockEvents,
      });

      const result = await service.fetchEvents(mockUserId, 'past', {
        startDate: new Date('2025-11-01'),
        endDate: new Date('2025-11-30'),
      });

      expect(mockGoogleCalendarClient.fetchEvents).toHaveBeenCalledWith(
        'access-token',
        expect.objectContaining({
          timeMin: expect.any(Date),
          timeMax: expect.any(Date),
        }),
      );
      expect(result.events).toHaveLength(1);
    });

    it('should refresh access token when expired', async () => {
      const expiredIntegration = {
        ...mockIntegration,
        expiresAt: new Date(Date.now() - 1000),
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(expiredIntegration);
      mockOAuthService.refreshAccessToken.mockResolvedValue({
        access_token: 'new-access-token',
        expires_in: 3600,
      });
      mockOAuthService.encryptToken.mockReturnValue('encrypted-new-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({ items: [] });

      await service.fetchEvents(mockUserId, 'upcoming');

      expect(mockOAuthService.refreshAccessToken).toHaveBeenCalled();
      expect(mockPrismaService.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accessToken: 'encrypted-new-token',
          }),
        }),
      );
    });

    it('should handle rate limit errors from Google Calendar API', async () => {
      mockGoogleCalendarClient.fetchEvents.mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      });

      await expect(service.fetchEvents(mockUserId, 'upcoming')).rejects.toThrow(
        'Rate limit exceeded',
      );
    });

    it('should support Outlook Calendar integration', async () => {
      const outlookIntegration = {
        ...mockIntegration,
        type: 'OUTLOOK',
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(outlookIntegration);
      mockOutlookCalendarClient.fetchEvents.mockResolvedValue({
        value: [],
      });

      await service.fetchEvents(mockUserId, 'upcoming');

      expect(mockOutlookCalendarClient.fetchEvents).toHaveBeenCalled();
    });
  });

  describe('matchAttendeesToContacts', () => {
    it('should match attendees to existing contacts by email', async () => {
      const attendees = [
        { email: 'john@example.com', displayName: 'John Doe' },
        { email: 'jane@example.com', displayName: 'Jane Smith' },
      ];

      const mockContacts = [
        { id: 'contact-1', email: 'john@example.com', firstName: 'John' },
        { id: 'contact-2', email: 'jane@example.com', firstName: 'Jane' },
      ];

      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue(mockContacts);

      const result = await service.matchAttendeesToContacts(mockUserId, attendees);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('contact-1');
      expect(mockAttendeeMatcherService.matchAttendeesToContacts).toHaveBeenCalledWith(
        mockUserId,
        attendees,
      );
    });

    it('should auto-create contacts for unknown attendees', async () => {
      const attendees = [{ email: 'unknown@example.com', displayName: 'Unknown Person' }];

      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);
      mockAttendeeMatcherService.createContactFromAttendee.mockResolvedValue({
        id: 'new-contact-1',
        email: 'unknown@example.com',
      });

      await service.matchAttendeesToContacts(mockUserId, attendees, { autoCreate: true });

      expect(mockAttendeeMatcherService.createContactFromAttendee).toHaveBeenCalledWith(
        mockUserId,
        attendees[0],
      );
    });

    it('should handle attendees without email addresses', async () => {
      const attendees = [{ displayName: 'No Email Person' }];

      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);

      const result = await service.matchAttendeesToContacts(mockUserId, attendees);

      expect(result).toHaveLength(0);
    });

    it('should batch query contacts for efficiency', async () => {
      const attendees = Array.from({ length: 50 }, (_, i) => ({
        email: `user${i}@example.com`,
        displayName: `User ${i}`,
      }));

      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);

      await service.matchAttendeesToContacts(mockUserId, attendees);

      // Should be called once with all emails, not 50 times
      expect(mockAttendeeMatcherService.matchAttendeesToContacts).toHaveBeenCalledTimes(1);
    });
  });

  describe('createMeetingInteraction', () => {
    const mockEvent = {
      id: 'event-1',
      summary: 'Team Sync',
      description: 'Weekly team sync meeting',
      start: { dateTime: '2025-12-01T10:00:00Z' },
      end: { dateTime: '2025-12-01T11:00:00Z' },
      attendees: [{ email: 'john@example.com', displayName: 'John Doe' }],
    };

    it('should create interaction for calendar event', async () => {
      const mockContacts = [{ id: 'contact-1', email: 'john@example.com' }];

      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue(mockContacts);
      mockPrismaService.interaction.create.mockResolvedValue({
        id: 'interaction-1',
      });

      const result = await service.createMeetingInteraction(mockUserId, mockEvent, 'google');

      expect(mockPrismaService.interaction.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          interactionType: 'meeting',
          occurredAt: expect.any(Date),
          subject: 'Team Sync',
          summary: 'Weekly team sync meeting',
          externalId: 'event-1',
          externalSource: 'google_calendar',
          meetingData: expect.any(Object),
          participants: {
            create: [
              {
                contactId: 'contact-1',
                role: 'attendee',
              },
            ],
          },
        },
      });
      expect(result.id).toBe('interaction-1');
    });

    it('should store event metadata in meetingData field', async () => {
      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);
      mockPrismaService.interaction.create.mockResolvedValue({ id: 'interaction-1' });

      await service.createMeetingInteraction(mockUserId, mockEvent, 'google');

      const createCall = mockPrismaService.interaction.create.mock.calls[0][0];
      expect(createCall.data.meetingData).toMatchObject({
        startTime: expect.any(String),
        endTime: expect.any(String),
        provider: 'google',
      });
    });

    it('should handle events without attendees', async () => {
      const eventWithoutAttendees = {
        ...mockEvent,
        attendees: [],
      };

      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);
      mockPrismaService.interaction.create.mockResolvedValue({ id: 'interaction-1' });

      await service.createMeetingInteraction(mockUserId, eventWithoutAttendees, 'google');

      expect(mockPrismaService.interaction.create).toHaveBeenCalled();
    });

    it('should detect duplicate interactions by externalId', async () => {
      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);
      mockPrismaService.interaction.findUnique.mockResolvedValue({
        id: 'existing-interaction',
        externalId: 'event-1',
      });

      const result = await service.createMeetingInteraction(mockUserId, mockEvent, 'google');

      expect(result.id).toBe('existing-interaction');
      expect(mockPrismaService.interaction.create).not.toHaveBeenCalled();
    });
  });

  describe('updateLastContactDate', () => {
    it('should update lastContact for all meeting participants', async () => {
      const meetingDate = new Date('2025-12-01T10:00:00Z');
      const contactIds = ['contact-1', 'contact-2'];

      mockPrismaService.contact.updateMany.mockResolvedValue({ count: 2 });

      await service.updateLastContactDate(mockUserId, contactIds, meetingDate);

      expect(mockPrismaService.contact.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: contactIds },
          userId: mockUserId,
        },
        data: {
          lastContact: meetingDate,
        },
      });
    });

    it('should only update if meeting date is more recent', async () => {
      const oldMeetingDate = new Date('2025-01-01T10:00:00Z');
      const contactIds = ['contact-1'];

      mockPrismaService.contact.findMany.mockResolvedValue([
        { id: 'contact-1', lastContact: new Date('2025-11-01T10:00:00Z') },
      ]);

      await service.updateLastContactDate(mockUserId, contactIds, oldMeetingDate);

      // Should not update because existing lastContact is more recent
      expect(mockPrismaService.contact.updateMany).not.toHaveBeenCalled();
    });

    it('should handle contacts with null lastContact', async () => {
      const meetingDate = new Date('2025-12-01T10:00:00Z');
      const contactIds = ['contact-1'];

      mockPrismaService.contact.findMany.mockResolvedValue([
        { id: 'contact-1', lastContact: null },
      ]);
      mockPrismaService.contact.updateMany.mockResolvedValue({ count: 1 });

      await service.updateLastContactDate(mockUserId, contactIds, meetingDate);

      expect(mockPrismaService.contact.updateMany).toHaveBeenCalled();
    });
  });

  describe('addMeetingNotes', () => {
    const mockInteractionId = 'interaction-123';
    const mockNotes = 'Discussed Q4 roadmap and team goals';

    it('should add notes to existing interaction', async () => {
      mockPrismaService.interaction.findUnique.mockResolvedValue({
        id: mockInteractionId,
        userId: mockUserId,
      });
      mockPrismaService.interaction.update.mockResolvedValue({
        id: mockInteractionId,
        summary: mockNotes,
      });

      const result = await service.addMeetingNotes(mockUserId, mockInteractionId, mockNotes);

      expect(mockPrismaService.interaction.update).toHaveBeenCalledWith({
        where: { id: mockInteractionId },
        data: { summary: mockNotes },
      });
      expect(result.summary).toBe(mockNotes);
    });

    it('should throw NotFoundException if interaction does not exist', async () => {
      mockPrismaService.interaction.findUnique.mockResolvedValue(null);

      await expect(service.addMeetingNotes(mockUserId, 'non-existent', mockNotes)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should verify user ownership of interaction', async () => {
      mockPrismaService.interaction.findUnique.mockResolvedValue({
        id: mockInteractionId,
        userId: 'different-user',
      });

      await expect(
        service.addMeetingNotes(mockUserId, mockInteractionId, mockNotes),
      ).rejects.toThrow(NotFoundException);
    });

    it('should append notes if existing notes present', async () => {
      mockPrismaService.interaction.findUnique.mockResolvedValue({
        id: mockInteractionId,
        userId: mockUserId,
        summary: 'Initial notes',
      });
      mockPrismaService.interaction.update.mockResolvedValue({
        id: mockInteractionId,
        summary: 'Initial notes\n\nDiscussed Q4 roadmap and team goals',
      });

      await service.addMeetingNotes(mockUserId, mockInteractionId, mockNotes, {
        append: true,
      });

      expect(mockPrismaService.interaction.update).toHaveBeenCalledWith({
        where: { id: mockInteractionId },
        data: { summary: expect.stringContaining('Initial notes') },
      });
    });
  });

  describe('syncUpcomingEvents', () => {
    it('should sync upcoming events from Google Calendar', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          summary: 'Future Meeting',
          start: { dateTime: new Date(Date.now() + 86400000).toISOString() },
          end: { dateTime: new Date(Date.now() + 90000000).toISOString() },
          attendees: [],
        },
      ];

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({ items: mockEvents });
      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue([]);
      mockPrismaService.interaction.upsert.mockResolvedValue({});

      const result = await service.syncUpcomingEvents(mockUserId);

      expect(result.synced).toBe(1);
      expect(mockGoogleCalendarClient.fetchEvents).toHaveBeenCalledWith(
        'decrypted-token',
        expect.objectContaining({
          timeMin: expect.any(Date),
        }),
      );
    });

    it('should not sync past events in upcoming sync', async () => {
      const pastEvent = {
        id: 'past-event',
        summary: 'Past Meeting',
        start: { dateTime: new Date(Date.now() - 86400000).toISOString() },
        end: { dateTime: new Date(Date.now() - 82800000).toISOString() },
        attendees: [],
      };

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({ items: [pastEvent] });

      const result = await service.syncUpcomingEvents(mockUserId);

      expect(result.synced).toBe(0);
    });
  });

  describe('syncPastEvents', () => {
    it('should sync past events within date range', async () => {
      const startDate = new Date('2025-11-01');
      const endDate = new Date('2025-11-30');

      const mockEvents = [
        {
          id: 'event-past-1',
          summary: 'Past Meeting 1',
          start: { dateTime: '2025-11-15T10:00:00Z' },
          end: { dateTime: '2025-11-15T11:00:00Z' },
          attendees: [{ email: 'john@example.com' }],
        },
      ];

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const mockContacts = [{ id: 'contact-1', email: 'john@example.com' }];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({ items: mockEvents });
      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue(mockContacts);
      mockPrismaService.interaction.upsert.mockResolvedValue({});
      mockPrismaService.contact.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.syncPastEvents(mockUserId, startDate, endDate);

      expect(result.synced).toBe(1);
      expect(mockPrismaService.contact.updateMany).toHaveBeenCalled();
    });

    it('should update lastContact for past meeting participants', async () => {
      const startDate = new Date('2025-11-01');
      const endDate = new Date('2025-11-30');

      const mockEvents = [
        {
          id: 'past-event',
          summary: 'Past Meeting',
          start: { dateTime: '2025-11-15T10:00:00Z' },
          end: { dateTime: '2025-11-15T11:00:00Z' },
          attendees: [{ email: 'john@example.com' }],
        },
      ];

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      const mockContacts = [{ id: 'contact-1', email: 'john@example.com' }];

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({ items: mockEvents });
      mockAttendeeMatcherService.matchAttendeesToContacts.mockResolvedValue(mockContacts);
      mockPrismaService.interaction.upsert.mockResolvedValue({});
      mockPrismaService.contact.findMany.mockResolvedValue([
        { id: 'contact-1', lastContact: null },
      ]);
      mockPrismaService.contact.updateMany.mockResolvedValue({ count: 1 });

      await service.syncPastEvents(mockUserId, startDate, endDate);

      expect(mockPrismaService.contact.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            lastContact: expect.any(Date),
          },
        }),
      );
    });
  });

  describe('incrementalSync', () => {
    it('should use syncToken for efficient incremental sync', async () => {
      const mockSyncConfig = {
        id: 'config-123',
        userId: mockUserId,
        syncToken: 'sync-token-abc',
        syncEnabled: true,
      };

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.calendarSyncConfig.findUnique.mockResolvedValue(mockSyncConfig);
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: [],
        nextSyncToken: 'new-sync-token-xyz',
      });

      await service.incrementalSync(mockUserId);

      expect(mockGoogleCalendarClient.fetchEvents).toHaveBeenCalledWith(
        'decrypted-token',
        expect.objectContaining({
          syncToken: 'sync-token-abc',
        }),
      );
    });

    it('should update syncToken after successful sync', async () => {
      const mockSyncConfig = {
        id: 'config-123',
        userId: mockUserId,
        syncToken: 'old-token',
        syncEnabled: true,
      };

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.calendarSyncConfig.findUnique.mockResolvedValue(mockSyncConfig);
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockResolvedValue({
        items: [],
        nextSyncToken: 'new-token-updated',
      });
      mockPrismaService.calendarSyncConfig.update.mockResolvedValue({});

      await service.incrementalSync(mockUserId);

      expect(mockPrismaService.calendarSyncConfig.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: {
          syncToken: 'new-token-updated',
          lastSyncAt: expect.any(Date),
        },
      });
    });

    it('should perform full sync if syncToken is invalid', async () => {
      const mockSyncConfig = {
        id: 'config-123',
        userId: mockUserId,
        syncToken: 'invalid-token',
        syncEnabled: true,
      };

      const mockIntegration = {
        id: mockIntegrationId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
        expiresAt: new Date(Date.now() + 3600000),
      };

      mockPrismaService.calendarSyncConfig.findUnique.mockResolvedValue(mockSyncConfig);
      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockGoogleCalendarClient.fetchEvents.mockRejectedValueOnce({
        status: 410,
        message: 'Sync token expired',
      });
      mockGoogleCalendarClient.fetchEvents.mockResolvedValueOnce({
        items: [],
        nextSyncToken: 'fresh-token',
      });

      await service.incrementalSync(mockUserId);

      // Should be called twice: once with invalid token, once for full sync
      expect(mockGoogleCalendarClient.fetchEvents).toHaveBeenCalledTimes(2);
    });

    it('should respect syncEnabled flag', async () => {
      const mockSyncConfig = {
        id: 'config-123',
        userId: mockUserId,
        syncEnabled: false,
      };

      mockPrismaService.calendarSyncConfig.findUnique.mockResolvedValue(mockSyncConfig);

      const result = await service.incrementalSync(mockUserId);

      expect(result.synced).toBe(0);
      expect(result.skipped).toBe(true);
      expect(mockGoogleCalendarClient.fetchEvents).not.toHaveBeenCalled();
    });
  });

  describe('disconnectCalendar', () => {
    it('should revoke tokens and delete integration', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.calendarSyncConfig.delete.mockResolvedValue({});

      const result = await service.disconnectCalendar(mockUserId);

      expect(mockOAuthService.revokeToken).toHaveBeenCalledWith('decrypted-token', 'google');
      expect(mockPrismaService.integration.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should preserve meeting interaction data after disconnect', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockOAuthService.revokeToken.mockResolvedValue(true);
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.calendarSyncConfig.delete.mockResolvedValue({});

      await service.disconnectCalendar(mockUserId);

      // Should NOT delete interactions
      expect(mockPrismaService.interaction.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle revocation failure gracefully', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'GOOGLE_CALENDAR',
        accessToken: 'encrypted-token',
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockOAuthService.decryptToken.mockReturnValue('decrypted-token');
      mockOAuthService.revokeToken.mockRejectedValue(new Error('Revocation failed'));
      mockPrismaService.integration.delete.mockResolvedValue(mockIntegration);
      mockPrismaService.calendarSyncConfig.delete.mockResolvedValue({});

      // Should still complete disconnection
      await service.disconnectCalendar(mockUserId);

      expect(mockPrismaService.integration.delete).toHaveBeenCalled();
    });
  });

  describe('getCalendarStatus', () => {
    it('should return active calendar integration status', async () => {
      const mockIntegration = {
        id: mockIntegrationId,
        userId: mockUserId,
        type: 'GOOGLE_CALENDAR',
        isActive: true,
        createdAt: new Date(),
      };

      const mockSyncConfig = {
        id: 'config-123',
        userId: mockUserId,
        syncEnabled: true,
        lastSyncAt: new Date(),
      };

      mockPrismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      mockPrismaService.calendarSyncConfig.findUnique.mockResolvedValue(mockSyncConfig);
      mockPrismaService.interaction.findMany.mockResolvedValue(Array(10).fill({}));

      const result = await service.getCalendarStatus(mockUserId);

      expect(result.isConnected).toBe(true);
      expect(result.provider).toBe('google');
      expect(result.totalMeetings).toBe(10);
      expect(result.lastSyncAt).toBeDefined();
    });

    it('should return not connected if no integration exists', async () => {
      mockPrismaService.integration.findUnique.mockResolvedValue(null);

      const result = await service.getCalendarStatus(mockUserId);

      expect(result.isConnected).toBe(false);
      expect(result.totalMeetings).toBe(0);
    });
  });
});
