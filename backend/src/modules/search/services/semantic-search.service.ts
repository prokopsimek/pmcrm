import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { EmbeddingService } from './embedding.service';
import { SemanticSearchResult } from '../dto/search-query.dto';

/**
 * Service for semantic search using pgvector
 */
@Injectable()
export class SemanticSearchService {
  private readonly logger = new Logger(SemanticSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Semantic search using vector similarity
   * Uses cosine distance (<=>) operator for similarity search
   */
  async semanticSearch(
    userId: string,
    query: string,
    options: {
      limit?: number;
      threshold?: number;
    } = {},
  ): Promise<SemanticSearchResult[]> {
    const { limit = 20, threshold = 0.7 } = options;

    if (!this.embeddingService.isAvailable()) {
      throw new Error('Semantic search is not available (OpenAI API key not configured)');
    }

    // Generate embedding for search query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Convert embedding array to PostgreSQL vector format
    const vectorString = `[${queryEmbedding.join(',')}]`;

    // Execute vector similarity search using raw SQL
    // Using cosine distance operator (<=>) from pgvector
    // Distance range: 0 (identical) to 2 (opposite)
    // Similarity = 1 - (distance / 2)
    const results = await this.prisma.$queryRawUnsafe<SemanticSearchResult[]>(
      `
      SELECT
        c.id,
        c.user_id as "userId",
        c.first_name as "firstName",
        c.last_name as "lastName",
        c.email,
        c.phone,
        c.company,
        c.position,
        c.location,
        c.notes,
        c.tags,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        (c.embedding_vector <=> $1::vector) AS distance,
        (1 - (c.embedding_vector <=> $1::vector) / 2) AS similarity
      FROM contacts c
      WHERE
        c.user_id = $2::text
        AND c.deleted_at IS NULL
        AND c.embedding_vector IS NOT NULL
        AND (1 - (c.embedding_vector <=> $1::vector) / 2) >= $3
      ORDER BY c.embedding_vector <=> $1::vector
      LIMIT $4
    `,
      vectorString,
      userId,
      threshold,
      limit,
    );

    this.logger.debug(`Semantic search for "${query}" returned ${results.length} results`);

    return results;
  }

  /**
   * Find similar contacts to a given contact
   */
  async findSimilarContacts(
    contactId: string,
    userId: string,
    limit: number = 10,
  ): Promise<SemanticSearchResult[]> {
    // Get the contact's embedding using raw SQL (embeddingVector is an Unsupported type)
    const contactResults = await this.prisma.$queryRaw<
      Array<{ id: string; user_id: string; embedding_vector: string | null }>
    >`
      SELECT id, user_id, embedding_vector::text
      FROM contacts
      WHERE id = ${contactId}
    `;

    if (!contactResults || contactResults.length === 0) {
      throw new Error('Contact not found');
    }

    const contact = contactResults[0]!;

    if (contact.user_id !== userId) {
      throw new Error('Access denied');
    }

    if (!contact.embedding_vector) {
      throw new Error('Contact has no embedding vector');
    }

    const embeddingVector = contact.embedding_vector;

    // Find similar contacts using vector distance
    const results = await this.prisma.$queryRawUnsafe<SemanticSearchResult[]>(
      `
      SELECT
        c.id,
        c.user_id as "userId",
        c.first_name as "firstName",
        c.last_name as "lastName",
        c.email,
        c.phone,
        c.company,
        c.position,
        c.location,
        c.notes,
        c.tags,
        c.created_at as "createdAt",
        c.updated_at as "updatedAt",
        (c.embedding_vector <=> $1::vector) AS distance,
        (1 - (c.embedding_vector <=> $1::vector) / 2) AS similarity
      FROM contacts c
      WHERE
        c.user_id = $2::text
        AND c.id != $3::text
        AND c.deleted_at IS NULL
        AND c.embedding_vector IS NOT NULL
      ORDER BY c.embedding_vector <=> $1::vector
      LIMIT $4
    `,
      embeddingVector,
      userId,
      contactId,
      limit,
    );

    this.logger.debug(`Found ${results.length} similar contacts for contact ${contactId}`);

    return results;
  }

  /**
   * Combine and re-rank results from semantic and full-text search
   * Uses weighted scoring to merge results
   */
  combineSearchResults(
    semanticResults: SemanticSearchResult[],
    fullTextResults: any[],
    semanticWeight: number = 0.5,
  ): SemanticSearchResult[] {
    // Create a map to track combined scores
    const scoreMap = new Map<
      string,
      {
        contact: any;
        semanticScore: number;
        fullTextScore: number;
      }
    >();

    // Add semantic results
    semanticResults.forEach((result, index) => {
      const score = result.similarity || 0;
      scoreMap.set(result.id, {
        contact: result,
        semanticScore: score,
        fullTextScore: 0,
      });
    });

    // Add full-text results
    fullTextResults.forEach((result, index) => {
      const score = result.rank || 1 - index / fullTextResults.length;
      const existing = scoreMap.get(result.id);

      if (existing) {
        existing.fullTextScore = score;
      } else {
        scoreMap.set(result.id, {
          contact: result,
          semanticScore: 0,
          fullTextScore: score,
        });
      }
    });

    // Calculate combined scores and sort
    const combined = Array.from(scoreMap.entries()).map(([id, data]) => {
      const combinedScore =
        data.semanticScore * semanticWeight + data.fullTextScore * (1 - semanticWeight);

      return {
        ...data.contact,
        similarity: data.semanticScore,
        rank: data.fullTextScore,
        combinedScore,
      };
    });

    // Sort by combined score (descending)
    combined.sort((a, b) => b.combinedScore - a.combinedScore);

    return combined;
  }

  /**
   * Check if contact has embedding vector
   */
  async hasEmbedding(contactId: string): Promise<boolean> {
    // Use raw SQL since embeddingVector is an Unsupported type in Prisma
    const result = await this.prisma.$queryRaw<Array<{ has_embedding: boolean }>>`
      SELECT (embedding_vector IS NOT NULL) as has_embedding
      FROM contacts
      WHERE id = ${contactId}
    `;

    return result?.[0]?.has_embedding ?? false;
  }

  /**
   * Get contacts without embeddings
   */
  async getContactsWithoutEmbeddings(userId: string, limit: number = 100): Promise<string[]> {
    // Use raw SQL since embeddingVector is an Unsupported type in Prisma
    const contacts = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM contacts
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND embedding_vector IS NULL
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return contacts.map((c) => c.id);
  }
}
