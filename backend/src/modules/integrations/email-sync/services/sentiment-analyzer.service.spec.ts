/**
 * Unit tests for SentimentAnalyzerService
 * US-030: Email communication sync
 * TDD: RED phase - Tests written FIRST
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SentimentAnalyzerService } from './sentiment-analyzer.service';
import { SentimentResult } from '../interfaces/email.interface';

describe('SentimentAnalyzerService', () => {
  let service: SentimentAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SentimentAnalyzerService],
    }).compile();

    service = module.get<SentimentAnalyzerService>(SentimentAnalyzerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeSentiment', () => {
    it('should analyze positive sentiment correctly', () => {
      const text = 'I am very happy and excited about this opportunity! Thank you so much!';
      const result: SentimentResult = service.analyzeSentiment(text);

      expect(result.score).toBeGreaterThan(0);
      expect(result.label).toBe('positive');
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should analyze negative sentiment correctly', () => {
      const text = 'I am very disappointed and frustrated with this situation. This is terrible.';
      const result: SentimentResult = service.analyzeSentiment(text);

      expect(result.score).toBeLessThan(0);
      expect(result.label).toBe('negative');
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should analyze neutral sentiment correctly', () => {
      const text = 'The meeting is scheduled for tomorrow at 2pm.';
      const result: SentimentResult = service.analyzeSentiment(text);

      expect(result.label).toBe('neutral');
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
      expect(Math.abs(result.score)).toBeLessThanOrEqual(0.3);
    });

    it('should handle empty text', () => {
      const result: SentimentResult = service.analyzeSentiment('');

      expect(result.score).toBe(0);
      expect(result.label).toBe('neutral');
    });

    it('should handle long text', () => {
      const longText = Array(100).fill('This is a great product.').join(' ');
      const result: SentimentResult = service.analyzeSentiment(longText);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
      expect(result.label).toBe('positive');
    });

    it('should normalize score to -1 to 1 range', () => {
      const veryPositive = 'Absolutely amazing! Fantastic! Wonderful! Excellent! Perfect!';
      const result: SentimentResult = service.analyzeSentiment(veryPositive);

      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });

    it('should handle special characters and emojis', () => {
      const textWithEmojis = 'Great work! 👍 😊 Thank you!!!';
      const result: SentimentResult = service.analyzeSentiment(textWithEmojis);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });

    it('should calculate comparative score', () => {
      const text = 'This is good';
      const result: SentimentResult = service.analyzeSentiment(text);

      expect(result.comparative).toBeDefined();
      expect(typeof result.comparative).toBe('number');
    });
  });

  describe('analyzeBatch', () => {
    it('should analyze multiple texts in batch', () => {
      const texts = ['This is excellent!', 'This is terrible.', 'This is okay.'];

      const results = service.analyzeBatch(texts);

      expect(results).toHaveLength(3);
      expect(results[0]?.label).toBe('positive');
      expect(results[1]?.label).toBe('negative');
      expect(results[2]?.label).toBe('neutral');
    });

    it('should handle empty batch', () => {
      const results = service.analyzeBatch([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('getLabel', () => {
    it('should return correct label for positive score', () => {
      expect(service['getLabel'](0.5)).toBe('positive');
      expect(service['getLabel'](0.1)).toBe('positive');
      expect(service['getLabel'](1.0)).toBe('positive');
    });

    it('should return correct label for negative score', () => {
      expect(service['getLabel'](-0.5)).toBe('negative');
      expect(service['getLabel'](-0.1)).toBe('negative');
      expect(service['getLabel'](-1.0)).toBe('negative');
    });

    it('should return correct label for neutral score', () => {
      expect(service['getLabel'](0)).toBe('neutral');
      expect(service['getLabel'](0.05)).toBe('neutral');
      expect(service['getLabel'](-0.05)).toBe('neutral');
    });
  });
});
