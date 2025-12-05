/**
 * AI Service Factory Unit Tests
 * Tests provider selection based on AI_PROVIDER environment variable
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AIServiceFactory } from './ai-service.factory';
import { GeminiService } from './gemini.service';
import { OpenAIService } from './openai.service';
import { AnthropicService } from './anthropic.service';
import { LLMProviders } from '../icebreaker/types';

describe('AIServiceFactory', () => {
  let factory: AIServiceFactory;
  let configService: jest.Mocked<ConfigService>;
  let geminiService: jest.Mocked<GeminiService>;
  let openaiService: jest.Mocked<OpenAIService>;
  let anthropicService: jest.Mocked<AnthropicService>;

  const createMockService = (provider: string, available: boolean) => ({
    getProvider: jest.fn().mockReturnValue(provider),
    getModelVersion: jest.fn().mockReturnValue('test-model'),
    isAvailable: jest.fn().mockReturnValue(available),
    generateIcebreaker: jest.fn(),
    generateTimelineSummary: jest.fn(),
    generateRecommendations: jest.fn(),
    generateText: jest.fn(),
    summarizeEmailThread: jest.fn(),
  });

  beforeEach(async () => {
    configService = {
      get: jest.fn(),
    } as any;

    geminiService = createMockService(LLMProviders.GOOGLE, true) as any;
    openaiService = createMockService(LLMProviders.OPENAI, true) as any;
    anthropicService = createMockService(LLMProviders.ANTHROPIC, true) as any;
  });

  const createFactory = async (aiProvider?: string) => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'AI_PROVIDER') return aiProvider;
      if (key === 'AI_MODEL') return 'test-model';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIServiceFactory,
        { provide: ConfigService, useValue: configService },
        { provide: GeminiService, useValue: geminiService },
        { provide: OpenAIService, useValue: openaiService },
        { provide: AnthropicService, useValue: anthropicService },
      ],
    }).compile();

    return module.get<AIServiceFactory>(AIServiceFactory);
  };

  describe('Provider Selection', () => {
    it('should select Google Gemini by default when AI_PROVIDER is not set', async () => {
      factory = await createFactory(undefined);

      expect(factory.getConfiguredProvider()).toBe(LLMProviders.GOOGLE);
      expect(factory.getService()).toBe(geminiService);
    });

    it('should select Google Gemini when AI_PROVIDER is "google"', async () => {
      factory = await createFactory('google');

      expect(factory.getConfiguredProvider()).toBe(LLMProviders.GOOGLE);
      expect(factory.getService()).toBe(geminiService);
    });

    it('should select OpenAI when AI_PROVIDER is "openai"', async () => {
      factory = await createFactory('openai');

      expect(factory.getConfiguredProvider()).toBe(LLMProviders.OPENAI);
      expect(factory.getService()).toBe(openaiService);
    });

    it('should select Anthropic when AI_PROVIDER is "anthropic"', async () => {
      factory = await createFactory('anthropic');

      expect(factory.getConfiguredProvider()).toBe(LLMProviders.ANTHROPIC);
      expect(factory.getService()).toBe(anthropicService);
    });

    it('should handle case-insensitive provider names', async () => {
      factory = await createFactory('OPENAI');

      expect(factory.getConfiguredProvider()).toBe(LLMProviders.OPENAI);
      expect(factory.getService()).toBe(openaiService);
    });

    it('should default to Google for unknown providers', async () => {
      factory = await createFactory('unknown-provider');

      expect(factory.getConfiguredProvider()).toBe(LLMProviders.GOOGLE);
      expect(factory.getService()).toBe(geminiService);
    });
  });

  describe('isAvailable', () => {
    it('should return true when active service is available', async () => {
      geminiService.isAvailable.mockReturnValue(true);
      factory = await createFactory('google');

      expect(factory.isAvailable()).toBe(true);
    });

    it('should return false when active service is not available', async () => {
      geminiService.isAvailable.mockReturnValue(false);
      factory = await createFactory('google');

      expect(factory.isAvailable()).toBe(false);
    });
  });

  describe('getProviderInfo', () => {
    it('should return correct provider info', async () => {
      geminiService.getProvider.mockReturnValue(LLMProviders.GOOGLE);
      geminiService.getModelVersion.mockReturnValue('gemini-2.5-flash');
      geminiService.isAvailable.mockReturnValue(true);

      factory = await createFactory('google');
      const info = factory.getProviderInfo();

      expect(info).toEqual({
        provider: LLMProviders.GOOGLE,
        model: 'gemini-2.5-flash',
        available: true,
      });
    });

    it('should return info for OpenAI provider', async () => {
      openaiService.getProvider.mockReturnValue(LLMProviders.OPENAI);
      openaiService.getModelVersion.mockReturnValue('gpt-4o');
      openaiService.isAvailable.mockReturnValue(false);

      factory = await createFactory('openai');
      const info = factory.getProviderInfo();

      expect(info).toEqual({
        provider: LLMProviders.OPENAI,
        model: 'gpt-4o',
        available: false,
      });
    });
  });

  describe('onModuleInit', () => {
    it('should initialize without errors', async () => {
      factory = await createFactory('google');

      // onModuleInit should not throw
      expect(() => factory.onModuleInit()).not.toThrow();
      expect(factory).toBeDefined();
    });
  });
});
