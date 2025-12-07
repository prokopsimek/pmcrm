import { RelationshipScoreService } from '@/modules/contacts/services/relationship-score.service';
import { Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import type { Integration } from '@prisma/client';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { OAuthService } from '../../shared/oauth.service';
import { CalendarEventDto } from '../dto';
import {
    CalendarContactsPreviewQueryDto,
    CalendarContactsPreviewResponseDto,
    CalendarDuplicateMatchDto,
    CalendarImportSummaryDto,
    ImportCalendarContactsDto,
    ImportCalendarContactsResponseDto,
    PreviewAttendeeDto,
} from '../dto/calendar-import.dto';
import { AttendeeMatcherService } from './attendee-matcher.service';
import { GoogleCalendarClientService } from './google-calendar-client.service';
import { OutlookCalendarClientService } from './outlook-calendar-client.service';

/**
 * Aggregated attendee data with meeting statistics
 */
interface AggregatedAttendee {
  email: string;
  displayName?: string;
  meetingCount: number;
  firstMeetingDate: Date;
  lastMeetingDate: Date;
}

/**
 * Calendar Contact Importer Service
 * Handles importing contacts from calendar event attendees
 */
@Injectable()
export class CalendarContactImporterService {
  private readonly logger = new Logger(CalendarContactImporterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendarClient: GoogleCalendarClientService,
    private readonly outlookCalendarClient: OutlookCalendarClientService,
    private readonly attendeeMatcher: AttendeeMatcherService,
    private readonly oauthService: OAuthService,
    @Inject(forwardRef(() => RelationshipScoreService))
    private readonly relationshipScoreService: RelationshipScoreService,
  ) {}

  /**
   * Preview contacts that can be imported from calendar events
   * Only includes attendees who accepted or responded "maybe" from past events
   * @param userId - User ID
   * @param query - Query parameters (startDate, endDate)
   * @returns Preview response with new contacts and duplicates
   */
  async previewImport(
    userId: string,
    query: CalendarContactsPreviewQueryDto,
  ): Promise<CalendarContactsPreviewResponseDto> {
    const startDate = new Date(query.startDate);
    const endDate = query.endDate ? new Date(query.endDate) : new Date();

    this.logger.log(
      `[previewImport] Starting for user ${userId}, period: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Fetch all calendar events in the date range (only past events)
    this.logger.debug(`[previewImport] Fetching events for user ${userId}`);
    const events = await this.fetchAllEventsInRange(userId, startDate, endDate);
    this.logger.debug(`[previewImport] Fetched ${events.length} past events`);

    // Extract unique attendees with meeting statistics (only accepted/tentative)
    this.logger.debug(`[previewImport] Aggregating attendees from events`);
    const aggregatedAttendees = this.aggregateAttendees(events);
    this.logger.debug(
      `[previewImport] Found ${aggregatedAttendees.length} unique attendees (accepted/tentative only)`,
    );

    // Get existing contacts for comparison
    const existingContacts = await this.prisma.contact.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        company: true,
        source: true,
      },
    });

    // Build email lookup map for existing contacts
    const existingEmailMap = new Map(
      existingContacts.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]),
    );

    // Separate new contacts from duplicates
    const newContacts: PreviewAttendeeDto[] = [];
    const duplicates: CalendarDuplicateMatchDto[] = [];

    for (const attendee of aggregatedAttendees) {
      const previewAttendee = this.toPreviewAttendee(attendee);
      const existingContact = existingEmailMap.get(attendee.email.toLowerCase());

      if (existingContact) {
        duplicates.push({
          attendee: previewAttendee,
          existingContact: {
            id: existingContact.id,
            firstName: existingContact.firstName,
            lastName: existingContact.lastName ?? undefined,
            email: existingContact.email ?? undefined,
            company: existingContact.company ?? undefined,
            source: existingContact.source,
          },
          matchType: 'EXACT',
        });
      } else {
        newContacts.push(previewAttendee);
      }
    }

    // Build summary
    const summary: CalendarImportSummaryDto = {
      totalEvents: events.length,
      totalAttendees: aggregatedAttendees.length,
      newContacts: newContacts.length,
      exactDuplicates: duplicates.length,
      periodStart: startDate,
      periodEnd: endDate,
    };

    return {
      summary,
      newContacts,
      duplicates,
    };
  }

  /**
   * Import contacts from calendar events
   * Only imports attendees who accepted or responded "maybe" from past events
   * Respects skipDuplicates and updateExisting flags for proper duplicate handling
   * @param userId - User ID
   * @param dto - Import parameters
   * @returns Import result
   */
  async importContacts(
    userId: string,
    dto: ImportCalendarContactsDto,
  ): Promise<ImportCalendarContactsResponseDto> {
    const startTime = Date.now();
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : new Date();
    const skipDuplicates = dto.skipDuplicates ?? true;
    const updateExisting = dto.updateExisting ?? false;

    this.logger.log(
      `[importContacts] Starting for user ${userId}, period: ${startDate.toISOString()} to ${endDate.toISOString()}, skipDuplicates: ${skipDuplicates}, updateExisting: ${updateExisting}`,
    );

    // Fetch all calendar events in the date range (only past events)
    this.logger.debug(`[importContacts] Fetching events for user ${userId}`);
    const events = await this.fetchAllEventsInRange(userId, startDate, endDate);
    this.logger.debug(`[importContacts] Fetched ${events.length} past events`);

    // Extract unique attendees
    const aggregatedAttendees = this.aggregateAttendees(events);

    // Filter by selected emails if provided
    let attendeesToImport = aggregatedAttendees;
    if (dto.selectedEmails && dto.selectedEmails.length > 0) {
      const selectedEmailsLower = new Set(dto.selectedEmails.map((e) => e.toLowerCase()));
      attendeesToImport = aggregatedAttendees.filter((a) =>
        selectedEmailsLower.has(a.email.toLowerCase()),
      );
    }

    // Get existing contacts for duplicate check (with full details for updates)
    const existingContacts = await this.prisma.contact.findMany({
      where: {
        userId,
        email: {
          in: attendeesToImport.map((a) => a.email),
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        lastContact: true,
        metadata: true,
      },
    });

    // Build map of existing contacts by email (lowercase)
    const existingContactsMap = new Map(
      existingContacts.map((c) => [c.email!.toLowerCase(), c]),
    );

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: string[] = [];
    const importedContactIds: string[] = [];

    // Get calendar integration for integration links
    const integration = await this.getCalendarIntegration(userId);

    // Import each attendee
    for (const attendee of attendeesToImport) {
      const emailLower = attendee.email.toLowerCase();
      const existingContact = existingContactsMap.get(emailLower);

      // Skip duplicates if requested and not updating
      if (existingContact && skipDuplicates && !updateExisting) {
        skipped++;
        continue;
      }

      try {
        // Parse display name into first/last name
        const { firstName, lastName } = this.parseDisplayName(
          attendee.displayName || attendee.email,
        );

        if (existingContact && updateExisting) {
          // Update existing contact with new calendar data
          const updatedMetadata = {
            ...(existingContact.metadata as object || {}),
            importedFrom: 'calendar',
            meetingCount: attendee.meetingCount,
            firstMeetingDate: attendee.firstMeetingDate.toISOString(),
            lastMeetingDate: attendee.lastMeetingDate.toISOString(),
          };

          await this.prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              // Update lastContact if the new meeting is more recent
              lastContact: existingContact.lastContact
                ? new Date(Math.max(existingContact.lastContact.getTime(), attendee.lastMeetingDate.getTime()))
                : attendee.lastMeetingDate,
              metadata: updatedMetadata,
              updatedAt: new Date(),
            },
          });

          importedContactIds.push(existingContact.id);

          // Update or create integration link if we have integration
          if (integration) {
            await this.prisma.integrationLink.upsert({
              where: {
                integrationId_externalId: {
                  integrationId: integration.id,
                  externalId: `calendar-attendee-${emailLower}`,
                },
              },
              update: {
                contactId: existingContact.id,
                metadata: {
                  source: 'calendar_import',
                  meetingCount: attendee.meetingCount,
                },
              },
              create: {
                integrationId: integration.id,
                contactId: existingContact.id,
                externalId: `calendar-attendee-${emailLower}`,
                metadata: {
                  source: 'calendar_import',
                  meetingCount: attendee.meetingCount,
                },
              },
            });
          }

          updated++;
        } else if (!existingContact) {
          // Create new contact
          const contact = await this.prisma.contact.create({
            data: {
              userId,
              firstName,
              lastName: lastName || '',
              email: attendee.email.toLowerCase(),
              company: this.extractCompanyFromEmail(attendee.email),
              source: 'GOOGLE_CALENDAR',
              lastContact: attendee.lastMeetingDate,
              metadata: {
                importedFrom: 'calendar',
                meetingCount: attendee.meetingCount,
                firstMeetingDate: attendee.firstMeetingDate.toISOString(),
                lastMeetingDate: attendee.lastMeetingDate.toISOString(),
              },
            },
          });

          importedContactIds.push(contact.id);

          // Create integration link if we have integration
          if (integration) {
            await this.prisma.integrationLink.create({
              data: {
                integrationId: integration.id,
                contactId: contact.id,
                externalId: `calendar-attendee-${emailLower}`,
                metadata: {
                  source: 'calendar_import',
                  meetingCount: attendee.meetingCount,
                },
              },
            });
          }

          imported++;
          existingContactsMap.set(emailLower, { ...contact, metadata: contact.metadata }); // Prevent duplicate creation in same batch
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Failed to import ${attendee.email}: ${errorMessage}`);
        this.logger.warn(`Failed to import ${attendee.email}: ${errorMessage}`);
      }
    }

    // Calculate relationship scores for imported contacts
    if (importedContactIds.length > 0) {
      try {
        await this.relationshipScoreService.recalculateForContacts(importedContactIds);
        this.logger.log(
          `Calculated relationship scores for ${importedContactIds.length} imported contacts`,
        );
      } catch (error) {
        this.logger.warn(`Failed to calculate relationship scores after import: ${error}`);
      }
    }

    // Update lastContactImportAt to track when we last imported contacts
    // This allows subsequent imports to only fetch events after this date
    try {
      await this.prisma.calendarSyncConfig.update({
        where: { userId },
        data: { lastContactImportAt: endDate },
      });
      this.logger.debug(
        `[importContacts] Updated lastContactImportAt to ${endDate.toISOString()} for user ${userId}`,
      );
    } catch (error) {
      this.logger.warn(
        `[importContacts] Failed to update lastContactImportAt: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    const duration = Date.now() - startTime;

    this.logger.log(
      `[importContacts] Calendar contact import completed: ${imported} imported, ${updated} updated, ${skipped} skipped, ${failed} failed`,
    );

    return {
      success: failed === 0,
      imported,
      updated,
      skipped,
      failed,
      errors: errors.length > 0 ? errors : undefined,
      duration,
      timestamp: new Date(),
    };
  }

  /**
   * Fetch all calendar events in a date range (handles pagination)
   * Only returns past events (events that have already occurred)
   */
  private async fetchAllEventsInRange(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEventDto[]> {
    const integration = await this.getCalendarIntegration(userId);
    if (!integration) {
      throw new NotFoundException('No active calendar integration found');
    }

    this.logger.debug(
      `[fetchAllEventsInRange] Fetching events for user ${userId}, range: ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    const accessToken = await this.getValidAccessToken(integration);
    const allEvents: CalendarEventDto[] = [];

    if (integration.type === 'GOOGLE_CALENDAR') {
      let pageToken: string | undefined;

      do {
        const response = await this.googleCalendarClient.fetchEvents(accessToken, {
          timeMin: startDate,
          timeMax: endDate,
          maxResults: 2500,
          pageToken,
        });

        allEvents.push(...response.items);
        pageToken = response.nextPageToken;
      } while (pageToken);
    } else if (integration.type === 'OUTLOOK') {
      let nextLink: string | undefined;

      do {
        const response = await this.outlookCalendarClient.fetchEvents(accessToken, {
          startDateTime: startDate,
          endDateTime: endDate,
          top: 100,
        });

        allEvents.push(...response.value);
        nextLink = response.nextLink;
      } while (nextLink);
    }

    // Filter to only include past events (events that have already occurred)
    const now = new Date();
    const pastEvents = allEvents.filter((event) => new Date(event.startTime) < now);

    this.logger.debug(
      `[fetchAllEventsInRange] Fetched ${allEvents.length} total events, ${pastEvents.length} are past events`,
    );

    return pastEvents;
  }

  /**
   * Aggregate attendees from events, combining duplicates
   * Only includes attendees who accepted or responded "maybe" (tentative)
   * Organizers are filtered out (typically the user who owns the calendar)
   */
  private aggregateAttendees(events: CalendarEventDto[]): AggregatedAttendee[] {
    const attendeeMap = new Map<string, AggregatedAttendee>();
    let totalAttendees = 0;
    let skippedNoEmail = 0;
    let skippedOrganizer = 0;
    let skippedResponseStatus = 0;

    for (const event of events) {
      if (!event.attendees) continue;

      const eventDate = new Date(event.startTime);

      for (const attendee of event.attendees) {
        totalAttendees++;

        // Skip attendees without email
        if (!attendee.email) {
          skippedNoEmail++;
          continue;
        }

        // Skip organizers (typically the user who owns the calendar)
        if (attendee.organizer) {
          skippedOrganizer++;
          continue;
        }

        // Only include attendees who accepted or responded "maybe" (tentative)
        // Skip those who declined or haven't responded (needsAction)
        const responseStatus = attendee.responseStatus?.toLowerCase();
        if (responseStatus !== 'accepted' && responseStatus !== 'tentative') {
          skippedResponseStatus++;
          this.logger.debug(
            `[aggregateAttendees] Skipping attendee ${attendee.email} with responseStatus: ${attendee.responseStatus}`,
          );
          continue;
        }

        const emailLower = attendee.email.toLowerCase();
        const existing = attendeeMap.get(emailLower);

        if (existing) {
          // Update existing attendee stats
          existing.meetingCount++;
          if (eventDate < existing.firstMeetingDate) {
            existing.firstMeetingDate = eventDate;
          }
          if (eventDate > existing.lastMeetingDate) {
            existing.lastMeetingDate = eventDate;
          }
          // Keep the most complete display name
          if (attendee.displayName && !existing.displayName) {
            existing.displayName = attendee.displayName;
          }
        } else {
          // Add new attendee
          attendeeMap.set(emailLower, {
            email: attendee.email,
            displayName: attendee.displayName,
            meetingCount: 1,
            firstMeetingDate: eventDate,
            lastMeetingDate: eventDate,
          });
        }
      }
    }

    this.logger.debug(
      `[aggregateAttendees] Processed ${totalAttendees} attendees: ` +
        `${attendeeMap.size} included, ${skippedNoEmail} skipped (no email), ` +
        `${skippedOrganizer} skipped (organizer), ${skippedResponseStatus} skipped (not accepted/tentative)`,
    );

    return Array.from(attendeeMap.values());
  }

  /**
   * Convert aggregated attendee to preview DTO
   */
  private toPreviewAttendee(attendee: AggregatedAttendee): PreviewAttendeeDto {
    const { firstName, lastName } = this.parseDisplayName(attendee.displayName || attendee.email);

    return {
      email: attendee.email,
      displayName: attendee.displayName,
      firstName,
      lastName,
      meetingCount: attendee.meetingCount,
      firstMeetingDate: attendee.firstMeetingDate,
      lastMeetingDate: attendee.lastMeetingDate,
      company: this.extractCompanyFromEmail(attendee.email),
    };
  }

  /**
   * Parse display name into first and last name
   */
  private parseDisplayName(displayName: string): {
    firstName: string;
    lastName?: string;
  } {
    if (!displayName) {
      return { firstName: 'Unknown' };
    }

    // If it's an email, extract the part before @
    if (displayName.includes('@')) {
      const localPart = displayName.split('@')[0]!;
      // Try to split on common separators
      const parts = localPart.split(/[._-]/).filter((p) => p.length > 0);
      if (parts.length >= 2) {
        return {
          firstName: this.capitalize(parts[0]!),
          lastName: this.capitalize(parts.slice(1).join(' ')),
        };
      }
      return {
        firstName: this.capitalize(localPart),
      };
    }

    // Split on spaces
    const parts = displayName
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);

    if (parts.length === 0) {
      return { firstName: 'Unknown' };
    }

    if (parts.length === 1) {
      return { firstName: parts[0]! };
    }

    // First part is first name, rest is last name
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(' '),
    };
  }

  /**
   * Extract company name from email domain
   */
  private extractCompanyFromEmail(email: string): string | undefined {
    const domain = email.split('@')[1];
    if (!domain) return undefined;

    // Skip common email providers
    const commonProviders = [
      'gmail.com',
      'googlemail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'live.com',
      'icloud.com',
      'me.com',
      'mail.com',
      'protonmail.com',
      'proton.me',
    ];

    if (commonProviders.includes(domain.toLowerCase())) {
      return undefined;
    }

    // Extract company name from domain (e.g., company.com -> Company)
    const companyPart = domain.split('.')[0];
    if (companyPart) {
      return this.capitalize(companyPart);
    }

    return undefined;
  }

  /**
   * Capitalize the first letter of a string
   */
  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  /**
   * Get active calendar integration for user
   */
  private async getCalendarIntegration(userId: string) {
    // Try Google Calendar first
    let integration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: 'GOOGLE_CALENDAR',
        },
      },
    });

    if (integration?.isActive) {
      return integration;
    }

    // Try Outlook
    integration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: 'OUTLOOK',
        },
      },
    });

    if (integration?.isActive) {
      return integration;
    }

    return null;
  }

  /**
   * Get valid access token (refresh if expired)
   */
  private async getValidAccessToken(integration: Integration): Promise<string> {
    // Check if token is expired
    if (integration.expiresAt && new Date() >= integration.expiresAt) {
      this.logger.log('Access token expired, refreshing...');

      if (!integration.refreshToken) {
        throw new Error('Calendar token expired and no refresh token available. Please reconnect.');
      }

      const refreshToken = this.oauthService.decryptToken(integration.refreshToken);
      const provider = integration.type === 'GOOGLE_CALENDAR' ? 'google' : 'microsoft';

      const newTokens = await this.oauthService.refreshAccessToken(refreshToken, provider);

      const encryptedAccessToken = this.oauthService.encryptToken(newTokens.access_token);

      // Update integration with new token
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: encryptedAccessToken,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        },
      });

      return newTokens.access_token;
    }

    if (!integration.accessToken) {
      throw new Error('No access token available. Please reconnect your calendar.');
    }

    return this.oauthService.decryptToken(integration.accessToken);
  }
}
