/**
 * Types for AI Icebreaker Generation System
 * US-051: AI icebreaker message generation
 */

export type Channel = 'email' | 'linkedin' | 'whatsapp';
export type Tone = 'professional' | 'friendly' | 'casual';
export const LLMProviders = {
  GOOGLE: 'google',
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
} as const;

export type LLMProvider = (typeof LLMProviders)[keyof typeof LLMProviders];
export type FeedbackType = 'helpful' | 'not_helpful' | 'needs_improvement';

export interface WritingStyleProfile {
  avgWordCount: number;
  commonPhrases: string[];
  sentenceLengthAvg: number;
  formalityScore: number; // 0-1
  personalityTraits: string[]; // 'direct', 'warm', 'professional', etc.
  signatureElements: string[]; // Common closings, openers
  lastUpdated: Date;
}

export interface ContactContext {
  contactName: string;
  currentTitle?: string;
  currentCompany?: string;
  relationshipSummary?: string;
  lastInteractionDate?: Date;
  mutualConnections?: string[];
  triggerEvent?: string;
}

export interface UserContext {
  userName: string;
  userTitle?: string;
  writingStyleProfile?: WritingStyleProfile;
}

export interface GenerationContext {
  contact: ContactContext;
  user: UserContext;
  channel: Channel;
  tone: Tone;
  wordLimit?: number;
}

export interface MessageVariation {
  subject?: string; // For email channel
  body: string;
  talkingPoints: string[];
  reasoning: string;
  variationIndex: number;
}

export interface LLMUsageMetrics {
  provider: LLMProvider;
  modelVersion: string;
  promptVersion: string;
  tokensUsed: number;
  costUsd: number;
  generationTimeMs: number;
}

export interface IcebreakerGenerationResult {
  variations: MessageVariation[];
  usageMetrics: LLMUsageMetrics;
  contextData: GenerationContext;
}

