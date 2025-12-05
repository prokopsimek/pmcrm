import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

/**
 * Timeline Module
 * Provides unified timeline aggregating events from multiple sources:
 * - EmailThread: Email communications
 * - Interaction: Calendar events, meetings, calls
 * - Note: Manual notes
 * - ContactActivity: Other activities (LinkedIn, etc.)
 */
@Module({
  imports: [DatabaseModule],
  controllers: [TimelineController],
  providers: [TimelineService],
  exports: [TimelineService],
})
export class TimelineModule {}

