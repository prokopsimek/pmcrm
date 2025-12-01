import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { FullTextSearchService } from './services/full-text-search.service';
import { RankingService } from './services/ranking.service';
import { HighlightingService } from './services/highlighting.service';
import { EmbeddingService } from './services/embedding.service';
import { SemanticSearchService } from './services/semantic-search.service';
import {
  SearchQueryDto,
  SearchResult,
  ContactSearchResult,
  SearchHistoryItem,
  SemanticSearchResult,
} from './dto/search-query.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly MAX_HISTORY = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fullTextSearchService: FullTextSearchService,
    private readonly rankingService: RankingService,
    private readonly highlightingService: HighlightingService,
    private readonly embeddingService: EmbeddingService,
    private readonly semanticSearchService: SemanticSearchService,
  ) {}

  /**
   * Search contacts with ranking
   */
  async searchContacts(
    userId: string,
    options: Partial<SearchQueryDto> & { query: string },
  ): Promise<SearchResult<ContactSearchResult>> {
    const startTime = Date.now();

    try {
      const { query, fields, fuzzy = false, limit = 20 } = options;

      // Execute search (fuzzy or standard)
      let results = fuzzy
        ? await this.fullTextSearchService.executeFuzzySearch(userId, query, fields, limit)
        : await this.fullTextSearchService.executeFullTextSearch(userId, query, fields, limit);

      // Rank results
      results = this.rankingService.rankResults(results, query);

      // Boost important contacts
      results = this.rankingService.boostImportantContacts(results);

      // Get total count
      const total = results.length;

      // Save to search history (async, don't await)
      this.saveRecentSearch(userId, query, total).catch((error) => {
        this.logger.error('Failed to save search history', error);
      });

      const duration = Date.now() - startTime;

      return {
        results: results.slice(0, limit),
        total,
        query,
        duration,
      };
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  /**
   * Search contacts with highlighting
   */
  async searchWithHighlighting(
    userId: string,
    options: Partial<SearchQueryDto> & { query: string },
  ): Promise<SearchResult<ContactSearchResult>> {
    const searchResult = await this.searchContacts(userId, options);

    // Add highlighting to results
    searchResult.results = searchResult.results.map((contact) => ({
      ...contact,
      highlighted: this.highlightingService.highlightContact(contact, options.query),
    }));

    return searchResult;
  }

  /**
   * Save search query to history
   */
  async saveRecentSearch(userId: string, query: string, resultCount: number): Promise<void> {
    // Don't save empty queries
    if (!query || query.trim().length === 0) {
      return;
    }

    try {
      // Create search history entry
      await this.prisma.searchHistory.create({
        data: {
          userId,
          query: query.trim(),
          resultCount,
          filters: {},
        },
      });

      // Clean up old history entries (keep only MAX_HISTORY most recent)
      await this.cleanupOldSearchHistory(userId);
    } catch (error) {
      this.logger.error('Failed to save search history', error);
      // Don't throw - search history is not critical
    }
  }

  /**
   * Get recent searches for user
   */
  async getRecentSearches(userId: string, limit: number = 10): Promise<SearchHistoryItem[]> {
    const searches = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        query: true,
        resultCount: true,
        createdAt: true,
      },
    });

    // Deduplicate by query (keep most recent)
    const uniqueSearches = new Map<string, SearchHistoryItem>();
    for (const search of searches) {
      if (!uniqueSearches.has(search.query)) {
        uniqueSearches.set(search.query, search);
      }
    }

    return Array.from(uniqueSearches.values());
  }

  /**
   * Clear specific search from history
   */
  async clearRecentSearch(userId: string, searchId: string): Promise<void> {
    await this.prisma.searchHistory.delete({
      where: {
        id: searchId,
        userId, // Ensure user can only delete their own
      },
    });
  }

  /**
   * Clear all search history for user
   */
  async clearAllRecentSearches(userId: string): Promise<void> {
    await this.prisma.searchHistory.deleteMany({
      where: { userId },
    });
  }

  /**
   * Clean up old search history entries
   */
  private async cleanupOldSearchHistory(userId: string): Promise<void> {
    const count = await this.prisma.searchHistory.count({
      where: { userId },
    });

    if (count > this.MAX_HISTORY) {
      // Get IDs of oldest entries to delete
      const oldestEntries = await this.prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
        take: count - this.MAX_HISTORY,
        select: { id: true },
      });

      const idsToDelete = oldestEntries.map((entry) => entry.id);

      await this.prisma.searchHistory.deleteMany({
        where: {
          id: { in: idsToDelete },
        },
      });
    }
  }

  /**
   * US-060: Semantic search using vector similarity
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: {
      limit?: number;
      threshold?: number;
    } = {},
  ): Promise<SearchResult<SemanticSearchResult>> {
    const startTime = Date.now();

    try {
      const results = await this.semanticSearchService.semanticSearch(userId, query, options);

      const duration = Date.now() - startTime;

      // Save to search history
      this.saveRecentSearch(userId, query, results.length).catch((error) => {
        this.logger.error('Failed to save search history', error);
      });

      return {
        results,
        total: results.length,
        query,
        duration,
      };
    } catch (error) {
      this.logger.error('Semantic search failed', error);
      throw error;
    }
  }

  /**
   * US-060: Hybrid search combining full-text and semantic search
   */
  async hybridSearch(
    userId: string,
    query: string,
    options: {
      limit?: number;
      semanticWeight?: number;
    } = {},
  ): Promise<SearchResult<SemanticSearchResult>> {
    const startTime = Date.now();
    const { limit = 20, semanticWeight = 0.5 } = options;

    try {
      // Execute both searches in parallel
      const [semanticResults, fullTextResults] = await Promise.all([
        this.semanticSearchService.semanticSearch(userId, query, {
          limit: limit * 2,
          threshold: 0.6, // Lower threshold for hybrid search
        }),
        this.searchContacts(userId, {
          query,
          limit: limit * 2,
        }),
      ]);

      // Combine and re-rank results
      const combinedResults = this.semanticSearchService.combineSearchResults(
        semanticResults,
        fullTextResults.results,
        semanticWeight,
      );

      const duration = Date.now() - startTime;

      // Save to search history
      this.saveRecentSearch(userId, query, combinedResults.length).catch((error) => {
        this.logger.error('Failed to save search history', error);
      });

      return {
        results: combinedResults.slice(0, limit),
        total: combinedResults.length,
        query,
        duration,
      };
    } catch (error) {
      this.logger.error('Hybrid search failed', error);
      throw error;
    }
  }

  /**
   * US-060: Find similar contacts to a given contact
   */
  async findSimilarContacts(
    contactId: string,
    userId: string,
    limit: number = 10,
  ): Promise<SearchResult<SemanticSearchResult>> {
    const startTime = Date.now();

    try {
      const results = await this.semanticSearchService.findSimilarContacts(
        contactId,
        userId,
        limit,
      );

      const duration = Date.now() - startTime;

      return {
        results,
        total: results.length,
        query: `similar:${contactId}`,
        duration,
      };
    } catch (error) {
      this.logger.error('Find similar contacts failed', error);
      throw error;
    }
  }

  /**
   * Check if semantic search is available
   */
  isSemanticSearchAvailable(): boolean {
    return this.embeddingService.isAvailable();
  }

  /**
   * Generate embedding for a contact
   */
  async generateContactEmbedding(contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Generate embedding
    const embedding = await this.embeddingService.generateContactEmbedding({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName ?? undefined,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      company: contact.company ?? undefined,
      position: contact.position ?? undefined,
      location: contact.location ?? undefined,
      notes: contact.notes ?? undefined,
      tags: contact.contactTags.map((ct) => ({ tag: { name: ct.tag.name } })),
    });

    // Update contact with embedding using raw SQL (embeddingVector is an Unsupported type)
    const embeddingStr = `[${embedding.join(',')}]`;
    await this.prisma.$executeRaw`
      UPDATE contacts
      SET embedding_vector = ${embeddingStr}::vector,
          embedding_updated_at = NOW()
      WHERE id = ${contactId}
    `;

    this.logger.debug(`Generated embedding for contact ${contactId}`);
  }

  /**
   * Get contacts that need embeddings
   */
  async getContactsNeedingEmbeddings(userId: string, limit: number = 100): Promise<string[]> {
    return this.semanticSearchService.getContactsWithoutEmbeddings(userId, limit);
  }
}
