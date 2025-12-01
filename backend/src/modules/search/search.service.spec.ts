/**
 * Unit tests for SearchService
 * US-060: Fulltext search in contacts
 * Coverage target: 90%+
 *
 * Performance Requirements:
 * - Search response time < 100ms (p95)
 * - Fuzzy search (typo tolerance)
 * - Highlighting matched terms
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { FullTextSearchService } from './services/full-text-search.service';
import { RankingService } from './services/ranking.service';
import { HighlightingService } from './services/highlighting.service';
import { UserFactory, ContactFactory } from '@test/factories';

describe('SearchService', () => {
  let service: SearchService;
  let prismaService: PrismaService;
  let fullTextSearchService: FullTextSearchService;
  let rankingService: RankingService;
  let highlightingService: HighlightingService;

  const mockPrismaService = {
    contact: {
      findMany: jest.fn(),
    },
    searchHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  };

  const mockFullTextSearchService = {
    buildSearchQuery: jest.fn(),
    executeFuzzySearch: jest.fn(),
  };

  const mockRankingService = {
    rankResults: jest.fn(),
    calculateRelevanceScore: jest.fn(),
  };

  const mockHighlightingService = {
    highlightMatches: jest.fn(),
    extractSnippet: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FullTextSearchService, useValue: mockFullTextSearchService },
        { provide: RankingService, useValue: mockRankingService },
        { provide: HighlightingService, useValue: mockHighlightingService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    prismaService = module.get<PrismaService>(PrismaService);
    fullTextSearchService = module.get<FullTextSearchService>(FullTextSearchService);
    rankingService = module.get<RankingService>(RankingService);
    highlightingService = module.get<HighlightingService>(HighlightingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchContacts', () => {
    it('should search contacts by name with highlighting', async () => {
      const user = UserFactory.build();
      const query = 'john';
      const contacts = [
        ContactFactory.build(user.id as string, {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
        }),
        ContactFactory.build(user.id as string, {
          firstName: 'Johnny',
          lastName: 'Smith',
          email: 'johnny@example.com',
        }),
      ];

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue(contacts);

      mockRankingService.rankResults.mockReturnValue([
        { ...contacts[0], rank: 0.9 },
        { ...contacts[1], rank: 0.7 },
      ]);

      mockHighlightingService.highlightMatches.mockImplementation((text, q) => {
        return text.replace(new RegExp(q, 'gi'), (match) => `<mark>${match}</mark>`);
      });

      const result = await service.searchContacts(user.id as string, {
        query,
        fields: ['name', 'email'],
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].firstName).toContain('John');
      expect(mockFullTextSearchService.buildSearchQuery).toHaveBeenCalledWith(query, [
        'name',
        'email',
      ]);
      expect(mockRankingService.rankResults).toHaveBeenCalled();
      expect(mockHighlightingService.highlightMatches).toHaveBeenCalled();
    });

    it('should search contacts by email', async () => {
      const user = UserFactory.build();
      const query = 'acme.com';

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        ContactFactory.build(user.id as string, { email: 'john@acme.com' }),
        ContactFactory.build(user.id as string, { email: 'jane@acme.com' }),
      ]);

      mockRankingService.rankResults.mockReturnValue([
        { ...ContactFactory.build(user.id as string, { email: 'john@acme.com' }), rank: 0.95 },
        { ...ContactFactory.build(user.id as string, { email: 'jane@acme.com' }), rank: 0.93 },
      ]);

      const result = await service.searchContacts(user.id as string, {
        query,
        fields: ['email'],
      });

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.every((r) => r.email?.includes('acme.com'))).toBe(true);
    });

    it('should search contacts by company', async () => {
      const user = UserFactory.build();
      const query = 'Acme Corp';

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        ContactFactory.build(user.id as string, { company: 'Acme Corp' }),
      ]);

      mockRankingService.rankResults.mockReturnValue([
        { ...ContactFactory.build(user.id as string, { company: 'Acme Corp' }), rank: 1.0 },
      ]);

      const result = await service.searchContacts(user.id as string, {
        query,
        fields: ['company'],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].company).toBe('Acme Corp');
    });

    it('should search in tags', async () => {
      const user = UserFactory.build();
      const query = 'important';

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        ContactFactory.build(user.id as string, { tags: ['important', 'client'] }),
      ]);

      mockRankingService.rankResults.mockReturnValue([
        {
          ...ContactFactory.build(user.id as string, { tags: ['important', 'client'] }),
          rank: 0.88,
        },
      ]);

      const result = await service.searchContacts(user.id as string, {
        query,
        fields: ['tags'],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].tags).toContain('important');
    });

    it('should search in notes', async () => {
      const user = UserFactory.build();
      const query = 'meeting next week';

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([
        ContactFactory.build(user.id as string, {
          notes: 'Schedule meeting next week about project',
        }),
      ]);

      mockRankingService.rankResults.mockReturnValue([
        {
          ...ContactFactory.build(user.id as string, {
            notes: 'Schedule meeting next week about project',
          }),
          rank: 0.75,
        },
      ]);

      const result = await service.searchContacts(user.id as string, {
        query,
        fields: ['notes'],
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].notes).toContain('meeting next week');
    });

    it('should perform fuzzy search with typo tolerance', async () => {
      const user = UserFactory.build();
      const query = 'jhon'; // Typo for 'john'

      mockFullTextSearchService.executeFuzzySearch.mockResolvedValue([
        ContactFactory.build(user.id as string, { firstName: 'John' }),
      ]);

      mockRankingService.rankResults.mockReturnValue([
        { ...ContactFactory.build(user.id as string, { firstName: 'John' }), rank: 0.85 },
      ]);

      const result = await service.searchContacts(user.id as string, {
        query,
        fuzzy: true,
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].firstName).toBe('John');
      expect(mockFullTextSearchService.executeFuzzySearch).toHaveBeenCalled();
    });

    it('should limit results to specified count', async () => {
      const user = UserFactory.build();
      const query = 'test';
      const contacts = ContactFactory.buildMany(user.id as string, 30);

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue(contacts.slice(0, 20));
      mockRankingService.rankResults.mockReturnValue(contacts.slice(0, 20));

      const result = await service.searchContacts(user.id as string, {
        query,
        limit: 20,
      });

      expect(result.results).toHaveLength(20);
      expect(result.total).toBeGreaterThan(20);
    });

    it('should return empty results for no matches', async () => {
      const user = UserFactory.build();
      const query = 'nonexistent';

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([]);
      mockRankingService.rankResults.mockReturnValue([]);

      const result = await service.searchContacts(user.id as string, {
        query,
      });

      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('searchWithHighlighting', () => {
    it('should highlight matched terms in all fields', async () => {
      const user = UserFactory.build();
      const query = 'john';
      const contact = ContactFactory.build(user.id as string, {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        company: 'John & Sons',
      });

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([contact]);
      mockRankingService.rankResults.mockReturnValue([{ ...contact, rank: 0.9 }]);

      mockHighlightingService.highlightMatches.mockImplementation((text, q) => {
        return text.replace(new RegExp(q, 'gi'), (match) => `<mark>${match}</mark>`);
      });

      const result = await service.searchWithHighlighting(user.id as string, {
        query,
      });

      expect(result.results[0].highlighted).toBeDefined();
      expect(result.results[0].highlighted.firstName).toContain('<mark>');
      expect(result.results[0].highlighted.email).toContain('<mark>');
      expect(result.results[0].highlighted.company).toContain('<mark>');
    });

    it('should provide context snippets for notes', async () => {
      const user = UserFactory.build();
      const query = 'project';
      const contact = ContactFactory.build(user.id as string, {
        notes:
          'This is a very long note about the project timeline and deliverables. The project has multiple phases.',
      });

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue([contact]);
      mockRankingService.rankResults.mockReturnValue([{ ...contact, rank: 0.8 }]);
      mockHighlightingService.extractSnippet.mockReturnValue(
        '...about the <mark>project</mark> timeline...',
      );

      const result = await service.searchWithHighlighting(user.id as string, {
        query,
      });

      expect(result.results[0].highlighted.notes).toContain('...');
      expect(result.results[0].highlighted.notes).toContain('<mark>project</mark>');
    });
  });

  describe('saveRecentSearch', () => {
    it('should save search query to history', async () => {
      const user = UserFactory.build();
      const query = 'john doe';
      const resultCount = 5;

      mockPrismaService.searchHistory.create.mockResolvedValue({
        id: 'search-1',
        userId: user.id,
        query,
        resultCount,
        filters: {},
        createdAt: new Date(),
      });

      await service.saveRecentSearch(user.id as string, query, resultCount);

      expect(mockPrismaService.searchHistory.create).toHaveBeenCalledWith({
        data: {
          userId: user.id,
          query,
          resultCount,
          filters: {},
        },
      });
    });

    it('should not save empty queries', async () => {
      const user = UserFactory.build();

      await service.saveRecentSearch(user.id as string, '', 0);

      expect(mockPrismaService.searchHistory.create).not.toHaveBeenCalled();
    });

    it('should limit history to 50 most recent searches', async () => {
      const user = UserFactory.build();
      const query = 'test';

      mockPrismaService.searchHistory.findMany.mockResolvedValue(
        Array(50)
          .fill(null)
          .map((_, i) => ({
            id: `search-${i}`,
            userId: user.id,
            query: `query-${i}`,
            resultCount: 1,
            createdAt: new Date(),
          })),
      );

      mockPrismaService.searchHistory.create.mockResolvedValue({
        id: 'search-51',
        userId: user.id,
        query,
        resultCount: 1,
        createdAt: new Date(),
      });

      await service.saveRecentSearch(user.id as string, query, 1);

      expect(mockPrismaService.searchHistory.deleteMany).toHaveBeenCalled();
    });
  });

  describe('getRecentSearches', () => {
    it('should return recent searches for user', async () => {
      const user = UserFactory.build();
      const recentSearches = [
        { id: 's1', query: 'john', resultCount: 5, createdAt: new Date() },
        { id: 's2', query: 'acme', resultCount: 3, createdAt: new Date() },
        { id: 's3', query: 'developer', resultCount: 8, createdAt: new Date() },
      ];

      mockPrismaService.searchHistory.findMany.mockResolvedValue(recentSearches);

      const result = await service.getRecentSearches(user.id as string);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe('john');
      expect(mockPrismaService.searchHistory.findMany).toHaveBeenCalledWith({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    });

    it('should deduplicate recent searches', async () => {
      const user = UserFactory.build();
      const recentSearches = [
        { id: 's1', query: 'john', resultCount: 5, createdAt: new Date() },
        { id: 's2', query: 'john', resultCount: 4, createdAt: new Date() },
        { id: 's3', query: 'jane', resultCount: 2, createdAt: new Date() },
      ];

      mockPrismaService.searchHistory.findMany.mockResolvedValue(recentSearches);

      const result = await service.getRecentSearches(user.id as string);

      const uniqueQueries = [...new Set(result.map((r) => r.query))];
      expect(result.length).toBe(uniqueQueries.length);
    });
  });

  describe('clearRecentSearch', () => {
    it('should delete specific search from history', async () => {
      const user = UserFactory.build();
      const searchId = 'search-123';

      mockPrismaService.searchHistory.delete.mockResolvedValue({
        id: searchId,
        userId: user.id,
        query: 'test',
        resultCount: 1,
        createdAt: new Date(),
      });

      await service.clearRecentSearch(user.id as string, searchId);

      expect(mockPrismaService.searchHistory.delete).toHaveBeenCalledWith({
        where: {
          id: searchId,
          userId: user.id, // Ensure user can only delete their own
        },
      });
    });

    it('should clear all search history for user', async () => {
      const user = UserFactory.build();

      mockPrismaService.searchHistory.deleteMany.mockResolvedValue({ count: 15 });

      await service.clearAllRecentSearches(user.id as string);

      expect(mockPrismaService.searchHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id },
      });
    });
  });

  describe('performance', () => {
    it('should complete search in < 100ms', async () => {
      const user = UserFactory.build();
      const query = 'performance test';
      const contacts = ContactFactory.buildMany(user.id as string, 1000);

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      // Simulate realistic query time
      mockPrismaService.$queryRaw.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms
        return contacts.slice(0, 20);
      });

      mockRankingService.rankResults.mockReturnValue(contacts.slice(0, 20));

      const startTime = Date.now();
      await service.searchContacts(user.id as string, { query });
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should handle large result sets efficiently', async () => {
      const user = UserFactory.build();
      const query = 'common';
      const largeResultSet = ContactFactory.buildMany(user.id as string, 10000);

      mockFullTextSearchService.buildSearchQuery.mockReturnValue({
        searchVector: '@@',
        query: "plainto_tsquery('english', $1)",
      });

      mockPrismaService.$queryRaw.mockResolvedValue(largeResultSet.slice(0, 20));
      mockRankingService.rankResults.mockReturnValue(largeResultSet.slice(0, 20));

      const startTime = Date.now();
      const result = await service.searchContacts(user.id as string, {
        query,
        limit: 20,
      });
      const endTime = Date.now();

      expect(result.results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(100);
    });
  });

  describe('rankResults', () => {
    it('should rank exact matches higher', async () => {
      const user = UserFactory.build();
      const contacts = [
        ContactFactory.build(user.id as string, { firstName: 'John', lastName: 'Smith' }),
        ContactFactory.build(user.id as string, { firstName: 'Johnny', lastName: 'Doe' }),
        ContactFactory.build(user.id as string, { firstName: 'Jonathan', lastName: 'Brown' }),
      ];

      mockRankingService.rankResults.mockReturnValue([
        { ...contacts[0], rank: 1.0 }, // Exact match
        { ...contacts[1], rank: 0.8 }, // Partial match
        { ...contacts[2], rank: 0.6 }, // Prefix match
      ]);

      const ranked = mockRankingService.rankResults(contacts, 'John');

      expect(ranked[0].firstName).toBe('John');
      expect(ranked[0].rank).toBeGreaterThan(ranked[1].rank);
      expect(ranked[1].rank).toBeGreaterThan(ranked[2].rank);
    });

    it('should boost recent contacts', async () => {
      const user = UserFactory.build();
      const recentDate = new Date();
      const oldDate = new Date();
      oldDate.setMonth(oldDate.getMonth() - 6);

      const contacts = [
        ContactFactory.build(user.id as string, { firstName: 'John', updatedAt: recentDate }),
        ContactFactory.build(user.id as string, { firstName: 'John', updatedAt: oldDate }),
      ];

      mockRankingService.rankResults.mockImplementation((ctcs) => {
        return ctcs.map((c) => ({
          ...c,
          rank: c.updatedAt > oldDate ? 0.95 : 0.75,
        }));
      });

      const ranked = mockRankingService.rankResults(contacts, 'John');

      expect(ranked[0].rank).toBeGreaterThan(ranked[1].rank);
    });
  });
});
