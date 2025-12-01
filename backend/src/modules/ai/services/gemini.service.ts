/**
 * Google Gemini AI Service
 * Implements IAIService using Vercel AI SDK with Google Gemini
 * Configurable model selection via AI_MODEL env var
 * US-051: AI icebreaker message generation
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import type { GenerationContext, MessageVariation, LLMProvider } from '../icebreaker/types';
import { LLMProviders } from '../icebreaker/types';
import { buildPrompt, PROMPT_VERSION } from '../icebreaker/templates/prompts';
import type {
  IAIService,
  IcebreakerResult,
  EmailInput,
  ContactInfoInput,
  ReminderInput,
  TimelineSummaryResult,
  AIRecommendationResult,
} from '../interfaces';

// Schema for AI-generated recommendations
const RecommendationsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().describe('Short actionable title'),
        description: z.string().describe('Detailed description of the action'),
        priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
        category: z
          .enum(['follow_up', 'meeting', 'email', 'call', 'other'])
          .describe('Action category'),
      }),
    )
    .max(5),
});

// Schema for timeline summary
const TimelineSummarySchema = z.object({
  summary: z.string().describe('Overall summary of communication history'),
  topics: z.array(
    z.object({
      topic: z.string().describe('Topic discussed'),
      lastDiscussed: z.string().describe('When this was last discussed'),
      status: z.enum(['ongoing', 'resolved', 'needs_attention']).describe('Current status'),
    }),
  ),
  relationshipStrength: z
    .enum(['strong', 'moderate', 'weak', 'new'])
    .describe('Relationship strength assessment'),
  communicationStyle: z.string().describe('Brief note on communication style'),
});

// Schema for icebreaker message variations (US-051)
const IcebreakerVariationsSchema = z.object({
  variations: z
    .array(
      z.object({
        subject: z.string().optional().describe('Email subject line (only for email channel)'),
        body: z.string().describe('The main message content'),
        talkingPoints: z.array(z.string()).describe('Key talking points'),
        reasoning: z.string().describe('Brief explanation of approach taken'),
      }),
    )
    .length(3)
    .describe('Exactly 3 message variations'),
});

export type AIRecommendation = z.infer<typeof RecommendationsSchema>['recommendations'][number];
export type TimelineSummary = z.infer<typeof TimelineSummarySchema>;

@Injectable()
export class GeminiService implements IAIService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly model: ReturnType<typeof google>;
  private readonly apiKey: string | undefined;
  private readonly modelName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GOOGLE_AI_API_KEY');

    if (!this.apiKey) {
      this.logger.warn('GOOGLE_AI_API_KEY not configured - AI features will be disabled');
    }

    // Use configurable model, default to gemini-2.5-flash
    this.modelName =
      this.configService.get<string>('AI_MODEL') || 'gemini-2.5-flash-preview-05-20';
    this.model = google(this.modelName);

    this.logger.log(`Gemini AI Service initialized with model: ${this.modelName}`);
  }

  /**
   * Get the provider identifier
   */
  getProvider(): LLMProvider {
    return LLMProviders.GOOGLE;
  }

  /**
   * Check if AI service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate timeline summary from email history
   */
  async generateTimelineSummary(
    contactName: string,
    emails: EmailInput[],
  ): Promise<TimelineSummaryResult> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available - API key not configured');
    }

    const emailContext = emails
      .slice(0, 50) // Limit to last 50 emails for context window
      .map(
        (e) =>
          `[${e.date.toISOString().split('T')[0]}] ${e.direction === 'outbound' ? 'You → ' : '← '}${contactName}: ${e.subject}\n${e.snippet}`,
      )
      .join('\n\n');

    const { object } = await generateObject({
      model: this.model,
      schema: TimelineSummarySchema,
      prompt: `Analyze the following email communication history with ${contactName} and provide a structured summary.

EMAIL HISTORY:
${emailContext}

Provide:
1. A concise summary of the overall communication history
2. Key topics discussed with their current status
3. Assessment of relationship strength
4. Brief note on communication style/patterns`,
    });

    return object;
  }

  /**
   * Generate next steps recommendations based on communication history
   */
  async generateRecommendations(
    contactName: string,
    contactInfo: ContactInfoInput,
    emails: EmailInput[],
    existingReminders?: ReminderInput[],
  ): Promise<AIRecommendationResult[]> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available - API key not configured');
    }

    const emailContext = emails
      .slice(0, 30) // Limit to last 30 emails for recommendations
      .map(
        (e) =>
          `[${e.date.toISOString().split('T')[0]}] ${e.direction === 'outbound' ? 'You → ' : '← '}${contactName}: ${e.subject}\n${e.snippet}`,
      )
      .join('\n\n');

    const contextInfo = [
      contactInfo.company && `Company: ${contactInfo.company}`,
      contactInfo.position && `Position: ${contactInfo.position}`,
      contactInfo.lastContactDate &&
        `Last contact: ${contactInfo.lastContactDate.toISOString().split('T')[0]}`,
      contactInfo.tags?.length && `Tags: ${contactInfo.tags.join(', ')}`,
    ]
      .filter(Boolean)
      .join('\n');

    const remindersContext = existingReminders?.length
      ? `\nEXISTING REMINDERS:\n${existingReminders.map((r) => `- ${r.title} (${r.scheduledFor.toISOString().split('T')[0]})`).join('\n')}`
      : '';

    const { object } = await generateObject({
      model: this.model,
      schema: RecommendationsSchema,
      prompt: `Based on the email communication history with ${contactName}, suggest actionable next steps.

CONTACT INFO:
${contextInfo}

EMAIL HISTORY:
${emailContext}
${remindersContext}

Generate 3-5 specific, actionable recommendations for maintaining/improving this relationship.
Consider:
- Open topics or pending items from emails
- Time since last meaningful contact
- Relationship stage and appropriate follow-up frequency
- Any upcoming events or deadlines mentioned
Do NOT suggest actions that are already covered by existing reminders.`,
    });

    return object.recommendations;
  }

  /**
   * Generate a simple text completion (for custom prompts)
   */
  async generateText(prompt: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available - API key not configured');
    }

    const { text } = await generateText({
      model: this.model,
      prompt,
    });

    return text;
  }

  /**
   * Summarize a single email thread
   */
  async summarizeEmailThread(subject: string, body: string, contactName: string): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available - API key not configured');
    }

    const { text } = await generateText({
      model: this.model,
      prompt: `Summarize this email thread with ${contactName} in 2-3 sentences. Focus on key points and any action items.

Subject: ${subject}

Content:
${body.slice(0, 3000)}`, // Limit body to prevent token overflow
    });

    return text;
  }

  /**
   * Generate icebreaker message variations (US-051)
   * Creates personalized outreach messages based on contact and user context
   */
  async generateIcebreaker(context: GenerationContext): Promise<IcebreakerResult> {
    if (!this.isAvailable()) {
      throw new Error('AI service not available - API key not configured');
    }

    const startTime = Date.now();

    this.logger.debug(`Generating icebreaker for ${context.contact.contactName}`);

    // Build prompt using the template
    const promptVariables = {
      contactName: context.contact.contactName,
      currentTitle: context.contact.currentTitle,
      currentCompany: context.contact.currentCompany,
      relationshipSummary: context.contact.relationshipSummary,
      lastInteractionDate: context.contact.lastInteractionDate?.toLocaleDateString(),
      triggerEvent: context.contact.triggerEvent,
      mutualConnections: context.contact.mutualConnections?.join(', '),
      userName: context.user.userName,
      userTitle: context.user.userTitle,
      writingStyleProfile: context.user.writingStyleProfile
        ? this.formatWritingStyle(context.user.writingStyleProfile)
        : undefined,
      channel: context.channel,
      tone: context.tone,
      wordLimit: context.wordLimit || 150,
    };

    const prompt = buildPrompt(promptVariables);

    try {
      const { object } = await generateObject({
        model: this.model,
        schema: IcebreakerVariationsSchema,
        prompt,
      });

      const generationTimeMs = Date.now() - startTime;

      // Add variationIndex to each variation
      const variations: MessageVariation[] = object.variations.map((v, index) => ({
        subject: v.subject,
        body: v.body,
        talkingPoints: v.talkingPoints,
        reasoning: v.reasoning,
        variationIndex: index,
      }));

      this.logger.log(
        `Generated ${variations.length} icebreaker variations in ${generationTimeMs}ms`,
      );

      return {
        variations,
        generationTimeMs,
        modelVersion: this.getModelVersion(),
        promptVersion: PROMPT_VERSION,
      };
    } catch (error) {
      this.logger.error('Failed to generate icebreaker', error);
      // Return fallback variations on error
      return {
        variations: this.generateFallbackVariations(),
        generationTimeMs: Date.now() - startTime,
        modelVersion: this.getModelVersion(),
        promptVersion: PROMPT_VERSION,
      };
    }
  }

  /**
   * Get the current model version
   */
  getModelVersion(): string {
    return this.modelName;
  }

  /**
   * Format writing style profile for prompt
   */
  private formatWritingStyle(style: any): string {
    const traits = style.personalityTraits?.join(', ') || 'professional';
    const formality =
      style.formalityScore >= 0.7 ? 'Formal' : style.formalityScore >= 0.4 ? 'Balanced' : 'Casual';
    return `${formality} style, typically ${style.avgWordCount} words, traits: ${traits}`;
  }

  /**
   * Generate fallback variations when AI generation fails
   */
  private generateFallbackVariations(): MessageVariation[] {
    return [
      {
        subject: 'Reaching out',
        body: "Hi, I wanted to reach out and reconnect. Hope you're doing well!",
        talkingPoints: ['Reconnect', 'Show interest', 'Open conversation'],
        reasoning: 'Fallback variation due to generation error',
        variationIndex: 0,
      },
      {
        subject: 'Great to see your updates',
        body: "Hi, I've been following your updates and would love to catch up.",
        talkingPoints: ['Acknowledge updates', 'Express interest', 'Suggest meeting'],
        reasoning: 'Fallback variation due to generation error',
        variationIndex: 1,
      },
      {
        subject: 'Checking in',
        body: "Hi, it's been a while! Would be great to reconnect.",
        talkingPoints: ['Acknowledge time gap', 'Express warmth', 'Invite dialogue'],
        reasoning: 'Fallback variation due to generation error',
        variationIndex: 2,
      },
    ];
  }
}
