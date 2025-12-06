/**
 * Tone Adapter Service
 * US-051: AI icebreaker message generation
 * Adapts message tone between professional, friendly, and casual
 */

import { Injectable, Logger } from '@nestjs/common';
import { Tone } from '../types';

interface ToneAdaptation {
  adaptedMessage: string;
  toneScore: number; // 0-1 confidence that tone matches
}

@Injectable()
export class ToneAdapterService {
  private readonly logger = new Logger(ToneAdapterService.name);

  async adaptTone(message: string, fromTone: Tone, toTone: Tone): Promise<ToneAdaptation> {
    if (fromTone === toTone) {
      return {
        adaptedMessage: message,
        toneScore: 1.0,
      };
    }

    this.logger.debug(`Adapting tone from ${fromTone} to ${toTone}`);

    let adaptedMessage = message;

    if (toTone === 'professional') {
      adaptedMessage = this.makeProfessional(message);
    } else if (toTone === 'friendly') {
      adaptedMessage = this.makeFriendly(message);
    } else if (toTone === 'casual') {
      adaptedMessage = this.makeCasual(message);
    }

    const toneScore = this.assessToneMatch(adaptedMessage, toTone);

    return {
      adaptedMessage,
      toneScore,
    };
  }

  getToneGuidelines(tone: Tone): string {
    const guidelines = {
      professional: `
        - Use formal language and proper business etiquette
        - Address recipient with appropriate title
        - Focus on professional value and mutual benefit
        - Avoid casual expressions and slang
        - Maintain professional distance
      `,
      friendly: `
        - Use warm, approachable language
        - Balance professionalism with personal connection
        - Show genuine interest in the person
        - Use conversational tone without being too casual
        - Reference shared experiences or connections naturally
      `,
      casual: `
        - Use relaxed, conversational language
        - Keep it brief and to the point
        - Use contractions and informal expressions
        - Be authentic and personable
        - Focus on building rapport
      `,
    };

    return guidelines[tone] || guidelines.friendly;
  }

  private makeProfessional(message: string): string {
    let adapted = message;

    // Replace casual greetings
    adapted = adapted.replace(/\b(Hey|Yo|What's up)\b/gi, 'Dear');
    adapted = adapted.replace(/\b(Hi there)\b/gi, 'Hello');

    // Replace contractions
    adapted = adapted.replace(/won't/gi, 'will not');
    adapted = adapted.replace(/can't/gi, 'cannot');
    adapted = adapted.replace(/don't/gi, 'do not');
    adapted = adapted.replace(/I'm/gi, 'I am');
    adapted = adapted.replace(/you're/gi, 'you are');
    adapted = adapted.replace(/it's/gi, 'it is');
    adapted = adapted.replace(/we're/gi, 'we are');
    adapted = adapted.replace(/they're/gi, 'they are');

    // Replace casual phrases
    adapted = adapted.replace(/\bgig\b/gi, 'position');
    adapted = adapted.replace(/\bcatch up\b/gi, 'reconnect');
    adapted = adapted.replace(/\bawesome\b/gi, 'excellent');
    adapted = adapted.replace(/\bcool\b/gi, 'interesting');

    // Add professional closings if missing
    if (!adapted.match(/(Best regards|Sincerely|Kind regards|Respectfully)/i)) {
      adapted += '\n\nBest regards';
    }

    return adapted;
  }

  private makeFriendly(message: string): string {
    let adapted = message;

    // Soften overly formal language
    adapted = adapted.replace(/\bDear Sir or Madam\b/gi, 'Hi');
    adapted = adapted.replace(/\bTo whom it may concern\b/gi, 'Hello');

    // Add warmth markers
    if (!adapted.match(/\b(hope|great|wonderful|love)\b/i)) {
      // Insert friendly phrase
      const firstSentenceEnd = adapted.indexOf('.') || adapted.indexOf('!');
      if (firstSentenceEnd > 0) {
        adapted =
          adapted.slice(0, firstSentenceEnd + 1) +
          " Hope you're doing well!" +
          adapted.slice(firstSentenceEnd + 1);
      }
    }

    // Use some contractions for friendliness
    adapted = adapted.replace(/\bI am\b/g, "I'm");
    adapted = adapted.replace(/\byou are\b/g, "you're");
    adapted = adapted.replace(/\bwe are\b/g, "we're");

    return adapted;
  }

  private makeCasual(message: string): string {
    let adapted = message;

    // Replace formal greetings
    adapted = adapted.replace(/\bDear ([A-Z][a-z]+)\b/g, 'Hey $1');
    adapted = adapted.replace(/\bHello\b/gi, 'Hi');

    // Use contractions heavily
    adapted = adapted.replace(/\bwill not\b/gi, "won't");
    adapted = adapted.replace(/\bcannot\b/gi, "can't");
    adapted = adapted.replace(/\bdo not\b/gi, "don't");
    adapted = adapted.replace(/\bI am\b/g, "I'm");
    adapted = adapted.replace(/\byou are\b/g, "you're");
    adapted = adapted.replace(/\bit is\b/g, "it's");
    adapted = adapted.replace(/\bwe are\b/g, "we're");
    adapted = adapted.replace(/\bthey are\b/g, "they're");

    // Replace formal phrases
    adapted = adapted.replace(/\breconnect\b/gi, 'catch up');
    adapted = adapted.replace(/\bposition\b/gi, 'gig');
    adapted = adapted.replace(/\bexcellent\b/gi, 'awesome');
    adapted = adapted.replace(/\binteresting\b/gi, 'cool');

    // Remove formal closings
    adapted = adapted.replace(
      /(Best regards|Sincerely|Kind regards|Respectfully)[,.]?/gi,
      'Cheers',
    );

    return adapted;
  }

  private assessToneMatch(message: string, targetTone: Tone): number {
    let score = 0.5; // Base score

    const formalityMarkers = {
      professional: [
        /\bDear\b/,
        /\bSincerely\b/,
        /\bBest regards\b/,
        /\bwill not\b/,
        /\bcannot\b/,
        /\bdo not\b/,
      ],
      friendly: [/\bHope you're\b/, /\bGreat to\b/, /\bLooking forward\b/, /\bWould love to\b/],
      casual: [
        /\bHey\b/,
        /\bCheers\b/,
        /\bawesome\b/i,
        /\bcool\b/i,
        /\bgig\b/,
        /\bcatch up\b/,
        /won't|can't|don't|I'm|you're/,
      ],
    };

    const markers = formalityMarkers[targetTone] || [];
    const matchCount = markers.filter((marker) => marker.test(message)).length;

    // Increase score based on marker matches
    score += (matchCount / markers.length) * 0.5;

    // Cap at 0.95 (never claim 100% confidence)
    return Math.min(score, 0.95);
  }
}





