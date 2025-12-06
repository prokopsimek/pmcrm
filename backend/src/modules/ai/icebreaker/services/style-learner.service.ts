/**
 * Style Learner Service
 * US-051: AI icebreaker message generation
 * Learns user's writing style from sent messages
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { WritingStyleProfile } from '../types';

@Injectable()
export class StyleLearnerService {
  private readonly logger = new Logger(StyleLearnerService.name);
  private readonly styleCache = new Map<string, WritingStyleProfile>();
  private readonly cacheExpiryMs = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private readonly prisma: PrismaService) {}

  async learnFromSentMessages(userId: string): Promise<WritingStyleProfile> {
    this.logger.debug(`Learning writing style for user ${userId}`);

    // Get sent emails from EmailThread (outbound direction)
    const sentEmails = await this.prisma.emailThread.findMany({
      where: {
        contact: {
          userId,
        },
        direction: 'OUTBOUND',
        body: { not: null },
      },
      select: {
        body: true,
        occurredAt: true,
      },
      orderBy: {
        occurredAt: 'desc',
      },
      take: 50, // Analyze last 50 messages
    });

    if (sentEmails.length === 0) {
      return this.getDefaultStyleProfile();
    }

    const messages = sentEmails
      .map((m) => m.body)
      .filter((content): content is string => content !== null);

    const profile: WritingStyleProfile = {
      avgWordCount: this.calculateAverageWordCount(messages),
      commonPhrases: this.extractCommonPhrases(messages),
      sentenceLengthAvg: this.calculateAverageSentenceLength(messages),
      formalityScore: this.analyzeFormalityLevel(messages),
      personalityTraits: this.detectPersonalityTraits(messages),
      signatureElements: this.extractSignatureElements(messages),
      lastUpdated: new Date(),
    };

    // Cache the profile
    this.styleCache.set(userId, profile);

    this.logger.log(
      `Learned style profile for user ${userId}: ${profile.personalityTraits.join(', ')}`,
    );

    return profile;
  }

  async getWritingStyleProfile(userId: string): Promise<WritingStyleProfile> {
    // Check cache first
    const cached = this.styleCache.get(userId);
    if (cached && Date.now() - cached.lastUpdated.getTime() < this.cacheExpiryMs) {
      this.logger.debug(`Using cached style profile for user ${userId}`);
      return cached;
    }

    // Learn from messages
    return this.learnFromSentMessages(userId);
  }

  formatStyleForPrompt(profile: WritingStyleProfile): string {
    const formality =
      profile.formalityScore >= 0.7
        ? 'Formal'
        : profile.formalityScore >= 0.4
          ? 'Balanced'
          : 'Casual';

    const traits = profile.personalityTraits.join(', ');

    return (
      `${formality} writing style, typically ${profile.avgWordCount} words per message, ` +
      `personality: ${traits}. ` +
      `Common phrases: "${profile.commonPhrases.slice(0, 3).join('", "')}"`
    );
  }

  private calculateAverageWordCount(messages: string[]): number {
    const wordCounts = messages.map((msg) => this.countWords(msg));
    return Math.round(wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).length;
  }

  private extractCommonPhrases(messages: string[]): string[] {
    const phraseMap = new Map<string, number>();

    // Common opening phrases
    const openingPatterns = [
      /^(Hi|Hello|Hey|Dear|Good morning|Good afternoon)[,\s]/i,
      /(Hope this finds you well|Hope you'?re doing well|I hope this email finds you)/i,
      /(Looking forward to|I look forward to)/i,
      /(Thank you for|Thanks for)/i,
      /(I wanted to reach out|Reaching out to)/i,
    ];

    // Common closing phrases
    const closingPatterns = [
      /(Best regards|Kind regards|Sincerely|Best|Cheers|Thanks|Thank you)[,.]?$/im,
      /(Looking forward to hearing from you|Hope to hear from you soon)/i,
      /(Let me know if|Please let me know)/i,
    ];

    messages.forEach((message) => {
      [...openingPatterns, ...closingPatterns].forEach((pattern) => {
        const match = message.match(pattern);
        if (match) {
          const phrase = match[0].trim();
          phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
        }
      });
    });

    // Return top 5 most common phrases
    return Array.from(phraseMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([phrase]) => phrase);
  }

  private calculateAverageSentenceLength(messages: string[]): number {
    const allSentences = messages.flatMap((msg) => this.splitIntoSentences(msg));
    if (allSentences.length === 0) return 15;
    const sentenceLengths = allSentences.map((s) => this.countWords(s));
    return Math.round(sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private analyzeFormalityLevel(messages: string[]): number {
    const allText = messages.join(' ').toLowerCase();

    let formalityScore = 0.5; // Start neutral

    // Formal indicators (+)
    const formalMarkers = [
      /\b(dear|sincerely|regards|respectfully)\b/g,
      /\b(shall|would|could|might)\b/g,
      /\b(furthermore|moreover|therefore|nevertheless)\b/g,
      /\b(kindly|please find|attached herewith)\b/g,
    ];

    // Informal indicators (-)
    const informalMarkers = [
      /\b(hey|yo|sup|gonna|wanna|gotta)\b/g,
      /\b(awesome|cool|yeah|nope|lol)\b/g,
      /(!!!|:D|:P|😊|👍)/g,
      /\b(catch up|hang out|hit me up)\b/g,
    ];

    formalMarkers.forEach((pattern) => {
      const matches = allText.match(pattern);
      if (matches) {
        formalityScore += matches.length * 0.02;
      }
    });

    informalMarkers.forEach((pattern) => {
      const matches = allText.match(pattern);
      if (matches) {
        formalityScore -= matches.length * 0.02;
      }
    });

    // Contractions indicate informality
    const contractionCount = (allText.match(/\b\w+'\w+\b/g) || []).length;
    formalityScore -= contractionCount * 0.005;

    // Clamp between 0 and 1
    return Math.max(0, Math.min(1, formalityScore));
  }

  private detectPersonalityTraits(messages: string[]): string[] {
    const allText = messages.join(' ').toLowerCase();
    const traits: string[] = [];

    // Direct trait
    if (allText.match(/\b(let me know|please advise|to the point|briefly)\b/)) {
      traits.push('direct');
    }

    // Warm trait
    if (allText.match(/\b(hope|excited|wonderful|great|looking forward)\b/)) {
      traits.push('warm');
    }

    // Professional trait
    if (allText.match(/\b(opportunity|collaborate|pleased|professional|kindly)\b/)) {
      traits.push('professional');
    }

    // Enthusiastic trait
    if (allText.match(/\b(love|amazing|fantastic|excellent|thrilled)[!\s]/)) {
      traits.push('enthusiastic');
    }

    // Thoughtful trait
    if (allText.match(/\b(consider|appreciate|understand|recognize|aware)\b/)) {
      traits.push('thoughtful');
    }

    return traits.length > 0 ? traits : ['professional'];
  }

  private extractSignatureElements(messages: string[]): string[] {
    const signatures: string[] = [];

    const signaturePatterns = [
      /^(Best regards|Kind regards|Sincerely|Best|Cheers|Thanks|Thank you|Warm regards|Cordially)[,]?$/im,
      /^(Talk soon|Speak soon|Until then|Take care)[,]?$/im,
    ];

    messages.forEach((message) => {
      // Look at last 2 lines
      const lines = message.split('\n').filter((l) => l.trim().length > 0);
      const lastLines = lines.slice(-2);

      lastLines.forEach((line) => {
        signaturePatterns.forEach((pattern) => {
          const match = line.match(pattern);
          if (match && !signatures.includes(match[0])) {
            signatures.push(match[0]);
          }
        });
      });
    });

    return signatures.slice(0, 3); // Top 3 signature elements
  }

  private getDefaultStyleProfile(): WritingStyleProfile {
    return {
      avgWordCount: 120,
      commonPhrases: ['Hi', "Hope you're doing well", 'Best regards'],
      sentenceLengthAvg: 15,
      formalityScore: 0.6,
      personalityTraits: ['professional', 'warm'],
      signatureElements: ['Best regards'],
      lastUpdated: new Date(),
    };
  }
}




