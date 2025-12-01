import { Injectable } from '@nestjs/common';

@Injectable()
export class HighlightingService {
  /**
   * Highlight matched terms in text
   */
  highlightMatches(text: string | null | undefined, query: string): string {
    if (!text) return '';

    const escapedQuery = this.escapeRegExp(query);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');

    return text.replace(regex, '<mark>$1</mark>');
  }

  /**
   * Highlight matches in contact object
   */
  highlightContact(contact: any, query: string): any {
    const highlighted: any = {};

    if (contact.firstName) {
      highlighted.firstName = this.highlightMatches(contact.firstName, query);
    }

    if (contact.lastName) {
      highlighted.lastName = this.highlightMatches(contact.lastName, query);
    }

    if (contact.email) {
      highlighted.email = this.highlightMatches(contact.email, query);
    }

    if (contact.company) {
      highlighted.company = this.highlightMatches(contact.company, query);
    }

    if (contact.notes) {
      highlighted.notes = this.extractSnippet(contact.notes, query);
    }

    if (contact.tags && Array.isArray(contact.tags)) {
      highlighted.tags = contact.tags.map((tag: string) => this.highlightMatches(tag, query));
    }

    return highlighted;
  }

  /**
   * Extract snippet with context around matched term
   */
  extractSnippet(text: string, query: string, contextLength: number = 50): string {
    if (!text) return '';

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerText.indexOf(lowerQuery);

    if (matchIndex === -1) {
      return this.highlightMatches(text.substring(0, 100), query) + '...';
    }

    // Calculate snippet boundaries
    const start = Math.max(0, matchIndex - contextLength);
    const end = Math.min(text.length, matchIndex + query.length + contextLength);

    let snippet = text.substring(start, end);

    // Add ellipsis if truncated
    if (start > 0) {
      snippet = '...' + snippet;
    }
    if (end < text.length) {
      snippet = snippet + '...';
    }

    return this.highlightMatches(snippet, query);
  }

  /**
   * Escape special regex characters
   */
  private escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Highlight multiple terms
   */
  highlightMultipleTerms(text: string, terms: string[]): string {
    if (!text) return '';

    let highlighted = text;
    for (const term of terms) {
      highlighted = this.highlightMatches(highlighted, term);
    }

    return highlighted;
  }

  /**
   * Remove highlighting tags
   */
  removeHighlighting(text: string): string {
    return text.replace(/<\/?mark>/g, '');
  }

  /**
   * Count highlighted occurrences
   */
  countHighlights(text: string): number {
    const matches = text.match(/<mark>/g);
    return matches ? matches.length : 0;
  }
}
