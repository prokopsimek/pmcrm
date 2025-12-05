/**
 * Email Sync Module
 * US-030: Email communication sync
 * Module configuration for email synchronization feature
 */

import { ContactsModule } from '@/modules/contacts/contacts.module';
import { QueueName } from '@/shared/config/bull.config';
import { DatabaseModule } from '@/shared/database/database.module';
import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OAuthService } from '../shared/oauth.service';
import { EmailSyncController } from './email-sync.controller';
import { EmailSyncService } from './email-sync.service';
import { EmailSyncJob } from './jobs/email-sync.job';
import { ContactEmailService } from './services/contact-email.service';
import { EmailMatcherService } from './services/email-matcher.service';
import { GmailClientService } from './services/gmail-client.service';
import { OutlookClientService } from './services/outlook-client.service';
import { SentimentAnalyzerService } from './services/sentiment-analyzer.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue({
      name: QueueName.INTEGRATION_SYNC,
    }),
    forwardRef(() => ContactsModule),
  ],
  controllers: [EmailSyncController],
  providers: [
    EmailSyncService,
    GmailClientService,
    OutlookClientService,
    EmailMatcherService,
    SentimentAnalyzerService,
    ContactEmailService,
    EmailSyncJob,
    OAuthService,
  ],
  exports: [EmailSyncService, ContactEmailService, GmailClientService, EmailMatcherService],
})
export class EmailSyncModule {}
