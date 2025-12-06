import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GmailController } from './gmail.controller';
import { GmailService } from './gmail.service';
import { EmailSyncModule } from '../email-sync/email-sync.module';
import { OAuthService } from '../shared/oauth.service';
import { DatabaseModule } from '@/shared/database/database.module';

/**
 * Gmail Integration Module
 * US-030: Email communication sync
 * Provides Gmail OAuth flow, email sync configuration, and sync operations
 */
@Module({
  imports: [ConfigModule, DatabaseModule, EmailSyncModule],
  controllers: [GmailController],
  providers: [GmailService, OAuthService],
  exports: [GmailService],
})
export class GmailModule {}





