import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

export interface ContactEmbeddingData {
  id?: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  position?: string;
  notes?: string;
  tags?: { tag: { name: string } }[];
  location?: string;
}

/**
 * Service for generating OpenAI embeddings for semantic search
 * Uses text-embedding-ada-002 model (1536 dimensions)
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private openai: OpenAI | null = null;
  private readonly EMBEDDING_MODEL = 'text-embedding-ada-002';
  private readonly EMBEDDING_DIMENSIONS = 1536;
  private readonly BATCH_SIZE = 100; // OpenAI limit for batch embeddings

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');

    if (apiKey && apiKey.trim().length > 0) {
      this.openai = new OpenAI({
        apiKey: apiKey,
      });
      this.logger.log('OpenAI client initialized for embedding generation');
    } else {
      this.logger.warn('OPENAI_API_KEY not configured - semantic search will be disabled');
    }
  }

  /**
   * Check if embedding service is available
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Generate embedding for a single text string
   * @param text - Text to generate embedding for
   * @returns 1536-dimensional embedding vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    try {
      const response = await this.openai!.embeddings.create({
        model: this.EMBEDDING_MODEL,
        input: text.trim(),
      });

      const embedding = response.data[0]?.embedding;
      if (!embedding) {
        throw new Error('No embedding returned from OpenAI API');
      }

      if (embedding.length !== this.EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Unexpected embedding dimensions: ${embedding.length} (expected ${this.EMBEDDING_DIMENSIONS})`,
        );
      }

      return embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding', error);
      throw error;
    }
  }

  /**
   * Generate searchable text from contact data for embedding
   * Combines relevant fields into a single text representation
   */
  getContactSearchText(contact: ContactEmbeddingData): string {
    const parts: string[] = [];

    // Name (highest priority)
    if (contact.firstName) {
      parts.push(contact.firstName);
    }
    if (contact.lastName) {
      parts.push(contact.lastName);
    }

    // Professional information
    if (contact.position) {
      parts.push(contact.position);
    }
    if (contact.company) {
      parts.push(contact.company);
    }

    // Contact details
    if (contact.email) {
      parts.push(contact.email);
    }
    if (contact.phone) {
      parts.push(contact.phone);
    }

    // Location
    if (contact.location) {
      parts.push(contact.location);
    }

    // Tags
    if (contact.tags && contact.tags.length > 0) {
      const tagNames = contact.tags.map((t) => t.tag.name).join(' ');
      parts.push(tagNames);
    }

    // Notes (lower priority, but important for context)
    if (contact.notes) {
      // Truncate notes to avoid overwhelming the embedding with too much text
      const truncatedNotes = contact.notes.substring(0, 500);
      parts.push(truncatedNotes);
    }

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Generate embedding for a contact
   * @param contact - Contact data to generate embedding for
   * @returns 1536-dimensional embedding vector
   */
  async generateContactEmbedding(contact: ContactEmbeddingData): Promise<number[]> {
    const searchText = this.getContactSearchText(contact);
    return this.generateEmbedding(searchText);
  }

  /**
   * Batch generate embeddings for multiple contacts
   * Processes in batches of 100 (OpenAI limit)
   * @param contacts - Array of contact data
   * @returns Map of contact ID to embedding vector
   */
  async batchGenerateEmbeddings(
    contacts: Array<ContactEmbeddingData & { id: string }>,
  ): Promise<Map<string, number[]>> {
    if (!this.isAvailable()) {
      throw new Error('OpenAI API key not configured');
    }

    if (contacts.length === 0) {
      return new Map();
    }

    const embeddings = new Map<string, number[]>();

    // Process in batches
    for (let i = 0; i < contacts.length; i += this.BATCH_SIZE) {
      const batch = contacts.slice(i, i + this.BATCH_SIZE);
      const texts = batch.map((c) => this.getContactSearchText(c));

      try {
        this.logger.debug(
          `Generating embeddings for batch ${Math.floor(i / this.BATCH_SIZE) + 1} (${batch.length} contacts)`,
        );

        const response = await this.openai!.embeddings.create({
          model: this.EMBEDDING_MODEL,
          input: texts,
        });

        // Map embeddings to contact IDs
        batch.forEach((contact, idx) => {
          const responseData = response.data[idx];
          if (!responseData) {
            this.logger.warn(
              `No embedding data returned for contact ${contact.id} at index ${idx}`,
            );
            return;
          }
          const embedding = responseData.embedding;

          if (embedding.length !== this.EMBEDDING_DIMENSIONS) {
            this.logger.warn(
              `Unexpected embedding dimensions for contact ${contact.id}: ${embedding.length}`,
            );
          }

          embeddings.set(contact.id, embedding);
        });

        // Rate limiting - sleep between batches
        if (i + this.BATCH_SIZE < contacts.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.logger.error(
          `Failed to generate embeddings for batch ${Math.floor(i / this.BATCH_SIZE) + 1}`,
          error,
        );
        throw error;
      }
    }

    this.logger.log(
      `Successfully generated ${embeddings.size} embeddings for ${contacts.length} contacts`,
    );

    return embeddings;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param embedding1 - First embedding vector
   * @param embedding2 - Second embedding vector
   * @returns Similarity score (0-1, higher is more similar)
   */
  calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i]! * embedding2[i]!;
      norm1 += embedding1[i]! * embedding1[i]!;
      norm2 += embedding2[i]! * embedding2[i]!;
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    // Clamp to [0, 1] range
    return Math.max(0, Math.min(1, similarity));
  }
}
