/**
 * AI Module
 * Provides AI-powered features using Vercel AI SDK
 * Supports multiple providers: Google Gemini (default), OpenAI, Anthropic
 * US-051: AI icebreaker message generation
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@/shared/database/database.module';

// AI Service providers
import { GeminiService } from './services/gemini.service';
import { OpenAIService } from './services/openai.service';
import { AnthropicService } from './services/anthropic.service';
import { AIServiceFactory } from './services/ai-service.factory';
import { ContactSummaryService } from './services/contact-summary.service';
import { AISummaryJob } from './jobs/ai-summary.job';

// US-051: Icebreaker imports
import { IcebreakerService } from './icebreaker/icebreaker.service';
import { IcebreakerController } from './icebreaker/icebreaker.controller';
import { ToneAdapterService } from './icebreaker/services/tone-adapter.service';
import { StyleLearnerService } from './icebreaker/services/style-learner.service';

@Module({
  imports: [ConfigModule, DatabaseModule, ScheduleModule.forRoot()],
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
