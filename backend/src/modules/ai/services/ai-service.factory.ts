/**
 * AI Service Factory
 * Selects the appropriate AI service based on AI_PROVIDER env var
 * Supports: google (default), openai, anthropic
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { OpenAIService } from './openai.service';
import { AnthropicService } from './anthropic.service';
import type { IAIService } from '../interfaces';
import { LLMProviders, type LLMProvider } from '../icebreaker/types';

@Injectable()
export class AIServiceFactory implements OnModuleInit {
  private readonly logger = new Logger(AIServiceFactory.name);
  private activeService: IAIService;

  constructor(
    private readonly configService: ConfigService,
    private readonly geminiService: GeminiService,
    private readonly openaiService: OpenAIService,
    private readonly anthropicService: AnthropicService,
  ) {
    // Initialize with the configured provider
    this.activeService = this.selectService();
  }

  onModuleInit() {
    const provider = this.getConfiguredProvider();
    const model = this.configService.get<string>('AI_MODEL') || 'default';
    this.logger.log(
      `AI Service Factory initialized: provider=${provider}, model=${model}, available=${this.activeService.isAvailable()}`,
    );
  }

  /**
   * Get the active AI service instance
   */
  getService(): IAIService {
    return this.activeService;
  }

  /**
   * Get the configured provider from env
   */
  getConfiguredProvider(): LLMProvider {
    const provider = this.configService.get<string>('AI_PROVIDER')?.toLowerCase();

    switch (provider) {
      case 'openai':
        return LLMProviders.OPENAI;
      case 'anthropic':
        return LLMProviders.ANTHROPIC;
      case 'google':
      default:
        return LLMProviders.GOOGLE;
    }
  }

  /**
   * Check if the active service is available
   */
  isAvailable(): boolean {
    return this.activeService.isAvailable();
  }

  /**
   * Get provider and model info
   */
  getProviderInfo(): { provider: LLMProvider; model: string; available: boolean } {
    return {
      provider: this.activeService.getProvider(),
      model: this.activeService.getModelVersion(),
      available: this.activeService.isAvailable(),
    };
  }

  /**
   * Select the appropriate service based on configuration
   */
  private selectService(): IAIService {
    const provider = this.getConfiguredProvider();

    switch (provider) {
      case LLMProviders.OPENAI:
        this.logger.debug('Selected OpenAI service');
        return this.openaiService;

      case LLMProviders.ANTHROPIC:
        this.logger.debug('Selected Anthropic service');
        return this.anthropicService;

      case LLMProviders.GOOGLE:
      default:
        this.logger.debug('Selected Google Gemini service');
        return this.geminiService;
    }
  }
}



