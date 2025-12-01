/**
 * Profile Matcher Service (US-013)
 * Fuzzy matching algorithms for LinkedIn profile auto-matching
 * Uses Levenshtein distance for name similarity
 */
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ProfileMatcherService {
  private readonly logger = new Logger(ProfileMatcherService.name);
  private readonly MATCH_THRESHOLD = 0.85; // 85% similarity required

  /**
   * Fuzzy match by name using Levenshtein distance
   * Returns match score from 0 to 1 (1 = perfect match)
   */
  fuzzyMatchByName(
    targetFirstName: string,
    targetLastName: string,
    candidateFullName: string,
    targetCompany?: string,
    candidateCompany?: string,
  ): number {
    const targetFullName = `${targetFirstName} ${targetLastName}`.toLowerCase().trim();
    const candidateName = candidateFullName.toLowerCase().trim();

    // Calculate name similarity using Levenshtein distance
    const nameSimilarity = this.calculateStringSimilarity(targetFullName, candidateName);

    // If company provided, factor it into the score
    if (targetCompany && candidateCompany) {
      const companySimilarity = this.calculateStringSimilarity(
        targetCompany.toLowerCase(),
        candidateCompany.toLowerCase(),
      );

      // Weighted average: 70% name, 30% company
      const weightedScore = nameSimilarity * 0.7 + companySimilarity * 0.3;

      this.logger.debug(
        `Match score for "${targetFullName}" vs "${candidateName}" (${targetCompany} vs ${candidateCompany}): ${weightedScore.toFixed(2)}`,
      );

      return weightedScore;
    }

    this.logger.debug(
      `Match score for "${targetFullName}" vs "${candidateName}": ${nameSimilarity.toFixed(2)}`,
    );

    return nameSimilarity;
  }

  /**
   * Calculate overall match score for a profile
   * Considers name, company, location, and headline
   */
  calculateMatchScore(
    target: {
      firstName: string;
      lastName: string;
      company?: string;
      location?: string;
    },
    candidate: {
      name: string;
      company?: string;
      location?: string;
      headline?: string;
    },
  ): number {
    const weights = {
      name: 0.5,
      company: 0.3,
      location: 0.2,
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Name similarity (required)
    const nameSimilarity = this.fuzzyMatchByName(target.firstName, target.lastName, candidate.name);
    totalScore += nameSimilarity * weights.name;
    totalWeight += weights.name;

    // Company similarity (optional)
    if (target.company && candidate.company) {
      const companySimilarity = this.calculateStringSimilarity(
        target.company.toLowerCase(),
        candidate.company.toLowerCase(),
      );
      totalScore += companySimilarity * weights.company;
      totalWeight += weights.company;
    }

    // Location similarity (optional)
    if (target.location && candidate.location) {
      const locationSimilarity = this.calculateStringSimilarity(
        target.location.toLowerCase(),
        candidate.location.toLowerCase(),
      );
      totalScore += locationSimilarity * weights.location;
      totalWeight += weights.location;
    }

    // Normalize score by actual weights used
    const finalScore = totalScore / totalWeight;

    this.logger.debug(`Overall match score: ${finalScore.toFixed(2)}`);

    return finalScore;
  }

  /**
   * Check if match score meets threshold (>= 0.85)
   */
  isAcceptableMatch(score: number): boolean {
    return score >= this.MATCH_THRESHOLD;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns value from 0 to 1 (1 = identical)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) return 1;

    const similarity = 1 - distance / maxLength;
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }

  /**
   * Levenshtein distance algorithm
   * Calculates minimum number of edits to transform str1 into str2
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Create 2D array for dynamic programming
    const dp: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      dp[i] = new Array(len2 + 1).fill(0) as number[];
    }

    // Initialize base cases
    for (let i = 0; i <= len1; i++) {
      dp[i]![0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0]![j] = j;
    }

    // Fill the DP table
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i]![j] = dp[i - 1]![j - 1]!; // Characters match, no operation needed
        } else {
          dp[i]![j] = Math.min(
            dp[i - 1]![j]! + 1, // Deletion
            dp[i]![j - 1]! + 1, // Insertion
            dp[i - 1]![j - 1]! + 1, // Substitution
          );
        }
      }
    }

    return dp[len1]![len2]!;
  }

  /**
   * Normalize name for comparison
   * Removes titles, middle names, and special characters
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(mr|mrs|ms|dr|prof)\b\.?/gi, '') // Remove titles
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Extract first and last name from full name
   */
  parseFullName(fullName: string): { firstName: string; lastName: string } {
    const normalized = this.normalizeName(fullName);
    const parts = normalized.split(' ').filter((p) => p.length > 0);

    if (parts.length === 0) {
      return { firstName: '', lastName: '' };
    }

    if (parts.length === 1) {
      return { firstName: parts[0] ?? '', lastName: '' };
    }

    // First word is first name, last word is last name
    const firstName = parts[0] ?? '';
    const lastName = parts[parts.length - 1] ?? '';

    return { firstName, lastName };
  }
}
