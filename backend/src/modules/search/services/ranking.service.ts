import { Injectable } from '@nestjs/common';

@Injectable()
export class RankingService {
  /**
   * Rank search results by relevance
   */
  rankResults(contacts: any[], query: string): any[] {
    return contacts
      .map((contact) => ({
        ...contact,
        rank: this.calculateRelevanceScore(contact, query),
      }))
      .sort((a, b) => b.rank - a.rank);
  }

  /**
   * Calculate relevance score for a contact
   */
  calculateRelevanceScore(contact: any, query: string): number {
    let score = contact.rank || 0;

    const lowerQuery = query.toLowerCase();

    // Boost exact matches
    if (contact.firstName?.toLowerCase() === lowerQuery) {
      score += 1.0;
    }
    if (contact.lastName?.toLowerCase() === lowerQuery) {
      score += 1.0;
    }
    if (contact.email?.toLowerCase() === lowerQuery) {
      score += 0.9;
    }
    if (contact.company?.toLowerCase() === lowerQuery) {
      score += 0.8;
    }

    // Boost prefix matches
    if (contact.firstName?.toLowerCase().startsWith(lowerQuery)) {
      score += 0.5;
    }
    if (contact.lastName?.toLowerCase().startsWith(lowerQuery)) {
      score += 0.5;
    }

    // Boost recent contacts (last updated in past 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    if (contact.updatedAt && new Date(contact.updatedAt) > thirtyDaysAgo) {
      score += 0.2;
    }

    // Boost contacts with tags
    if (contact.tags?.length > 0) {
      const tagMatch = contact.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery));
      if (tagMatch) {
        score += 0.3;
      }
    }

    return score;
  }

  /**
   * Boost contacts based on interaction frequency
   */
  boostByInteractionFrequency(contacts: any[], frequencyMap: Map<string, number>): any[] {
    return contacts.map((contact) => {
      const frequency = frequencyMap.get(contact.id) || 0;
      return {
        ...contact,
        rank: (contact.rank || 0) + frequency * 0.1,
      };
    });
  }

  /**
   * Boost contacts marked as important
   */
  boostImportantContacts(contacts: any[]): any[] {
    return contacts.map((contact) => {
      if (contact.tags?.includes('important') || contact.tags?.includes('vip')) {
        return {
          ...contact,
          rank: (contact.rank || 0) + 0.5,
        };
      }
      return contact;
    });
  }
}
