import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CalendarAttendeeDto, CalendarEventDto } from '../dto';

/**
 * Options for fetching calendar events from Google Calendar API
 */
export interface FetchEventsOptions {
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
  pageToken?: string;
  syncToken?: string;
  calendarId?: string;
}

/**
 * Response from Google Calendar API events list
 */
export interface GoogleCalendarEventsResponse {
  items: CalendarEventDto[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Raw Google Calendar event from API
 */
interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  location?: string;
  attendees?: Array<{
    email?: string;
    displayName?: string;
    responseStatus?: string;
    organizer?: boolean;
    optional?: boolean;
  }>;
  htmlLink?: string;
  recurringEventId?: string;
  status?: string;
}

/**
 * Raw Google Calendar API response
 */
interface GoogleCalendarApiResponse {
  kind?: string;
  etag?: string;
  summary?: string;
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Calendar list item from Google Calendar API
 */
export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  selected?: boolean;
}

/**
 * Calendar list API response
 */
interface GoogleCalendarListResponse {
  kind?: string;
  etag?: string;
  items?: GoogleCalendarListItem[];
  nextPageToken?: string;
}

/**
 * Google Calendar Client Service
 * Wrapper for Google Calendar API operations
 */
@Injectable()
export class GoogleCalendarClientService {
  private readonly logger = new Logger(GoogleCalendarClientService.name);
  private readonly CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

  /**
   * Fetch calendar events from Google Calendar API
   * @param accessToken - Valid OAuth access token
   * @param options - Fetch options (date range, pagination, sync token)
   * @returns Events response with items and pagination tokens
   */
  async fetchEvents(
    accessToken: string,
    options?: FetchEventsOptions,
  ): Promise<GoogleCalendarEventsResponse> {
    const calendarId = options?.calendarId || 'primary';
    const url = new URL(
      `${this.CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    );

    // Build query parameters
    if (options?.timeMin) {
      url.searchParams.append('timeMin', options.timeMin.toISOString());
    }
    if (options?.timeMax) {
      url.searchParams.append('timeMax', options.timeMax.toISOString());
    }
    if (options?.maxResults) {
      url.searchParams.append('maxResults', options.maxResults.toString());
    }
    if (options?.pageToken) {
      url.searchParams.append('pageToken', options.pageToken);
    }
    if (options?.syncToken) {
      url.searchParams.append('syncToken', options.syncToken);
    }

    // Request single events (expand recurring events)
    url.searchParams.append('singleEvents', 'true');
    url.searchParams.append('orderBy', 'startTime');

    this.logger.debug(`Fetching events from: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const data: GoogleCalendarApiResponse = await response.json();
    const items = this.transformEvents(data.items || []);

    return {
      items,
      nextPageToken: data.nextPageToken,
      nextSyncToken: data.nextSyncToken,
    };
  }

  /**
   * List all calendars accessible by the user
   * @param accessToken - Valid OAuth access token
   * @returns List of calendars sorted by: primary first, then by summary name
   */
  async listCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
    const url = `${this.CALENDAR_API_BASE}/users/me/calendarList`;

    this.logger.debug('Fetching calendar list');

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const data: GoogleCalendarListResponse = await response.json();

    // Filter to only include calendars with at least reader access
    const calendars = (data.items || []).filter(
      (cal) =>
        cal.accessRole === 'reader' || cal.accessRole === 'writer' || cal.accessRole === 'owner',
    );

    // Sort: primary calendar first, then alphabetically by name
    return calendars.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return (a.summary || '').localeCompare(b.summary || '');
    });
  }

  /**
   * Fetch a single event by ID
   * @param accessToken - Valid OAuth access token
   * @param eventId - Google Calendar event ID
   * @param calendarId - Calendar ID (default: 'primary')
   * @returns Calendar event DTO
   */
  async fetchEventById(
    accessToken: string,
    eventId: string,
    calendarId: string = 'primary',
  ): Promise<CalendarEventDto> {
    const url = `${this.CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const event: GoogleCalendarEvent = await response.json();
    return this.transformEvent(event);
  }

  /**
   * Create a new calendar event
   * @param accessToken - Valid OAuth access token
   * @param event - Event data to create
   * @param calendarId - Calendar ID (default: 'primary')
   * @returns Created event DTO
   */
  async createEvent(
    accessToken: string,
    event: Partial<CalendarEventDto>,
    calendarId: string = 'primary',
  ): Promise<CalendarEventDto> {
    const url = `${this.CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

    const googleEvent = this.toGoogleEvent(event);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const created: GoogleCalendarEvent = await response.json();
    return this.transformEvent(created);
  }

  /**
   * Update an existing calendar event
   * @param accessToken - Valid OAuth access token
   * @param eventId - Event ID to update
   * @param event - Updated event data
   * @param calendarId - Calendar ID (default: 'primary')
   * @returns Updated event DTO
   */
  async updateEvent(
    accessToken: string,
    eventId: string,
    event: Partial<CalendarEventDto>,
    calendarId: string = 'primary',
  ): Promise<CalendarEventDto> {
    const url = `${this.CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;

    const googleEvent = this.toGoogleEvent(event);

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    const updated: GoogleCalendarEvent = await response.json();
    return this.transformEvent(updated);
  }

  /**
   * Transform Google Calendar events to internal DTO format
   */
  private transformEvents(events: GoogleCalendarEvent[]): CalendarEventDto[] {
    return events
      .filter((event) => event.status !== 'cancelled')
      .map((event) => this.transformEvent(event));
  }

  /**
   * Transform a single Google Calendar event to internal DTO format
   */
  private transformEvent(event: GoogleCalendarEvent): CalendarEventDto {
    // Parse start time (dateTime for timed events, date for all-day events)
    const startTime = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : event.start?.date
        ? new Date(event.start.date)
        : new Date();

    // Parse end time
    const endTime = event.end?.dateTime
      ? new Date(event.end.dateTime)
      : event.end?.date
        ? new Date(event.end.date)
        : new Date();

    // Transform attendees
    const attendees: CalendarAttendeeDto[] = (event.attendees || []).map((attendee) => ({
      email: attendee.email,
      displayName: attendee.displayName,
      responseStatus: attendee.responseStatus,
      organizer: attendee.organizer,
      optional: attendee.optional,
    }));

    return {
      externalId: event.id,
      subject: event.summary,
      description: event.description,
      startTime,
      endTime,
      location: event.location,
      attendees,
      externalSource: 'google_calendar',
      htmlLink: event.htmlLink,
      isRecurring: !!event.recurringEventId,
      recurringEventId: event.recurringEventId,
      metadata: {
        provider: 'google',
        originalEvent: {
          id: event.id,
          status: event.status,
        },
      },
    };
  }

  /**
   * Convert internal DTO to Google Calendar event format
   */
  private toGoogleEvent(event: Partial<CalendarEventDto>): Partial<GoogleCalendarEvent> {
    const googleEvent: Partial<GoogleCalendarEvent> = {};

    if (event.subject) {
      googleEvent.summary = event.subject;
    }
    if (event.description) {
      googleEvent.description = event.description;
    }
    if (event.startTime) {
      googleEvent.start = {
        dateTime: new Date(event.startTime).toISOString(),
      };
    }
    if (event.endTime) {
      googleEvent.end = {
        dateTime: new Date(event.endTime).toISOString(),
      };
    }
    if (event.location) {
      googleEvent.location = event.location;
    }
    if (event.attendees) {
      googleEvent.attendees = event.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.optional,
      }));
    }

    return googleEvent;
  }

  /**
   * Handle API errors and throw appropriate exceptions
   */
  private async handleApiError(response: Response): Promise<never> {
    const status = response.status;
    let errorMessage = response.statusText;

    try {
      const errorBody = await response.json();
      errorMessage = errorBody?.error?.message || errorMessage;
    } catch {
      // Use default error message if JSON parsing fails
    }

    this.logger.error(`Google Calendar API error: ${status} - ${errorMessage}`);

    if (status === 401) {
      throw new BadRequestException(
        'Google Calendar authentication expired. Please reconnect your account.',
      );
    }

    if (status === 403) {
      throw new BadRequestException(
        'Google Calendar API access denied. Please enable the Calendar API in Google Cloud Console.',
      );
    }

    if (status === 429) {
      throw { status: 429, message: 'Rate limit exceeded' };
    }

    if (status === 410) {
      // Sync token expired - caller should handle this
      throw { status: 410, message: 'Sync token expired' };
    }

    throw new BadRequestException(`Google Calendar API error: ${errorMessage}`);
  }
}
