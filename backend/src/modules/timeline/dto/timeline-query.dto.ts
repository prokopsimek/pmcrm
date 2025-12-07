import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TimelineEventType } from './timeline-event-type.enum';

/**
 * Query parameters for timeline endpoint
 */
export class TimelineQueryDto {
  /**
   * Filter by specific event types
   */
  @IsOptional()
  @IsArray()
  @IsEnum(TimelineEventType, { each: true })
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  types?: TimelineEventType[];

  /**
   * Search term to filter events
   */
  @IsOptional()
  @IsString()
  search?: string;

  /**
   * Cursor for pagination (ISO date string)
   */
  @IsOptional()
  @IsString()
  cursor?: string;

  /**
   * Number of items per page
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
