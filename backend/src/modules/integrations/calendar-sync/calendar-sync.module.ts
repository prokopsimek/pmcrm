import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { OutlookCalendarClientService } from './services/outlook-calendar-client.service';
import { AttendeeMatcherService } from './services/attendee-matcher.service';
import { CalendarSyncJob } from './jobs/calendar-sync.job';
import { OAuthService } from '../shared/oauth.service';
import { PrismaService } from '../../../shared/database/prisma.service';

/**
 * Calendar Sync Module
 * Provides Google and Outlook Calendar integration with OAuth, event syncing, and background jobs
 */
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'calendar-sync',
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),
  ],
  controllers: [CalendarSyncController],
  providers: [
    CalendarSyncService,
    GoogleCalendarClientService,
    OutlookCalendarClientService,
    AttendeeMatcherService,
    CalendarSyncJob,
    OAuthService,
    PrismaService,
  ],
  exports: [CalendarSyncService],
})
export class CalendarSyncModule {}
