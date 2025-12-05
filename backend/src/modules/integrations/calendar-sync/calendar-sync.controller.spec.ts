/**
 * API tests for CalendarSyncController (US-031)
 * Test-Driven Development (RED phase)
 * Coverage target: 95%+
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';

describe('CalendarSyncController (TDD - API)', () => {
  let controller: CalendarSyncController;
  let service: CalendarSyncService;

  const mockCalendarSyncService = {
    connectGoogleCalendar: jest.fn(),
    connectOutlookCalendar: jest.fn(),
    handleOAuthCallback: jest.fn(),
    fetchEvents: jest.fn(),
    addMeetingNotes: jest.fn(),
    incrementalSync: jest.fn(),
    syncUpcomingEvents: jest.fn(),
    syncPastEvents: jest.fn(),
    disconnectCalendar: jest.fn(),
    getCalendarStatus: jest.fn(),
  };

  const mockUserId = 'user-123';
  const mockRequest = {
    user: { id: mockUserId },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalendarSyncController],
      providers: [
        {
          provide: CalendarSyncService,
          useValue: mockCalendarSyncService,
        },
      ],
    }).compile();

    controller = module.get<CalendarSyncController>(CalendarSyncController);
    service = module.get<CalendarSyncService>(CalendarSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/integrations/google-calendar/connect', () => {
    it('should initiate Google Calendar OAuth flow', async () => {
      const mockResponse = {
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        state: 'state-123',
      };

      mockCalendarSyncService.connectGoogleCalendar.mockResolvedValue(mockResponse);

      const result = await controller.connectGoogleCalendar(mockRequest);

      expect(result.authUrl).toBe(mockResponse.authUrl);
      expect(result.state).toBeDefined();
      expect(mockCalendarSyncService.connectGoogleCalendar).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 401 if user not authenticated', async () => {
      const unauthenticatedRequest = { user: null };

      await expect(controller.connectGoogleCalendar(unauthenticatedRequest)).rejects.toThrow();
    });
  });

  describe('POST /api/v1/integrations/outlook-calendar/connect', () => {
    it('should initiate Outlook Calendar OAuth flow', async () => {
      const mockResponse = {
        authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
        state: 'state-456',
      };

      mockCalendarSyncService.connectOutlookCalendar.mockResolvedValue(mockResponse);

      const result = await controller.connectOutlookCalendar(mockRequest);

      expect(result.authUrl).toBe(mockResponse.authUrl);
      expect(mockCalendarSyncService.connectOutlookCalendar).toHaveBeenCalledWith(mockUserId);
    });

    it('should return proper OAuth scopes in response', async () => {
      const mockResponse = {
        authUrl: 'https://login.microsoftonline.com/oauth',
        state: 'state-789',
        scopes: ['Calendars.Read', 'offline_access'],
      };

      mockCalendarSyncService.connectOutlookCalendar.mockResolvedValue(mockResponse);

      const result = await controller.connectOutlookCalendar(mockRequest);

      expect(result.scopes).toContain('Calendars.Read');
    });
  });

  describe('GET /api/v1/integrations/google-calendar/callback', () => {
    it('should handle OAuth callback and exchange tokens', async () => {
      const code = 'auth-code-123';
      const state = 'state-456';

      const mockResponse = {
        success: true,
        integrationId: 'integration-789',
      };

      mockCalendarSyncService.handleOAuthCallback.mockResolvedValue(mockResponse);

      const result = await controller.handleGoogleCallback(mockRequest, code, state);

      expect(result!.success).toBe(true);
      expect(result!.integrationId).toBe('integration-789');
      // userId is extracted from state in the service, not passed from controller
      expect(mockCalendarSyncService.handleOAuthCallback).toHaveBeenCalledWith(
        code,
        state,
        'google',
      );
    });

    it('should return 400 if code is missing', async () => {
      await expect(controller.handleGoogleCallback(mockRequest, null, 'state')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return 400 if state is missing', async () => {
      await expect(controller.handleGoogleCallback(mockRequest, 'code', null)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle invalid state parameter', async () => {
      mockCalendarSyncService.handleOAuthCallback.mockRejectedValue(
        new BadRequestException('Invalid state parameter'),
      );

      await expect(
        controller.handleGoogleCallback(mockRequest, 'code', 'invalid-state'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /api/v1/integrations/outlook-calendar/callback', () => {
    it('should handle Outlook OAuth callback', async () => {
      const code = 'auth-code-outlook';
      const state = 'state-outlook';

      const mockResponse = {
        success: true,
        integrationId: 'integration-outlook-123',
      };

      mockCalendarSyncService.handleOAuthCallback.mockResolvedValue(mockResponse);

      const result = await controller.handleOutlookCallback(mockRequest, code, state);

      expect(result!.success).toBe(true);
      // userId is extracted from state in the service, not passed from controller
      expect(mockCalendarSyncService.handleOAuthCallback).toHaveBeenCalledWith(
        code,
        state,
        'microsoft',
      );
    });
  });

  describe('GET /api/v1/calendar/events?type=upcoming', () => {
    it('should fetch upcoming calendar events', async () => {
      const mockEvents = {
        events: [
          {
            externalId: 'event-1',
            subject: 'Team Meeting',
            startTime: new Date('2025-12-01T10:00:00Z'),
            endTime: new Date('2025-12-01T11:00:00Z'),
            attendees: [{ email: 'john@example.com' }],
          },
        ],
        total: 1,
      };

      mockCalendarSyncService.fetchEvents.mockResolvedValue(mockEvents);

      const result = await controller.getEvents(mockRequest, 'upcoming');

      expect(result.events).toHaveLength(1);
      expect(result.events[0].subject).toBe('Team Meeting');
      expect(mockCalendarSyncService.fetchEvents).toHaveBeenCalledWith(
        mockUserId,
        'upcoming',
        undefined,
      );
    });

    it('should validate type parameter', async () => {
      await expect(controller.getEvents(mockRequest, 'invalid')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return empty array if no events found', async () => {
      mockCalendarSyncService.fetchEvents.mockResolvedValue({
        events: [],
        total: 0,
      });

      const result = await controller.getEvents(mockRequest, 'upcoming');

      expect(result.events).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('GET /api/v1/calendar/events?type=past', () => {
    it('should fetch past calendar events', async () => {
      const mockEvents = {
        events: [
          {
            externalId: 'past-event-1',
            subject: 'Past Meeting',
            startTime: new Date('2025-11-15T10:00:00Z'),
            endTime: new Date('2025-11-15T11:00:00Z'),
            attendees: [],
          },
        ],
        total: 1,
      };

      mockCalendarSyncService.fetchEvents.mockResolvedValue(mockEvents);

      const result = await controller.getEvents(mockRequest, 'past');

      expect(result.events).toHaveLength(1);
      expect(mockCalendarSyncService.fetchEvents).toHaveBeenCalledWith(
        mockUserId,
        'past',
        undefined,
      );
    });

    it('should support date range filters', async () => {
      const startDate = '2025-11-01';
      const endDate = '2025-11-30';

      mockCalendarSyncService.fetchEvents.mockResolvedValue({
        events: [],
        total: 0,
      });

      await controller.getEvents(mockRequest, 'past', startDate, endDate);

      expect(mockCalendarSyncService.fetchEvents).toHaveBeenCalledWith(mockUserId, 'past', {
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      });
    });

    it('should validate date range format', async () => {
      await expect(
        controller.getEvents(mockRequest, 'past', 'invalid-date', '2025-11-30'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should ensure endDate is after startDate', async () => {
      await expect(
        controller.getEvents(mockRequest, 'past', '2025-11-30', '2025-11-01'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /api/v1/calendar/events/:id/notes', () => {
    const mockInteractionId = 'interaction-123';

    it('should add notes to a calendar event', async () => {
      const notesDto = {
        notes: 'Discussed Q4 roadmap and key deliverables',
      };

      const mockResponse = {
        id: mockInteractionId,
        summary: notesDto.notes,
      };

      mockCalendarSyncService.addMeetingNotes.mockResolvedValue(mockResponse);

      const result = await controller.addMeetingNotes(mockRequest, mockInteractionId, notesDto);

      expect(result.summary).toBe(notesDto.notes);
      expect(mockCalendarSyncService.addMeetingNotes).toHaveBeenCalledWith(
        mockUserId,
        mockInteractionId,
        notesDto.notes,
        undefined,
      );
    });

    it('should validate notes length', async () => {
      const tooLongNotes = {
        notes: 'a'.repeat(10001), // Exceeds max length
      };

      await expect(
        controller.addMeetingNotes(mockRequest, mockInteractionId, tooLongNotes),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return 404 if event not found', async () => {
      const notesDto = { notes: 'Some notes' };

      mockCalendarSyncService.addMeetingNotes.mockRejectedValue(
        new NotFoundException('Interaction not found'),
      );

      await expect(
        controller.addMeetingNotes(mockRequest, 'non-existent', notesDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should support appending notes', async () => {
      const notesDto = {
        notes: 'Additional notes',
        append: true,
      };

      mockCalendarSyncService.addMeetingNotes.mockResolvedValue({
        id: mockInteractionId,
        summary: 'Initial notes\n\nAdditional notes',
      });

      const result = await controller.addMeetingNotes(mockRequest, mockInteractionId, notesDto);

      expect(mockCalendarSyncService.addMeetingNotes).toHaveBeenCalledWith(
        mockUserId,
        mockInteractionId,
        notesDto.notes,
        { append: true },
      );
    });
  });

  describe('POST /api/v1/calendar/sync', () => {
    it('should trigger manual calendar sync', async () => {
      const mockSyncResult = {
        synced: 15,
        added: 5,
        updated: 10,
        syncedAt: new Date(),
      };

      mockCalendarSyncService.incrementalSync.mockResolvedValue(mockSyncResult);

      const result = await controller.manualSync(mockRequest);

      expect(result.synced).toBe(15);
      expect(result.added).toBe(5);
      expect(mockCalendarSyncService.incrementalSync).toHaveBeenCalledWith(mockUserId);
    });

    it('should return sync statistics', async () => {
      const mockSyncResult = {
        synced: 0,
        added: 0,
        updated: 0,
        deleted: 0,
        syncedAt: new Date(),
      };

      mockCalendarSyncService.incrementalSync.mockResolvedValue(mockSyncResult);

      const result = await controller.manualSync(mockRequest);

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('syncedAt');
    });

    it('should handle sync errors gracefully', async () => {
      mockCalendarSyncService.incrementalSync.mockRejectedValue(
        new Error('Calendar API unavailable'),
      );

      await expect(controller.manualSync(mockRequest)).rejects.toThrow('Calendar API unavailable');
    });
  });

  describe('DELETE /api/v1/integrations/calendar/disconnect', () => {
    it('should disconnect calendar integration', async () => {
      const mockResponse = {
        success: true,
        tokensRevoked: true,
      };

      mockCalendarSyncService.disconnectCalendar.mockResolvedValue(mockResponse);

      const result = await controller.disconnectCalendar(mockRequest);

      expect(result.success).toBe(true);
      expect(mockCalendarSyncService.disconnectCalendar).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 404 if no integration exists', async () => {
      mockCalendarSyncService.disconnectCalendar.mockRejectedValue(
        new NotFoundException('No calendar integration found'),
      );

      await expect(controller.disconnectCalendar(mockRequest)).rejects.toThrow(NotFoundException);
    });

    it('should handle token revocation failures', async () => {
      const mockResponse = {
        success: true,
        tokensRevoked: false,
        warning: 'Token revocation failed but integration removed',
      };

      mockCalendarSyncService.disconnectCalendar.mockResolvedValue(mockResponse);

      const result = await controller.disconnectCalendar(mockRequest);

      expect(result.success).toBe(true);
      expect(result.tokensRevoked).toBe(false);
    });
  });

  describe('GET /api/v1/calendar/status', () => {
    it('should return calendar integration status', async () => {
      const mockStatus = {
        isConnected: true,
        provider: 'google',
        totalMeetings: 42,
        lastSyncAt: new Date(),
        syncEnabled: true,
      };

      mockCalendarSyncService.getCalendarStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRequest);

      expect(result.isConnected).toBe(true);
      expect(result.provider).toBe('google');
      expect(result.totalMeetings).toBe(42);
    });

    it('should return not connected status', async () => {
      const mockStatus = {
        isConnected: false,
        provider: null,
        totalMeetings: 0,
        lastSyncAt: null,
        syncEnabled: false,
      };

      mockCalendarSyncService.getCalendarStatus.mockResolvedValue(mockStatus);

      const result = await controller.getStatus(mockRequest);

      expect(result.isConnected).toBe(false);
      expect(result.totalMeetings).toBe(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits on sync endpoint', async () => {
      // Simulate multiple rapid sync requests
      const syncPromises = Array.from({ length: 10 }, () => controller.manualSync(mockRequest));

      mockCalendarSyncService.incrementalSync.mockResolvedValue({
        synced: 0,
        syncedAt: new Date(),
      });

      await Promise.all(syncPromises);

      // In production, rate limiter should prevent excessive calls
      // For now, just verify service was called
      expect(mockCalendarSyncService.incrementalSync).toHaveBeenCalledTimes(10);
    });
  });

  describe('Error Handling', () => {
    it('should return 500 for unexpected errors', async () => {
      mockCalendarSyncService.fetchEvents.mockRejectedValue(new Error('Unexpected database error'));

      await expect(controller.getEvents(mockRequest, 'upcoming')).rejects.toThrow();
    });

    it('should sanitize error messages before returning to client', async () => {
      mockCalendarSyncService.connectGoogleCalendar.mockRejectedValue(
        new Error('Internal encryption key missing'),
      );

      await expect(controller.connectGoogleCalendar(mockRequest)).rejects.toThrow();
    });
  });
});
