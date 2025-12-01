import {
  Controller,
  Get,
  Delete,
  Query,
  Param,
  Request,
  BadRequestException,
  Post,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import {
  SearchQueryDto,
  SearchResult,
  ContactSearchResult,
  SearchHistoryItem,
  SemanticSearchDto,
  HybridSearchDto,
  SemanticSearchResult,
} from './dto/search-query.dto';

/**
 * Search Controller
 * Note: Authentication is handled globally by better-auth AuthGuard
 */
@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('contacts')
  @ApiOperation({ summary: 'Search contacts with full-text search' })
  @ApiResponse({
    status: 200,
    description: 'Search results with highlighting and ranking',
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchContacts(
    @Request() req: any,
    @Query() queryParams: any,
  ): Promise<SearchResult<ContactSearchResult>> {
    // Validate query parameter
    if (!queryParams.q) {
      throw new BadRequestException('Query parameter "q" is required');
    }

    if (queryParams.q.trim().length === 0) {
      throw new BadRequestException('Query cannot be empty');
    }

    if (queryParams.q.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters long');
    }

    // Validate fields if provided
    if (queryParams.fields) {
      const validFields = ['name', 'email', 'company', 'tags', 'notes'];
      const requestedFields =
        typeof queryParams.fields === 'string'
          ? queryParams.fields.split(',').map((f: string) => f.trim())
          : queryParams.fields;

      const invalidFields = requestedFields.filter((field: string) => !validFields.includes(field));

      if (invalidFields.length > 0) {
        throw new BadRequestException(
          `Invalid field(s): ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`,
        );
      }
    }

    const userId = req.user.id;

    // Parse query parameters
    const options = {
      query: queryParams.q.trim(),
      fields: queryParams.fields
        ? typeof queryParams.fields === 'string'
          ? queryParams.fields.split(',').map((f: string) => f.trim())
          : queryParams.fields
        : undefined,
      fuzzy: queryParams.fuzzy === 'true' || queryParams.fuzzy === true,
      limit: queryParams.limit ? parseInt(queryParams.limit, 10) : 20,
    };

    // Execute search with or without highlighting
    const highlight = queryParams.highlight === 'true' || queryParams.highlight === true;

    if (highlight) {
      return this.searchService.searchWithHighlighting(userId, options);
    }

    return this.searchService.searchContacts(userId, options);
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recent search history' })
  @ApiResponse({
    status: 200,
    description: 'List of recent searches',
    type: [SearchHistoryItem],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getRecentSearches(@Request() req: any): Promise<SearchHistoryItem[]> {
    const userId = req.user.id;
    return this.searchService.getRecentSearches(userId, 10);
  }

  @Delete('recent/:id')
  @ApiOperation({ summary: 'Delete specific search from history' })
  @ApiResponse({ status: 200, description: 'Search deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Search not found' })
  async clearRecentSearch(@Request() req: any, @Param('id') searchId: string): Promise<void> {
    const userId = req.user.id;
    await this.searchService.clearRecentSearch(userId, searchId);
  }

  @Delete('recent')
  @ApiOperation({ summary: 'Clear all search history' })
  @ApiResponse({ status: 200, description: 'Search history cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearAllRecentSearches(@Request() req: any): Promise<void> {
    const userId = req.user.id;
    await this.searchService.clearAllRecentSearches(userId);
  }

  // ============================================================================
  // US-060: Semantic Search Endpoints
  // ============================================================================

  @Get('semantic')
  @ApiOperation({
    summary: 'Semantic search using AI embeddings (US-060)',
    description:
      'Search contacts using vector similarity for more intelligent, context-aware results',
  })
  @ApiResponse({
    status: 200,
    description: 'Semantic search results with similarity scores',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters or semantic search not available',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async semanticSearch(
    @Request() req: any,
    @Query() queryParams: SemanticSearchDto,
  ): Promise<SearchResult<SemanticSearchResult>> {
    const userId = req.user.id;

    // Check if semantic search is available
    if (!this.searchService.isSemanticSearchAvailable()) {
      throw new BadRequestException(
        'Semantic search is not available. Please configure OPENAI_API_KEY.',
      );
    }

    // Validate query
    if (!queryParams.q || queryParams.q.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters long');
    }

    return this.searchService.semanticSearch(userId, queryParams.q, {
      limit: queryParams.limit,
      threshold: queryParams.threshold,
    });
  }

  @Get('hybrid')
  @ApiOperation({
    summary: 'Hybrid search combining full-text and semantic search (US-060)',
    description:
      'Combines traditional keyword search with AI-powered semantic search for best results',
  })
  @ApiResponse({
    status: 200,
    description: 'Hybrid search results with combined ranking',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters or semantic search not available',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async hybridSearch(
    @Request() req: any,
    @Query() queryParams: HybridSearchDto,
  ): Promise<SearchResult<SemanticSearchResult>> {
    const userId = req.user.id;

    // Check if semantic search is available
    if (!this.searchService.isSemanticSearchAvailable()) {
      throw new BadRequestException(
        'Hybrid search requires semantic search. Please configure OPENAI_API_KEY.',
      );
    }

    // Validate query
    if (!queryParams.q || queryParams.q.trim().length < 2) {
      throw new BadRequestException('Query must be at least 2 characters long');
    }

    return this.searchService.hybridSearch(userId, queryParams.q, {
      limit: queryParams.limit,
      semanticWeight: queryParams.semanticWeight,
    });
  }

  @Get('contacts/:id/similar')
  @ApiOperation({
    summary: 'Find similar contacts using vector similarity (US-060)',
    description: 'Discover contacts similar to a given contact based on AI embeddings',
  })
  @ApiResponse({
    status: 200,
    description: 'List of similar contacts',
  })
  @ApiResponse({
    status: 400,
    description: 'Contact has no embedding or semantic search not available',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async findSimilarContacts(
    @Request() req: any,
    @Param('id') contactId: string,
    @Query('limit') limit?: string,
  ): Promise<SearchResult<SemanticSearchResult>> {
    const userId = req.user.id;

    // Check if semantic search is available
    if (!this.searchService.isSemanticSearchAvailable()) {
      throw new BadRequestException(
        'Finding similar contacts requires semantic search. Please configure OPENAI_API_KEY.',
      );
    }

    const parsedLimit = limit ? parseInt(limit, 10) : 10;

    if (parsedLimit < 1 || parsedLimit > 100) {
      throw new BadRequestException('Limit must be between 1 and 100');
    }

    return this.searchService.findSimilarContacts(contactId, userId, parsedLimit);
  }

  @Post('contacts/:id/generate-embedding')
  @ApiOperation({
    summary: 'Generate embedding for a specific contact (US-060)',
    description: 'Manually trigger embedding generation for a contact',
  })
  @ApiResponse({
    status: 200,
    description: 'Embedding generated successfully',
  })
  @ApiResponse({ status: 400, description: 'Semantic search not available' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async generateContactEmbedding(
    @Request() req: any,
    @Param('id') contactId: string,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.id;

    // Check if semantic search is available
    if (!this.searchService.isSemanticSearchAvailable()) {
      throw new BadRequestException(
        'Embedding generation requires OpenAI API. Please configure OPENAI_API_KEY.',
      );
    }

    try {
      await this.searchService.generateContactEmbedding(contactId);
      return {
        success: true,
        message: 'Embedding generated successfully',
      };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }
}
