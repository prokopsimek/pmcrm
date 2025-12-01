/**
 * Email Sync Module
 * US-030: Email communication sync
 * Module configuration for email synchronization feature
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EmailSyncController } from './email-sync.controller';
import { EmailSyncService } from './email-sync.service';
import { GmailClientService } from './services/gmail-client.service';
import { OutlookClientService } from './services/outlook-client.service';
import { EmailMatcherService } from './services/email-matcher.service';
import { SentimentAnalyzerService } from './services/sentiment-analyzer.service';
import { ContactEmailService } from './services/contact-email.service';
import { EmailSyncJob } from './jobs/email-sync.job';
import { DatabaseModule } from '@/shared/database/database.module';
import { QueueName } from '@/shared/config/bull.config';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    BullModule.registerQueue({
      name: QueueName.INTEGRATION_SYNC,
    }),
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
  ],
  exports: [EmailSyncService, ContactEmailService, GmailClientService, EmailMatcherService],
})
export class EmailSyncModule {}
