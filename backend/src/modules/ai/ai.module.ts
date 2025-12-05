/**
 * AI Module
 * Provides AI-powered features using Vercel AI SDK
 * Supports multiple providers: Google Gemini (default), OpenAI, Anthropic
 * US-051: AI icebreaker message generation
 */

import { ContactsModule } from '@/modules/contacts/contacts.module';
import { DatabaseModule } from '@/shared/database/database.module';
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

// AI Service providers
import { AISummaryJob } from './jobs/ai-summary.job';
import { AIServiceFactory } from './services/ai-service.factory';
import { AnthropicService } from './services/anthropic.service';
import { ContactSummaryService } from './services/contact-summary.service';
import { GeminiService } from './services/gemini.service';
import { OpenAIService } from './services/openai.service';

// US-051: Icebreaker imports
import { IcebreakerController } from './icebreaker/icebreaker.controller';
import { IcebreakerService } from './icebreaker/icebreaker.service';
import { StyleLearnerService } from './icebreaker/services/style-learner.service';
import { ToneAdapterService } from './icebreaker/services/tone-adapter.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    ScheduleModule.forRoot(),
    forwardRef(() => ContactsModule),
  ],
  controllers: [IcebreakerController],
  providers: [
    // AI service providers (all available, factory selects active one)
    GeminiService,
    OpenAIService,
    AnthropicService,
    AIServiceFactory,
    // Other AI services
    ContactSummaryService,
    AISummaryJob,
    // US-051: Icebreaker services
    IcebreakerService,
    ToneAdapterService,
    StyleLearnerService,
  ],
  exports: [
    // Export factory for other modules
    AIServiceFactory,
    // Export individual services for direct access if needed
    GeminiService,
    OpenAIService,
    AnthropicService,
    // Other exports
    ContactSummaryService,
    AISummaryJob,
    IcebreakerService,
  ],
})
export class AIModule {}
