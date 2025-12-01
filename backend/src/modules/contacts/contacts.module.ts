import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ContactsService } from './contacts.service';
import { ContactsController, OrganizationsController } from './contacts.controller';
import { OcrService } from './services/ocr.service';
import { LinkedInEnrichmentService } from './services/linkedin-enrichment.service';
import { ProxycurlClientService } from './services/proxycurl-client.service';
import { ProfileMatcherService } from './services/profile-matcher.service';
import {
  LinkedInEnrichmentController,
  EnrichmentCreditsController,
} from './linkedin-enrichment.controller';
import { DatabaseModule } from '@/shared/database/database.module';
import { EmailSyncModule } from '../integrations/email-sync/email-sync.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, ConfigModule, EmailSyncModule, AIModule],
  providers: [
    ContactsService,
    OcrService,
    LinkedInEnrichmentService,
    ProxycurlClientService,
    ProfileMatcherService,
  ],
  controllers: [
    ContactsController,
    OrganizationsController,
    LinkedInEnrichmentController,
    EnrichmentCreditsController,
  ],
  exports: [ContactsService, LinkedInEnrichmentService],
})
export class ContactsModule {}
