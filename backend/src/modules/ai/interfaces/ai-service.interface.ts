/**
 * Abstract AI Service Interface
 * All AI providers (Google, OpenAI, Anthropic) must implement this interface
 */

import type { GenerationContext, MessageVariation, LLMProvider } from '../icebreaker/types';

// Re-export shared schemas types
export type { AIRecommendation, TimelineSummary } from '../services/gemini.service';

/**
 * Result of icebreaker generation
 */
export interface IcebreakerResult {
  variations: MessageVariation[];
  generationTimeMs: number;
  modelVersion: string;
  promptVersion: string;
}

/**
 * Email input for timeline analysis
 */
export interface EmailInput {
  subject: string;
  snippet: string;
  direction: 'inbound' | 'outbound';
  date: Date;
}

/**
 * Contact information for recommendations
 */
export interface ContactInfoInput {
  company?: string;
  position?: string;
  lastContactDate?: Date;
  tags?: string[];
}

/**
 * Reminder input for context
 */
export interface ReminderInput {
  title: string;
  scheduledFor: Date;
}

/**
 * Timeline summary result
 */
export interface TimelineSummaryResult {
  summary: string;
  topics: Array<{
    topic: string;
    lastDiscussed: string;
    status: 'ongoing' | 'resolved' | 'needs_attention';
  }>;
  relationshipStrength: 'strong' | 'moderate' | 'weak' | 'new';
  communicationStyle: string;
}

/**
 * AI recommendation result
 */
export interface AIRecommendationResult {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'follow_up' | 'meeting' | 'email' | 'call' | 'other';
}

/**
 * Abstract AI Service Interface
 * Defines the contract for all AI provider implementations
 */
export interface IAIService {
  /**
   * Get the provider identifier
   */
  getProvider(): LLMProvider;

  /**
   * Get the current model version
   */
  getModelVersion(): string;

  /**
   * Check if the AI service is available (API key configured)
   */
  isAvailable(): boolean;

  /**
   * Generate icebreaker message variations (US-051)
   */
  generateIcebreaker(context: GenerationContext): Promise<IcebreakerResult>;

  /**
   * Generate timeline summary from email history
   */
  generateTimelineSummary(
    contactName: string,
    emails: EmailInput[],
  ): Promise<TimelineSummaryResult>;

  /**
   * Generate next steps recommendations
   */
  generateRecommendations(
    contactName: string,
    contactInfo: ContactInfoInput,
    emails: EmailInput[],
    existingReminders?: ReminderInput[],
  ): Promise<AIRecommendationResult[]>;

  /**
   * Generate simple text completion
   */
  generateText(prompt: string): Promise<string>;

  /**
   * Summarize an email thread
   */
  summarizeEmailThread(subject: string, body: string, contactName: string): Promise<string>;
}

/**
 * AI Service injection token
 */
export const AI_SERVICE = Symbol('AI_SERVICE');



