import { Injectable } from '@nestjs/common';

interface Contact {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
}

interface DuplicateMatch {
  importedContact: Contact;
  existingContact: Contact;
  similarity: number;
  matchedFields: string[];
  matchType: 'EXACT' | 'POTENTIAL' | 'FUZZY';
  confidence?: number;
}

/**
 * Deduplication Service with fuzzy matching algorithms
 * Uses Levenshtein distance and phonetic matching for contact deduplication
 */
@Injectable()
export class DeduplicationService {
  private readonly EXACT_MATCH_THRESHOLD = 1.0;
  private readonly FUZZY_MATCH_THRESHOLD = 0.85;
  private readonly POTENTIAL_MATCH_THRESHOLD = 0.7;

  /**
   * Find duplicates between imported and existing contacts
   */
  async findDuplicates(
    importedContacts: Contact[],
    existingContacts: Contact[],
  ): Promise<DuplicateMatch[]> {
    const duplicates: DuplicateMatch[] = [];

    for (const imported of importedContacts) {
      for (const existing of existingContacts) {
        const match = this.compareContacts(imported, existing);
        if (match && match.similarity >= this.POTENTIAL_MATCH_THRESHOLD) {
          duplicates.push(match);
        }
      }
    }

    return duplicates;
  }

  /**
   * Compare two contacts and calculate similarity
   */
  compareContacts(contact1: Contact, contact2: Contact): DuplicateMatch | null {
    const matchedFields: string[] = [];
    let totalScore = 0;
    let fieldCount = 0;

    // Email exact match (highest priority)
    if (contact1.email && contact2.email) {
      fieldCount++;
      if (this.normalizeEmail(contact1.email) === this.normalizeEmail(contact2.email)) {
        matchedFields.push('email');
        totalScore += 1.0;

        // Email exact match is enough for EXACT type
        return {
          importedContact: contact1,
          existingContact: contact2,
          similarity: 1.0,
          matchedFields: ['email'],
          matchType: 'EXACT',
          confidence: 1.0,
        };
      }
    }

    // Phone exact match (high priority)
    if (contact1.phone && contact2.phone) {
      fieldCount++;
      const phone1 = this.normalizePhone(contact1.phone);
      const phone2 = this.normalizePhone(contact2.phone);

      if (phone1 === phone2) {
        matchedFields.push('phone');
        totalScore += 1.0;

        return {
          importedContact: contact1,
          existingContact: contact2,
          similarity: 0.95,
          matchedFields: ['phone'],
          matchType: 'EXACT',
          confidence: 0.95,
        };
      } else {
        const phoneSimilarity = this.calculateSimilarity(phone1, phone2);
        if (phoneSimilarity > 0.8) {
          matchedFields.push('phone');
          totalScore += phoneSimilarity;
        }
      }
    }

    // Name fuzzy matching
    if (contact1.firstName && contact2.firstName) {
      fieldCount++;
      const firstNameSimilarity = this.calculateSimilarity(
        contact1.firstName.toLowerCase(),
        contact2.firstName.toLowerCase(),
      );

      if (firstNameSimilarity > this.FUZZY_MATCH_THRESHOLD) {
        matchedFields.push('firstName');
        totalScore += firstNameSimilarity;
      }
    }

    if (contact1.lastName && contact2.lastName) {
      fieldCount++;
      const lastNameSimilarity = this.calculateSimilarity(
        contact1.lastName.toLowerCase(),
        contact2.lastName.toLowerCase(),
      );

      if (lastNameSimilarity > this.FUZZY_MATCH_THRESHOLD) {
        matchedFields.push('lastName');
        totalScore += lastNameSimilarity;
      }
    }

    // Company matching
    if (contact1.company && contact2.company) {
      fieldCount++;
      const companySimilarity = this.calculateSimilarity(
        contact1.company.toLowerCase(),
        contact2.company.toLowerCase(),
      );

      if (companySimilarity > this.FUZZY_MATCH_THRESHOLD) {
        matchedFields.push('company');
        totalScore += companySimilarity;
      }
    }

    if (fieldCount === 0) {
      return null;
    }

    const similarity = totalScore / fieldCount;

    if (similarity < this.POTENTIAL_MATCH_THRESHOLD) {
      return null;
    }

    // Determine match type
    let matchType: 'EXACT' | 'POTENTIAL' | 'FUZZY';
    if (similarity >= this.EXACT_MATCH_THRESHOLD) {
      matchType = 'EXACT';
    } else if (similarity >= this.FUZZY_MATCH_THRESHOLD) {
      matchType = 'FUZZY';
    } else {
      matchType = 'POTENTIAL';
    }

    return {
      importedContact: contact1,
      existingContact: contact2,
      similarity,
      matchedFields,
      matchType,
      confidence: similarity,
    };
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    const firstRow = matrix[0];
    if (firstRow) {
      for (let j = 0; j <= str1.length; j++) {
        firstRow[j] = j;
      }
    }

    for (let i = 1; i <= str2.length; i++) {
      const currentRow = matrix[i];
      const previousRow = matrix[i - 1];
      if (!currentRow || !previousRow) continue;

      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          currentRow[j] = previousRow[j - 1] ?? 0;
        } else {
          currentRow[j] = Math.min(
            (previousRow[j - 1] ?? 0) + 1, // substitution
            (currentRow[j - 1] ?? 0) + 1, // insertion
            (previousRow[j] ?? 0) + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length]?.[str1.length] ?? 0;
  }

  /**
   * Normalize email for comparison
   */
  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  /**
   * Normalize phone number for comparison
   */
  private normalizePhone(phone: string): string {
    // Remove all non-numeric characters
    return phone.replace(/\D/g, '');
  }

  /**
   * Merge two contacts (for update scenarios)
   */
  mergeContacts(existing: Contact, imported: Contact): Contact {
    return {
      firstName: imported.firstName || existing.firstName,
      lastName: imported.lastName || existing.lastName,
      email: imported.email || existing.email,
      phone: imported.phone || existing.phone,
      company: imported.company || existing.company,
    };
  }

  /**
   * Calculate Soundex code for phonetic matching
   */
  private soundex(str: string): string {
    const a = str.toLowerCase().split('');
    const firstLetter = a.shift();

    const codes: Record<string, string> = {
      a: '',
      e: '',
      i: '',
      o: '',
      u: '',
      h: '',
      w: '',
      y: '',
      b: '1',
      f: '1',
      p: '1',
      v: '1',
      c: '2',
      g: '2',
      j: '2',
      k: '2',
      q: '2',
      s: '2',
      x: '2',
      z: '2',
      d: '3',
      t: '3',
      l: '4',
      m: '5',
      n: '5',
      r: '6',
    };

    const coded = a
      .map((char) => codes[char])
      .filter((code, index, arr) => code !== arr[index - 1])
      .join('')
      .replace(/\s+/g, '')
      .substring(0, 3);

    return (firstLetter + coded + '000').substring(0, 4).toUpperCase();
  }

  /**
   * Advanced fuzzy matching using multiple algorithms
   */
  private advancedFuzzyMatch(str1: string, str2: string): number {
    // Combine multiple algorithms for better accuracy
    const levenshteinScore = this.calculateSimilarity(str1, str2);
    const soundexMatch = this.soundex(str1) === this.soundex(str2) ? 1.0 : 0.0;

    // Weighted average (70% Levenshtein, 30% Soundex)
    return levenshteinScore * 0.7 + soundexMatch * 0.3;
  }

  /**
   * Batch deduplication for large datasets
   */
  async batchFindDuplicates(
    importedContacts: Contact[],
    existingContacts: Contact[],
    batchSize: number = 100,
  ): Promise<DuplicateMatch[]> {
    const allDuplicates: DuplicateMatch[] = [];

    for (let i = 0; i < importedContacts.length; i += batchSize) {
      const batch = importedContacts.slice(i, i + batchSize);
      const batchDuplicates = await this.findDuplicates(batch, existingContacts);
      allDuplicates.push(...batchDuplicates);
    }

    return allDuplicates;
  }
}
