import { QueueName } from '@/shared/config/bull.config';
import { DatabaseModule } from '@/shared/database/database.module';
import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailSyncModule } from '../email-sync/email-sync.module';
import { OAuthService } from '../shared/oauth.service';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';

/**
 * Gmail Integration Module
 * US-030: Email communication sync
 * Provides Gmail OAuth flow, email sync configuration, and sync operations
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmailSyncModule,
    BullModule.registerQueue({
      name: QueueName.INTEGRATION_SYNC,
    }),
  ],
  controllers: [GmailController],
  providers: [GmailService, OAuthService],
  exports: [GmailService],
})
export class GmailModule {}
