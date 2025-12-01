import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService, ContactEmbeddingData } from './embedding.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'OPENAI_API_KEY') {
        return 'test-api-key';
      }
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isAvailable', () => {
    it('should return true when API key is configured', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when API key is not configured', async () => {
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          EmbeddingService,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => null),
            },
          },
        ],
      }).compile();

      const serviceWithoutKey = moduleWithoutKey.get<EmbeddingService>(EmbeddingService);
      expect(serviceWithoutKey.isAvailable()).toBe(false);
    });
  });

  describe('getContactSearchText', () => {
    it('should combine contact fields into searchable text', () => {
      const contact: ContactEmbeddingData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme Corp',
        position: 'CTO',
        location: 'Prague',
        notes: 'Met at conference',
        tags: [{ tag: { name: 'investor' } }, { tag: { name: 'tech' } }],
      };

      const searchText = service.getContactSearchText(contact);

      expect(searchText).toContain('John');
      expect(searchText).toContain('Doe');
      expect(searchText).toContain('CTO');
      expect(searchText).toContain('Acme Corp');
      expect(searchText).toContain('Prague');
      expect(searchText).toContain('investor');
      expect(searchText).toContain('tech');
      expect(searchText).toContain('Met at conference');
    });

    it('should handle minimal contact data', () => {
      const contact: ContactEmbeddingData = {
        firstName: 'Jane',
      };

      const searchText = service.getContactSearchText(contact);

      expect(searchText).toBe('Jane');
    });

    it('should truncate long notes', () => {
      const longNotes = 'a'.repeat(1000);
      const contact: ContactEmbeddingData = {
        firstName: 'John',
        notes: longNotes,
      };

      const searchText = service.getContactSearchText(contact);

      // Should truncate to 500 characters
      expect(searchText.length).toBeLessThan(600);
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should calculate similarity between identical vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [1, 0, 0];

      const similarity = service.calculateCosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should calculate similarity between orthogonal vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [0, 1, 0];

      const similarity = service.calculateCosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate similarity between opposite vectors', () => {
      const vector1 = [1, 0, 0];
      const vector2 = [-1, 0, 0];

      const similarity = service.calculateCosineSimilarity(vector1, vector2);

      // Cosine similarity of opposite vectors is -1, but we clamp to [0, 1]
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should throw error for vectors of different dimensions', () => {
      const vector1 = [1, 0];
      const vector2 = [1, 0, 0];

      expect(() => {
        service.calculateCosineSimilarity(vector1, vector2);
      }).toThrow('Embeddings must have the same dimensions');
    });
  });
});
