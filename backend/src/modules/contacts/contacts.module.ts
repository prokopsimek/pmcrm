import { DatabaseModule } from '@/shared/database/database.module';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AIModule } from '../ai/ai.module';
import { EmailSyncModule } from '../integrations/email-sync/email-sync.module';
import { ContactsController, OrganizationsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { RelationshipScoreJob } from './jobs/relationship-score.job';
import {
  EnrichmentCreditsController,
  LinkedInEnrichmentController,
} from './linkedin-enrichment.controller';
import { LinkedInEnrichmentService } from './services/linkedin-enrichment.service';
import { OcrService } from './services/ocr.service';
import { ProfileMatcherService } from './services/profile-matcher.service';
import { ProxycurlClientService } from './services/proxycurl-client.service';
import { RelationshipScoreService } from './services/relationship-score.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    ScheduleModule.forRoot(),
    forwardRef(() => EmailSyncModule),
    forwardRef(() => AIModule),
  ],
  providers: [
    ContactsService,
    OcrService,
    LinkedInEnrichmentService,
    ProxycurlClientService,
    ProfileMatcherService,
    RelationshipScoreService,
    RelationshipScoreJob,
  ],
  controllers: [
    ContactsController,
    OrganizationsController,
    LinkedInEnrichmentController,
    EnrichmentCreditsController,
  ],
  exports: [ContactsService, LinkedInEnrichmentService, RelationshipScoreService],
})
export class ContactsModule {}
