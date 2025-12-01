import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class FullTextSearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build PostgreSQL full-text search query
   */
  buildSearchQuery(
    query: string,
    fields?: string[],
  ): {
    searchVector: string;
    query: string;
  } {
    // Sanitize query to prevent SQL injection
    const sanitizedQuery = query.replace(/[^\w\s@.-]/g, '');

    return {
      searchVector: '@@',
      query: `plainto_tsquery('english', '${sanitizedQuery}')`,
    };
  }

  /**
   * Execute fuzzy search using PostgreSQL trigram similarity
   */
  async executeFuzzySearch(
    userId: string,
    query: string,
    fields?: string[],
    limit: number = 20,
  ): Promise<any[]> {
    // Use pg_trgm for fuzzy matching
    const fieldConditions = this.buildFuzzyFieldConditions(query, fields);

    const results = await this.prisma.$queryRaw`
      SELECT
        c.id,
        c.user_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.position,
        c.location,
        c.notes,
        c.tags,
        c.created_at,
        c.updated_at,
        GREATEST(
          similarity(COALESCE(c.first_name, ''), ${query}),
          similarity(COALESCE(c.last_name, ''), ${query}),
          similarity(COALESCE(c.email, ''), ${query}),
          similarity(COALESCE(c.company, ''), ${query})
        ) as similarity_score
      FROM contacts c
      WHERE c.user_id = ${userId}::uuid
        AND c.deleted_at IS NULL
        AND (
          similarity(COALESCE(c.first_name, ''), ${query}) > 0.3
          OR similarity(COALESCE(c.last_name, ''), ${query}) > 0.3
          OR similarity(COALESCE(c.email, ''), ${query}) > 0.3
          OR similarity(COALESCE(c.company, ''), ${query}) > 0.3
        )
      ORDER BY similarity_score DESC
      LIMIT ${limit}
    `;

    return this.mapResultsToContacts(results as any[]);
  }

  /**
   * Execute standard full-text search
   */
  async executeFullTextSearch(
    userId: string,
    query: string,
    fields?: string[],
    limit: number = 20,
  ): Promise<any[]> {
    const sanitizedQuery = query.replace(/[^\w\s@.-]/g, '');

    // Build field-specific search if fields are specified
    const searchFields = this.getSearchFields(fields);

    const results = await this.prisma.$queryRaw`
      SELECT
        c.id,
        c.user_id,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        c.position,
        c.location,
        c.notes,
        c.tags,
        c.created_at,
        c.updated_at,
        ts_rank(
          to_tsvector('english', ${Prisma.raw(searchFields)}),
          plainto_tsquery('english', ${sanitizedQuery})
        ) as rank
      FROM contacts c
      WHERE c.user_id = ${userId}::uuid
        AND c.deleted_at IS NULL
        AND to_tsvector('english', ${Prisma.raw(searchFields)}) @@ plainto_tsquery('english', ${sanitizedQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;

    return this.mapResultsToContacts(results as any[]);
  }

  /**
   * Get search fields SQL based on requested fields
   */
  private getSearchFields(fields?: string[]): string {
    if (!fields || fields.length === 0) {
      return `
        COALESCE(c.first_name, '') || ' ' ||
        COALESCE(c.last_name, '') || ' ' ||
        COALESCE(c.email, '') || ' ' ||
        COALESCE(c.company, '') || ' ' ||
        COALESCE(c.notes, '') || ' ' ||
        COALESCE(array_to_string(c.tags, ' '), '')
      `;
    }

    const fieldMap: Record<string, string> = {
      name: `COALESCE(c.first_name, '') || ' ' || COALESCE(c.last_name, '')`,
      email: `COALESCE(c.email, '')`,
      company: `COALESCE(c.company, '')`,
      notes: `COALESCE(c.notes, '')`,
      tags: `COALESCE(array_to_string(c.tags, ' '), '')`,
    };

    return fields
      .map((field) => fieldMap[field])
      .filter(Boolean)
      .join(" || ' ' || ");
  }

  /**
   * Build fuzzy field conditions
   */
  private buildFuzzyFieldConditions(query: string, fields?: string[]): string {
    const defaultFields = ['first_name', 'last_name', 'email', 'company'];
    const targetFields = fields?.length ? this.mapFieldsToColumns(fields) : defaultFields;

    return targetFields
      .map((field) => `similarity(COALESCE(c.${field}, ''), '${query}') > 0.3`)
      .join(' OR ');
  }

  /**
   * Map friendly field names to column names
   */
  private mapFieldsToColumns(fields: string[]): string[] {
    const fieldMap: Record<string, string> = {
      name: 'first_name,last_name',
      email: 'email',
      company: 'company',
      notes: 'notes',
      tags: 'tags',
    };

    return fields
      .flatMap((field) => fieldMap[field]?.split(',') ?? [])
      .filter((f): f is string => f !== undefined && f !== null);
  }

  /**
   * Map raw results to contact objects
   */
  private mapResultsToContacts(results: any[]): any[] {
    return results.map((row) => ({
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      position: row.position,
      location: row.location,
      notes: row.notes,
      tags: row.tags || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      rank: row.rank || row.similarity_score || 0,
    }));
  }
}
