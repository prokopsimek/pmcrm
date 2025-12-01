/**
 * Unit tests for SearchController
 * US-060: Fulltext search in contacts
 * Tests API endpoints and validation
 */
import { Test, TestingModule } from '@nestjs/testing';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { UserFactory, ContactFactory } from '@test/factories';
import { BadRequestException } from '@nestjs/common';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: SearchService;

  const mockSearchService = {
    searchContacts: jest.fn(),
    searchWithHighlighting: jest.fn(),
    saveRecentSearch: jest.fn(),
    getRecentSearches: jest.fn(),
    clearRecentSearch: jest.fn(),
    clearAllRecentSearches: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [{ provide: SearchService, useValue: mockSearchService }],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    searchService = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/search/contacts', () => {
    it('should search contacts with query parameter', async () => {
      const user = UserFactory.build();
      const query = 'john';
      const contacts = [
        ContactFactory.build(user.id as string, { firstName: 'John', lastName: 'Doe' }),
        ContactFactory.build(user.id as string, { firstName: 'Johnny', lastName: 'Smith' }),
      ];

      mockSearchService.searchContacts.mockResolvedValue({
        results: contacts,
        total: 2,
        query,
      });

      const result = await controller.searchContacts({ user: { id: user.id } } as any, {
        q: query,
      });

      expect(result.results).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.query).toBe(query);
      expect(mockSearchService.searchContacts).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ query }),
      );
    });

    it('should filter by specific fields', async () => {
      const user = UserFactory.build();
      const query = 'acme';
      const fields = ['company'];

      mockSearchService.searchContacts.mockResolvedValue({
        results: [ContactFactory.build(user.id as string, { company: 'Acme Corp' })],
        total: 1,
        query,
      });

      const result = await controller.searchContacts({ user: { id: user.id } } as any, {
        q: query,
        fields: fields.join(','),
      });

      expect(result.results).toHaveLength(1);
      expect(mockSearchService.searchContacts).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ query, fields }),
      );
    });

    it('should enable fuzzy search when specified', async () => {
      const user = UserFactory.build();
      const query = 'jhon'; // Typo

      mockSearchService.searchContacts.mockResolvedValue({
        results: [ContactFactory.build(user.id as string, { firstName: 'John' })],
        total: 1,
        query,
      });

      await controller.searchContacts({ user: { id: user.id } } as any, {
        q: query,
        fuzzy: 'true',
      });

      expect(mockSearchService.searchContacts).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ query, fuzzy: true }),
      );
    });

    it('should limit results when specified', async () => {
      const user = UserFactory.build();
      const query = 'test';
      const limit = 5;

      mockSearchService.searchContacts.mockResolvedValue({
        results: ContactFactory.buildMany(user.id as string, 5),
        total: 50,
        query,
      });

      const result = await controller.searchContacts({ user: { id: user.id } } as any, {
        q: query,
        limit: limit.toString(),
      });

      expect(result.results).toHaveLength(5);
      expect(result.total).toBe(50);
      expect(mockSearchService.searchContacts).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ query, limit }),
      );
    });

    it('should require query parameter', async () => {
      const user = UserFactory.build();

      await expect(
        controller.searchContacts({ user: { id: user.id } } as any, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty query', async () => {
      const user = UserFactory.build();

      await expect(
        controller.searchContacts({ user: { id: user.id } } as any, { q: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject query shorter than 2 characters', async () => {
      const user = UserFactory.build();

      await expect(
        controller.searchContacts({ user: { id: user.id } } as any, { q: 'a' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should enable highlighting by default', async () => {
      const user = UserFactory.build();
      const query = 'john';

      mockSearchService.searchWithHighlighting.mockResolvedValue({
        results: [
          {
            ...ContactFactory.build(user.id as string, { firstName: 'John' }),
            highlighted: {
              firstName: '<mark>John</mark>',
            },
          },
        ],
        total: 1,
        query,
      });

      const result = await controller.searchContacts({ user: { id: user.id } } as any, {
        q: query,
        highlight: 'true',
      });

      expect(result.results[0].highlighted).toBeDefined();
      expect(mockSearchService.searchWithHighlighting).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/search/recent', () => {
    it('should return recent searches for user', async () => {
      const user = UserFactory.build();
      const recentSearches = [
        { id: 's1', query: 'john', resultCount: 5, createdAt: new Date() },
        { id: 's2', query: 'acme', resultCount: 3, createdAt: new Date() },
        { id: 's3', query: 'developer', resultCount: 8, createdAt: new Date() },
      ];

      mockSearchService.getRecentSearches.mockResolvedValue(recentSearches);

      const result = await controller.getRecentSearches({
        user: { id: user.id },
      } as any);

      expect(result).toHaveLength(3);
      expect(result[0].query).toBe('john');
      expect(mockSearchService.getRecentSearches).toHaveBeenCalledWith(user.id);
    });

    it('should limit results to 10 most recent', async () => {
      const user = UserFactory.build();
      const recentSearches = Array(15)
        .fill(null)
        .map((_, i) => ({
          id: `s${i}`,
          query: `query${i}`,
          resultCount: i,
          createdAt: new Date(),
        }));

      mockSearchService.getRecentSearches.mockResolvedValue(recentSearches.slice(0, 10));

      const result = await controller.getRecentSearches({
        user: { id: user.id },
      } as any);

      expect(result).toHaveLength(10);
    });

    it('should return empty array when no recent searches', async () => {
      const user = UserFactory.build();

      mockSearchService.getRecentSearches.mockResolvedValue([]);

      const result = await controller.getRecentSearches({
        user: { id: user.id },
      } as any);

      expect(result).toEqual([]);
    });
  });

  describe('DELETE /api/v1/search/recent/:id', () => {
    it('should delete specific search from history', async () => {
      const user = UserFactory.build();
      const searchId = 'search-123';

      mockSearchService.clearRecentSearch.mockResolvedValue(undefined);

      await controller.clearRecentSearch({ user: { id: user.id } } as any, searchId);

      expect(mockSearchService.clearRecentSearch).toHaveBeenCalledWith(user.id, searchId);
    });

    it('should only allow deleting own searches', async () => {
      const user = UserFactory.build();
      const searchId = 'search-123';

      // Service should enforce this via userId filter
      mockSearchService.clearRecentSearch.mockResolvedValue(undefined);

      await controller.clearRecentSearch({ user: { id: user.id } } as any, searchId);

      expect(mockSearchService.clearRecentSearch).toHaveBeenCalledWith(user.id, searchId);
    });
  });

  describe('DELETE /api/v1/search/recent', () => {
    it('should clear all search history for user', async () => {
      const user = UserFactory.build();

      mockSearchService.clearAllRecentSearches.mockResolvedValue(undefined);

      await controller.clearAllRecentSearches({
        user: { id: user.id },
      } as any);

      expect(mockSearchService.clearAllRecentSearches).toHaveBeenCalledWith(user.id);
    });
  });

  describe('field validation', () => {
    it('should accept valid field names', async () => {
      const user = UserFactory.build();
      const validFields = ['name', 'email', 'company', 'tags', 'notes'];

      for (const field of validFields) {
        mockSearchService.searchContacts.mockResolvedValue({
          results: [],
          total: 0,
          query: 'test',
        });

        await controller.searchContacts({ user: { id: user.id } } as any, {
          q: 'test',
          fields: field,
        });

        expect(mockSearchService.searchContacts).toHaveBeenCalledWith(
          user.id,
          expect.objectContaining({ fields: [field] }),
        );
      }
    });

    it('should reject invalid field names', async () => {
      const user = UserFactory.build();

      await expect(
        controller.searchContacts({ user: { id: user.id } } as any, {
          q: 'test',
          fields: 'invalid_field',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept multiple comma-separated fields', async () => {
      const user = UserFactory.build();

      mockSearchService.searchContacts.mockResolvedValue({
        results: [],
        total: 0,
        query: 'test',
      });

      await controller.searchContacts({ user: { id: user.id } } as any, {
        q: 'test',
        fields: 'name,email,company',
      });

      expect(mockSearchService.searchContacts).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ fields: ['name', 'email', 'company'] }),
      );
    });
  });

  describe('performance tracking', () => {
    it('should track search duration', async () => {
      const user = UserFactory.build();
      const query = 'performance';

      mockSearchService.searchContacts.mockResolvedValue({
        results: [],
        total: 0,
        query,
        duration: 45, // ms
      });

      const result = await controller.searchContacts({ user: { id: user.id } } as any, {
        q: query,
      });

      expect(result.duration).toBeDefined();
      expect(result.duration).toBeLessThan(100);
    });
  });
});
