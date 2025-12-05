import { ContactsModule } from '@/modules/contacts/contacts.module';
import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../../shared/database/prisma.service';
import { OAuthService } from '../shared/oauth.service';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarSyncJob } from './jobs/calendar-sync.job';
import { AttendeeMatcherService } from './services/attendee-matcher.service';
import { CalendarContactImporterService } from './services/calendar-contact-importer.service';
import { GoogleCalendarClientService } from './services/google-calendar-client.service';
import { OutlookCalendarClientService } from './services/outlook-calendar-client.service';

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
    forwardRef(() => ContactsModule),
  ],
  controllers: [CalendarSyncController],
  providers: [
    CalendarSyncService,
    GoogleCalendarClientService,
    OutlookCalendarClientService,
    AttendeeMatcherService,
    CalendarContactImporterService,
    CalendarSyncJob,
    OAuthService,
    PrismaService,
  ],
  exports: [CalendarSyncService, CalendarContactImporterService],
})
export class CalendarSyncModule {}
