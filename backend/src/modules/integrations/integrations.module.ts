import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailSyncModule } from './email-sync/email-sync.module';
import { GmailModule } from './gmail/gmail.module';
import { CalendarSyncModule } from './calendar-sync/calendar-sync.module';
import { GoogleContactsController } from './google-contacts/google-contacts.controller';
import { GoogleContactsService } from './google-contacts/google-contacts.service';
import { MicrosoftContactsController } from './microsoft-contacts/microsoft-contacts.controller';
import { MicrosoftContactsService } from './microsoft-contacts/microsoft-contacts.service';
import { GraphApiService } from './microsoft-contacts/services/graph-api.service';
import { ConflictResolverService } from './microsoft-contacts/services/conflict-resolver.service';
import { OAuthService } from './shared/oauth.service';
import { DeduplicationService } from './shared/deduplication.service';
import { PrismaService } from '../../shared/database/prisma.service';

@Module({
  imports: [EmailSyncModule, GmailModule, CalendarSyncModule, ConfigModule],
  controllers: [GoogleContactsController, MicrosoftContactsController],
  providers: [
    GoogleContactsService,
    MicrosoftContactsService,
    GraphApiService,
    ConflictResolverService,
    OAuthService,
    DeduplicationService,
    PrismaService,
  ],
  exports: [
    EmailSyncModule,
    GmailModule,
    CalendarSyncModule,
    GoogleContactsService,
    MicrosoftContactsService,
  ],
})
export class IntegrationsModule {}
