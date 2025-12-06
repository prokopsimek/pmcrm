import { apiClient } from '../client';

/**
 * Icebreaker API Service
 * US-051: AI icebreaker message generation
 */

// Types
export type IcebreakerChannel = 'email' | 'linkedin' | 'whatsapp';
export type IcebreakerTone = 'professional' | 'friendly' | 'casual';
export type IcebreakerFeedback = 'helpful' | 'not_helpful' | 'needs_improvement';

export interface GenerateIcebreakerInput {
  contactId: string;
  channel: IcebreakerChannel;
  tone: IcebreakerTone;
  triggerEvent?: string;
  wordLimit?: number;
}

export interface RegenerateIcebreakerInput {
  tone?: IcebreakerTone;
  triggerEvent?: string;
}

export interface MessageVariation {
  subject?: string;
  body: string;
  talkingPoints: string[];
  reasoning: string;
  variationIndex: number;
}

export interface UsageMetrics {
  provider: string;
  modelVersion: string;
  promptVersion: string;
  tokensUsed: number;
  costUsd: number;
  generationTimeMs: number;
}

export interface IcebreakerResponse {
  id: string;
  variations: MessageVariation[];
  usageMetrics: UsageMetrics;
  contactId: string;
  channel: string;
  tone: string;
  createdAt: string;
}

export interface IcebreakerHistoryItem {
  id: string;
  contactId: string;
  contactName: string;
  channel: string;
  tone: string;
  sent: boolean;
  feedback?: string;
  createdAt: string;
  sentAt?: string;
}

export const icebreakerService = {
  /**
   * Generate AI icebreaker message variations
   */
  generate: async (input: GenerateIcebreakerInput): Promise<IcebreakerResponse> => {
    const response = await apiClient.post<IcebreakerResponse>('/api/v1/ai/icebreaker/generate', input);
    return response.data;
  },

  /**
   * Regenerate icebreaker with different parameters
   */
  regenerate: async (id: string, input?: RegenerateIcebreakerInput): Promise<IcebreakerResponse> => {
    const response = await apiClient.post<IcebreakerResponse>(
      `/api/v1/ai/icebreaker/${id}/regenerate`,
      input || {},
    );
    return response.data;
  },

  /**
   * Edit generated icebreaker content
   */
  edit: async (id: string, editedContent: string): Promise<{ id: string; edited: boolean; editedContent: string }> => {
    const response = await apiClient.post<{ id: string; edited: boolean; editedContent: string }>(
      `/api/v1/ai/icebreaker/${id}/edit`,
      { editedContent },
    );
    return response.data;
  },

  /**
   * Select a specific variation
   */
  selectVariation: async (id: string, variationIndex: number): Promise<{ id: string; selected: MessageVariation }> => {
    const response = await apiClient.post<{ id: string; selected: MessageVariation }>(
      `/api/v1/ai/icebreaker/${id}/select`,
      { variationIndex },
    );
    return response.data;
  },

  /**
   * Submit feedback on generated icebreaker
   */
  submitFeedback: async (id: string, feedback: IcebreakerFeedback): Promise<{ id: string; feedback: string }> => {
    const response = await apiClient.post<{ id: string; feedback: string }>(
      `/api/v1/ai/icebreaker/${id}/feedback`,
      { feedback },
    );
    return response.data;
  },

  /**
   * Get user icebreaker generation history
   */
  getHistory: async (): Promise<IcebreakerHistoryItem[]> => {
    const response = await apiClient.get<IcebreakerHistoryItem[]>('/api/v1/ai/icebreaker/history');
    return response.data;
  },
};









