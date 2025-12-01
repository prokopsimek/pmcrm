/**
 * Sentiment Analyzer Service
 * US-030: Email communication sync
 * Analyzes sentiment of email content using Sentiment.js
 */

import { Injectable } from '@nestjs/common';
import Sentiment from 'sentiment';
import { SentimentResult } from '../interfaces/email.interface';

@Injectable()
export class SentimentAnalyzerService {
  private readonly sentiment: Sentiment;

  constructor() {
    this.sentiment = new Sentiment();
  }

  /**
   * Analyze sentiment of a single text
   */
  analyzeSentiment(text: string): SentimentResult {
    if (!text || text.trim().length === 0) {
      return {
        score: 0,
        label: 'neutral',
        comparative: 0,
      };
    }

    const result = this.sentiment.analyze(text);

    // Normalize score from Sentiment.js range to -1 to 1
    const normalizedScore = this.normalizeScore(result.score);

    return {
      score: normalizedScore,
      label: this.getLabel(normalizedScore),
      comparative: result.comparative,
    };
  }

  /**
   * Analyze multiple texts in batch
   */
  analyzeBatch(texts: string[]): SentimentResult[] {
    return texts.map((text) => this.analyzeSentiment(text));
  }

  /**
   * Normalize sentiment score to -1 to 1 range
   * Sentiment.js can return scores outside this range for very long texts
   */
  private normalizeScore(score: number): number {
    // Clamp the score between -1 and 1
    // For sentiment.js, typical range is -10 to +10 for very long texts
    const normalized = score / 5; // Divide by 5 to normalize
    return Math.max(-1, Math.min(1, normalized));
  }

  /**
   * Get sentiment label based on score
   */
  private getLabel(score: number): 'positive' | 'neutral' | 'negative' {
    if (score > 0.05) {
      return 'positive';
    }
    if (score < -0.05) {
      return 'negative';
    }
    return 'neutral';
  }
}
