import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../shared/database/prisma.service';
import { CalendarAttendeeDto } from '../dto';

/**
 * Contact match result from attendee lookup
 */
export interface ContactMatch {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string | null;
}

/**
 * Attendee Matcher Service
 * Matches calendar attendees to existing contacts and creates new contacts
 */
@Injectable()
export class AttendeeMatcherService {
  private readonly logger = new Logger(AttendeeMatcherService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Match attendees to existing contacts by email
   * Uses a single batch query for efficiency
   * @param userId - User ID to scope contact lookup
   * @param attendees - List of calendar attendees
   * @returns Matched contacts
   */
  async matchAttendeesToContacts(
    userId: string,
    attendees: CalendarAttendeeDto[],
  ): Promise<ContactMatch[]> {
    // Filter attendees with valid emails
    const emails = attendees
      .filter((a) => a.email && a.email.trim() !== '')
      .map((a) => a.email!.toLowerCase());

    if (emails.length === 0) {
      return [];
    }

    this.logger.debug(`Matching ${emails.length} attendee emails to contacts`);

    // Single batch query for all emails
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        email: {
          in: emails,
          mode: 'insensitive',
        },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    this.logger.debug(`Found ${contacts.length} matching contacts`);

    return contacts;
  }

  /**
   * Create a new contact from a calendar attendee
   * @param userId - User ID for the contact owner
   * @param attendee - Calendar attendee to convert to contact
   * @returns Created contact
   */
  async createContactFromAttendee(
    userId: string,
    attendee: CalendarAttendeeDto,
  ): Promise<ContactMatch> {
    if (!attendee.email) {
      throw new Error('Cannot create contact without email address');
    }

    // Parse display name into first/last name
    const { firstName, lastName } = this.parseDisplayName(attendee.displayName || attendee.email);

    this.logger.debug(
      `Creating contact from attendee: ${attendee.email} (${firstName} ${lastName})`,
    );

    const contact = await this.prisma.contact.create({
      data: {
        userId,
        firstName,
        lastName,
        email: attendee.email.toLowerCase(),
        source: 'IMPORT',
        metadata: {
          createdFrom: 'calendar_attendee',
          originalDisplayName: attendee.displayName,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    return contact;
  }

  /**
   * Match attendees and optionally create contacts for unmatched ones
   * @param userId - User ID
   * @param attendees - List of attendees
   * @param options - Options for matching behavior
   * @returns All matched/created contacts
   */
  async matchAndCreateContacts(
    userId: string,
    attendees: CalendarAttendeeDto[],
    options?: { autoCreate?: boolean },
  ): Promise<ContactMatch[]> {
    // Filter attendees with valid emails
    const attendeesWithEmail = attendees.filter((a) => a.email && a.email.trim() !== '');

    if (attendeesWithEmail.length === 0) {
      return [];
    }

    // Get existing matches
    const existingContacts = await this.matchAttendeesToContacts(userId, attendeesWithEmail);

    if (!options?.autoCreate) {
      return existingContacts;
    }

    // Find unmatched attendees
    const matchedEmails = new Set(existingContacts.map((c) => c.email?.toLowerCase()));
    const unmatchedAttendees = attendeesWithEmail.filter(
      (a) => !matchedEmails.has(a.email?.toLowerCase()),
    );

    if (unmatchedAttendees.length === 0) {
      return existingContacts;
    }

    this.logger.debug(`Creating ${unmatchedAttendees.length} new contacts from attendees`);

    // Create new contacts for unmatched attendees
    const newContacts: ContactMatch[] = [];
    for (const attendee of unmatchedAttendees) {
      try {
        // Check if contact already exists (race condition protection)
        const existing = await this.prisma.contact.findFirst({
          where: {
            userId,
            email: {
              equals: attendee.email!.toLowerCase(),
              mode: 'insensitive',
            },
            deletedAt: null,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        if (existing) {
          newContacts.push(existing);
        } else {
          const newContact = await this.createContactFromAttendee(userId, attendee);
          newContacts.push(newContact);
        }
      } catch (error) {
        this.logger.warn(
          `Failed to create contact for ${attendee.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return [...existingContacts, ...newContacts];
  }

  /**
   * Parse a display name into first and last name
   * @param displayName - Full name or email to parse
   * @returns Parsed first and last name
   */
  private parseDisplayName(displayName: string): {
    firstName: string;
    lastName: string | null;
  } {
    if (!displayName) {
      return { firstName: 'Unknown', lastName: null };
    }

    // If it's an email, extract the part before @
    if (displayName.includes('@')) {
      const localPart = displayName.split('@')[0];
      // Try to split on common separators
      const parts = localPart!.split(/[._-]/).filter((p) => p.length > 0);
      if (parts.length >= 2) {
        return {
          firstName: this.capitalize(parts[0]!),
          lastName: this.capitalize(parts.slice(1).join(' ')),
        };
      }
      return {
        firstName: this.capitalize(localPart!),
        lastName: null,
      };
    }

    // Split on spaces
    const parts = displayName
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);

    if (parts.length === 0) {
      return { firstName: 'Unknown', lastName: null };
    }

    if (parts.length === 1) {
      return { firstName: parts[0]!, lastName: null };
    }

    // First part is first name, rest is last name
    return {
      firstName: parts[0]!,
      lastName: parts.slice(1).join(' '),
    };
  }

  /**
   * Capitalize the first letter of a string
   */
  private capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}
