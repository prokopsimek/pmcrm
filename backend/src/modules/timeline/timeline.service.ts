import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TimelineEventDto, TimelineEventType, TimelineQueryDto, TimelineResponseDto } from './dto';

/**
 * Internal type for raw event data before transformation
 */
interface RawTimelineEvent {
  id: string;
  type: TimelineEventType;
  occurredAt: Date;
  title: string;
  snippet?: string;
  direction?: 'inbound' | 'outbound';
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Timeline Service
 * Aggregates events from multiple sources into a unified timeline
 *
 * Data sources:
 * - EmailThread: Email communications
 * - Interaction: Calendar events, meetings, calls
 * - Note: Manual notes
 * - ContactActivity: Other activities (LinkedIn, etc.)
 */
@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get unified timeline for a contact
   * Aggregates events from all sources with filtering and pagination
   */
  async getTimeline(
    userId: string,
    contactId: string,
    query: TimelineQueryDto,
  ): Promise<TimelineResponseDto> {
    // Verify contact exists and belongs to user
    const contact = await this.verifyContactOwnership(userId, contactId);
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    const { types, search, cursor, limit = 20 } = query;

    // Determine which event types to fetch
    const eventTypes = types && types.length > 0 ? types : Object.values(TimelineEventType);

    // Parse cursor for pagination
    const cursorDate = cursor ? new Date(cursor) : null;

    // Fetch events from all relevant sources in parallel
    const [emailEvents, interactionEvents, noteEvents, activityEvents] = await Promise.all([
      this.shouldFetchType(eventTypes, TimelineEventType.EMAIL)
        ? this.fetchEmailEvents(contactId, search, cursorDate, limit + 1)
        : Promise.resolve([]),
      this.shouldFetchInteractions(eventTypes)
        ? this.fetchInteractionEvents(contactId, eventTypes, search, cursorDate, limit + 1)
        : Promise.resolve([]),
      this.shouldFetchType(eventTypes, TimelineEventType.NOTE)
        ? this.fetchNoteEvents(contactId, userId, search, cursorDate, limit + 1)
        : Promise.resolve([]),
      this.shouldFetchActivities(eventTypes)
        ? this.fetchActivityEvents(contactId, eventTypes, search, cursorDate, limit + 1)
        : Promise.resolve([]),
    ]);

    // Merge all events
    const allEvents = [...emailEvents, ...interactionEvents, ...noteEvents, ...activityEvents];

    // Sort by occurredAt descending
    allEvents.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

    // Apply pagination
    const hasMore = allEvents.length > limit;
    const paginatedEvents = allEvents.slice(0, limit);
    const lastEvent = paginatedEvents[paginatedEvents.length - 1];
    const nextCursor = hasMore && lastEvent ? lastEvent.occurredAt.toISOString() : undefined;

    // Transform to response DTOs
    const data: TimelineEventDto[] = paginatedEvents.map(this.toTimelineEventDto);

    // Get total count (approximate for performance)
    const total = await this.getTotalCount(contactId, userId, eventTypes, search);

    return {
      data,
      total,
      nextCursor,
      hasMore,
    };
  }

  /**
   * Check if we should fetch a specific event type
   */
  private shouldFetchType(types: TimelineEventType[], type: TimelineEventType): boolean {
    return types.includes(type);
  }

  /**
   * Check if we should fetch interaction events (meetings, calls)
   */
  private shouldFetchInteractions(types: TimelineEventType[]): boolean {
    return types.some((t) => [TimelineEventType.MEETING, TimelineEventType.CALL].includes(t));
  }

  /**
   * Check if we should fetch activity events (LinkedIn, etc.)
   */
  private shouldFetchActivities(types: TimelineEventType[]): boolean {
    return types.some((t) =>
      [
        TimelineEventType.LINKEDIN_MESSAGE,
        TimelineEventType.LINKEDIN_CONNECTION,
        TimelineEventType.WHATSAPP,
        TimelineEventType.OTHER,
      ].includes(t),
    );
  }

  /**
   * Fetch email events from EmailThread table
   */
  private async fetchEmailEvents(
    contactId: string,
    search: string | undefined,
    cursorDate: Date | null,
    limit: number,
  ): Promise<RawTimelineEvent[]> {
    const where: any = {
      contactId,
    };

    // Apply cursor-based pagination
    if (cursorDate) {
      where.occurredAt = { lt: cursorDate };
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { snippet: { contains: search, mode: 'insensitive' } },
      ];
    }

    const emails = await this.prisma.emailThread.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        subject: true,
        snippet: true,
        direction: true,
        occurredAt: true,
        source: true,
        threadId: true,
        metadata: true,
      },
    });

    return emails.map((email) => ({
      id: email.id,
      type: TimelineEventType.EMAIL,
      occurredAt: email.occurredAt,
      title: email.subject || '(No subject)',
      snippet: email.snippet || undefined,
      direction: email.direction === 'INBOUND' ? 'inbound' : 'outbound',
      source: email.source,
      metadata: {
        threadId: email.threadId,
        ...((email.metadata as Record<string, unknown>) || {}),
      },
    }));
  }

  /**
   * Fetch interaction events (meetings, calls) from Interaction table
   */
  private async fetchInteractionEvents(
    contactId: string,
    types: TimelineEventType[],
    search: string | undefined,
    cursorDate: Date | null,
    limit: number,
  ): Promise<RawTimelineEvent[]> {
    // Map timeline types to interaction types
    const interactionTypes: string[] = [];
    if (types.includes(TimelineEventType.MEETING)) {
      interactionTypes.push('meeting');
    }
    if (types.includes(TimelineEventType.CALL)) {
      interactionTypes.push('call');
    }

    if (interactionTypes.length === 0) {
      return [];
    }

    const where: any = {
      participants: {
        some: { contactId },
      },
      interactionType: { in: interactionTypes },
    };

    // Apply cursor-based pagination
    if (cursorDate) {
      where.occurredAt = { lt: cursorDate };
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { subject: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    const interactions = await this.prisma.interaction.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        interactionType: true,
        subject: true,
        summary: true,
        occurredAt: true,
        externalSource: true,
        externalId: true,
        meetingData: true,
      },
    });

    return interactions.map((interaction) => ({
      id: interaction.id,
      type:
        interaction.interactionType === 'meeting'
          ? TimelineEventType.MEETING
          : TimelineEventType.CALL,
      occurredAt: interaction.occurredAt,
      title:
        interaction.subject || `${interaction.interactionType === 'meeting' ? 'Meeting' : 'Call'}`,
      snippet: interaction.summary || undefined,
      source: interaction.externalSource || 'manual',
      metadata: {
        externalId: interaction.externalId,
        ...((interaction.meetingData as Record<string, unknown>) || {}),
      },
    }));
  }

  /**
   * Fetch note events from Note table
   */
  private async fetchNoteEvents(
    contactId: string,
    userId: string,
    search: string | undefined,
    cursorDate: Date | null,
    limit: number,
  ): Promise<RawTimelineEvent[]> {
    const where: any = {
      contactId,
      userId,
    };

    // Apply cursor-based pagination (using createdAt for notes)
    if (cursorDate) {
      where.createdAt = { lt: cursorDate };
    }

    // Apply search filter
    if (search) {
      where.content = { contains: search, mode: 'insensitive' };
    }

    const notes = await this.prisma.note.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        content: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return notes.map((note) => ({
      id: note.id,
      type: TimelineEventType.NOTE,
      occurredAt: note.createdAt,
      title: 'Note',
      snippet: this.truncateContent(note.content, 200),
      source: 'manual',
      metadata: {
        isPinned: note.isPinned,
        updatedAt: note.updatedAt,
        fullContent: note.content,
      },
    }));
  }

  /**
   * Fetch activity events from ContactActivity table
   */
  private async fetchActivityEvents(
    contactId: string,
    types: TimelineEventType[],
    search: string | undefined,
    cursorDate: Date | null,
    limit: number,
  ): Promise<RawTimelineEvent[]> {
    // Map timeline types to activity types
    const activityTypes: string[] = [];
    if (types.includes(TimelineEventType.LINKEDIN_MESSAGE)) {
      activityTypes.push('LINKEDIN_MESSAGE');
    }
    if (types.includes(TimelineEventType.LINKEDIN_CONNECTION)) {
      activityTypes.push('LINKEDIN_CONNECTION');
    }
    if (types.includes(TimelineEventType.OTHER)) {
      activityTypes.push('OTHER', 'TASK_COMPLETED', 'REMINDER_TRIGGERED');
    }

    if (activityTypes.length === 0) {
      return [];
    }

    const where: any = {
      contactId,
      type: { in: activityTypes },
    };

    // Apply cursor-based pagination
    if (cursorDate) {
      where.occurredAt = { lt: cursorDate };
    }

    // Apply search filter
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const activities = await this.prisma.contactActivity.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        occurredAt: true,
        metadata: true,
      },
    });

    return activities.map((activity) => ({
      id: activity.id,
      type: this.mapActivityTypeToTimelineType(activity.type),
      occurredAt: activity.occurredAt,
      title: activity.title,
      snippet: activity.description || undefined,
      source: 'activity',
      metadata: (activity.metadata as Record<string, unknown>) || {},
    }));
  }

  /**
   * Map ContactActivity type to TimelineEventType
   */
  private mapActivityTypeToTimelineType(activityType: string): TimelineEventType {
    const mapping: Record<string, TimelineEventType> = {
      LINKEDIN_MESSAGE: TimelineEventType.LINKEDIN_MESSAGE,
      LINKEDIN_CONNECTION: TimelineEventType.LINKEDIN_CONNECTION,
      EMAIL: TimelineEventType.EMAIL,
      CALL: TimelineEventType.CALL,
      MEETING: TimelineEventType.MEETING,
      NOTE: TimelineEventType.NOTE,
    };
    return mapping[activityType] || TimelineEventType.OTHER;
  }

  /**
   * Get approximate total count of timeline events
   */
  private async getTotalCount(
    contactId: string,
    userId: string,
    types: TimelineEventType[],
    search: string | undefined,
  ): Promise<number> {
    // For performance, we do a simplified count without search
    // Search would require more complex queries
    const counts = await Promise.all([
      types.includes(TimelineEventType.EMAIL)
        ? this.prisma.emailThread.count({ where: { contactId } })
        : 0,
      this.shouldFetchInteractions(types)
        ? this.prisma.interaction.count({
            where: { participants: { some: { contactId } } },
          })
        : 0,
      types.includes(TimelineEventType.NOTE)
        ? this.prisma.note.count({ where: { contactId, userId } })
        : 0,
      this.shouldFetchActivities(types)
        ? this.prisma.contactActivity.count({ where: { contactId } })
        : 0,
    ]);

    return counts.reduce((sum, count) => sum + count, 0);
  }

  /**
   * Transform raw event to DTO
   */
  private toTimelineEventDto(event: RawTimelineEvent): TimelineEventDto {
    return {
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      title: event.title,
      snippet: event.snippet,
      direction: event.direction,
      source: event.source,
      metadata: event.metadata,
    };
  }

  /**
   * Truncate HTML content to plain text snippet
   */
  private truncateContent(content: string, maxLength: number): string {
    // Strip HTML tags
    const plainText = content.replace(/<[^>]*>/g, '').trim();
    if (plainText.length <= maxLength) {
      return plainText;
    }
    return plainText.substring(0, maxLength) + '...';
  }

  /**
   * Verify contact ownership
   */
  private async verifyContactOwnership(userId: string, contactId: string) {
    return this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
      select: { id: true },
    });
  }
}
