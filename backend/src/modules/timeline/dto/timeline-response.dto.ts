import { TimelineEventDto } from './timeline-event.dto';

/**
 * Paginated response for timeline endpoint
 */
export class TimelineResponseDto {
  /**
   * Array of timeline events
   */
  data: TimelineEventDto[];

  /**
   * Total count of events (approximate)
   */
  total: number;

  /**
   * Cursor for next page (ISO date string)
   */
  nextCursor?: string;

  /**
   * Whether there are more items
   */
  hasMore: boolean;
}

