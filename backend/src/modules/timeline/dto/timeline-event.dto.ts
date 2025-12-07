import { TimelineEventType } from './timeline-event-type.enum';

/**
 * DTO representing a single timeline event
 */
export class TimelineEventDto {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Type of event
   */
  type: TimelineEventType;

  /**
   * When the event occurred
   */
  occurredAt: Date;

  /**
   * Event title or subject
   */
  title: string;

  /**
   * Short preview of the content
   */
  snippet?: string;

  /**
   * Direction of communication (for emails)
   */
  direction?: 'inbound' | 'outbound';

  /**
   * How the contact participated in the email (sender, recipient, or CC)
   * Only applicable for email events
   */
  participationType?: 'sender' | 'recipient' | 'cc';

  /**
   * Source of the event (gmail, outlook, manual, etc.)
   */
  source?: string;

  /**
   * Additional event-specific data
   */
  metadata?: Record<string, unknown>;
}
