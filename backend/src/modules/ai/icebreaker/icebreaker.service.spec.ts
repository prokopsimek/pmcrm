/**
 * Icebreaker Service Unit Tests
 * US-051: AI icebreaker message generation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { IcebreakerService } from './icebreaker.service';
import { PrismaService } from '@/shared/database/prisma.service';
import { AIServiceFactory } from '../services/ai-service.factory';
import { ToneAdapterService } from './services/tone-adapter.service';
import { StyleLearnerService } from './services/style-learner.service';
import { LLMProviders, type MessageVariation } from './types';

describe('IcebreakerService', () => {
  let service: IcebreakerService;
  let prisma: jest.Mocked<PrismaService>;
  let aiServiceFactory: jest.Mocked<AIServiceFactory>;
  let toneAdapter: jest.Mocked<ToneAdapterService>;
  let styleLearner: jest.Mocked<StyleLearnerService>;

  const mockUserId = 'user-123';
  const mockContactId = 'contact-456';

  const mockContact = {
    id: mockContactId,
    userId: mockUserId,
    firstName: 'John',
    lastName: 'Doe',
    importance: 80,
    lastContact: new Date('2024-01-15'),
    employments: [
      {
        id: 'emp-1',
        isCurrent: true,
        title: 'Senior Developer',
        companyId: 'company-1',
        company: { id: 'company-1', name: 'Tech Corp' },
      },
    ],
    interactionParticipants: [
      {
        interaction: {
          occurredAt: new Date('2024-01-10'),
          summary: 'Discussed project collaboration',
        },
      },
    ],
  };

  const mockUser = {
    id: mockUserId,
    name: 'Jane Smith',
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane@example.com',
  };

  const mockVariations: MessageVariation[] = [
    {
      subject: 'Great to reconnect',
      body: 'Hi John, I hope this message finds you well!',
      talkingPoints: ['Reconnect', 'Show interest'],
      reasoning: 'Professional approach',
      variationIndex: 0,
    },
    {
      subject: 'Checking in',
      body: 'Hi John, wanted to reach out and see how things are going.',
      talkingPoints: ['Casual check-in', 'Open dialogue'],
      reasoning: 'Friendly approach',
      variationIndex: 1,
    },
    {
      subject: 'Quick hello',
      body: 'Hey John! Hope all is well with you.',
      talkingPoints: ['Brief', 'Warm'],
      reasoning: 'Casual approach',
      variationIndex: 2,
    },
  ];

  const mockAIService = {
    generateIcebreaker: jest.fn().mockResolvedValue({
      variations: mockVariations,
      generationTimeMs: 1500,
      modelVersion: 'gemini-2.5-flash',
      promptVersion: '1.0.0',
    }),
    getProvider: jest.fn().mockReturnValue(LLMProviders.GOOGLE),
    getModelVersion: jest.fn().mockReturnValue('gemini-2.5-flash'),
    isAvailable: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    prisma = {
      contact: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      generatedIcebreaker: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    aiServiceFactory = {
      getService: jest.fn().mockReturnValue(mockAIService),
      getProviderInfo: jest.fn().mockReturnValue({
        provider: LLMProviders.GOOGLE,
        model: 'gemini-2.5-flash',
        available: true,
      }),
    } as any;

    toneAdapter = {
      adaptTone: jest.fn().mockResolvedValue({ adaptedMessage: 'Adapted message' }),
    } as any;

    styleLearner = {
      getWritingStyleProfile: jest.fn().mockResolvedValue(null),
      learnFromSentMessages: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IcebreakerService,
        { provide: PrismaService, useValue: prisma },
        { provide: AIServiceFactory, useValue: aiServiceFactory },
        { provide: ToneAdapterService, useValue: toneAdapter },
        { provide: StyleLearnerService, useValue: styleLearner },
      ],
    }).compile();

    service = module.get<IcebreakerService>(IcebreakerService);
  });

  describe('generateIcebreaker', () => {
    beforeEach(() => {
      prisma.contact.findUnique.mockResolvedValue(mockContact as any);
      prisma.user.findUnique.mockResolvedValue(mockUser as any);
      prisma.contact.findMany.mockResolvedValue([]);
      prisma.generatedIcebreaker.create.mockResolvedValue({
        id: 'gen-123',
        userId: mockUserId,
        contactId: mockContactId,
        channel: 'email',
        tone: 'professional',
        variations: mockVariations,
        createdAt: new Date(),
      } as any);
    });

    it('should generate icebreaker variations successfully', async () => {
      const dto = {
        contactId: mockContactId,
        channel: 'email' as const,
        tone: 'professional' as const,
      };

      const result = await service.generateIcebreaker(mockUserId, dto);

      expect(result.variations).toHaveLength(3);
      expect(result.contactId).toBe(mockContactId);
      expect(result.channel).toBe('email');
      expect(result.tone).toBe('professional');
      expect(aiServiceFactory.getService).toHaveBeenCalled();
      expect(mockAIService.generateIcebreaker).toHaveBeenCalled();
    });

    it('should throw NotFoundException when contact not found', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      const dto = {
        contactId: 'nonexistent',
        channel: 'email' as const,
        tone: 'professional' as const,
      };

      await expect(service.generateIcebreaker(mockUserId, dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException when user does not own contact', async () => {
      prisma.contact.findUnique.mockResolvedValue({
        ...mockContact,
        userId: 'other-user',
      } as any);

      const dto = {
        contactId: mockContactId,
        channel: 'email' as const,
        tone: 'professional' as const,
      };

      await expect(service.generateIcebreaker(mockUserId, dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should store generation in database', async () => {
      const dto = {
        contactId: mockContactId,
        channel: 'linkedin' as const,
        tone: 'friendly' as const,
        triggerEvent: 'New job announcement',
      };

      await service.generateIcebreaker(mockUserId, dto);

      expect(prisma.generatedIcebreaker.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          contactId: mockContactId,
          channel: 'linkedin',
          tone: 'friendly',
          triggerEvent: 'New job announcement',
          llmProvider: LLMProviders.GOOGLE,
        }),
      });
    });

    it('should use correct provider from factory', async () => {
      aiServiceFactory.getProviderInfo.mockReturnValue({
        provider: LLMProviders.OPENAI,
        model: 'gpt-4o',
        available: true,
      });

      const dto = {
        contactId: mockContactId,
        channel: 'email' as const,
        tone: 'professional' as const,
      };

      await service.generateIcebreaker(mockUserId, dto);

      expect(prisma.generatedIcebreaker.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          llmProvider: LLMProviders.OPENAI,
        }),
      });
    });
  });

  describe('selectVariation', () => {
    const mockGeneration = {
      id: 'gen-123',
      userId: mockUserId,
      variations: mockVariations,
    };

    it('should select a variation by index', async () => {
      prisma.generatedIcebreaker.findUnique.mockResolvedValue(mockGeneration as any);
      prisma.generatedIcebreaker.update.mockResolvedValue({
        ...mockGeneration,
        selected: mockVariations[1],
      } as any);

      const result = await service.selectVariation(mockUserId, 'gen-123', { variationIndex: 1 });

      expect(result.selected).toEqual(mockVariations[1]);
      expect(prisma.generatedIcebreaker.update).toHaveBeenCalledWith({
        where: { id: 'gen-123', userId: mockUserId },
        data: { selected: mockVariations[1] },
      });
    });

    it('should throw NotFoundException for non-existent generation', async () => {
      prisma.generatedIcebreaker.findUnique.mockResolvedValue(null);

      await expect(
        service.selectVariation(mockUserId, 'nonexistent', { variationIndex: 0 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error for invalid variation index', async () => {
      prisma.generatedIcebreaker.findUnique.mockResolvedValue(mockGeneration as any);

      await expect(
        service.selectVariation(mockUserId, 'gen-123', { variationIndex: 10 }),
      ).rejects.toThrow('Invalid variation index');
    });
  });

  describe('editIcebreaker', () => {
    it('should update icebreaker with edited content', async () => {
      prisma.generatedIcebreaker.update.mockResolvedValue({
        id: 'gen-123',
        edited: true,
        editedContent: 'Custom edited message',
      } as any);

      const result = await service.editIcebreaker(mockUserId, 'gen-123', {
        editedContent: 'Custom edited message',
      });

      expect(result.edited).toBe(true);
      expect(result.editedContent).toBe('Custom edited message');
    });
  });

  describe('submitFeedback', () => {
    it('should update feedback for generation', async () => {
      prisma.generatedIcebreaker.update.mockResolvedValue({
        id: 'gen-123',
        feedback: 'helpful',
      } as any);

      const result = await service.submitFeedback(mockUserId, 'gen-123', { feedback: 'helpful' });

      expect(result.feedback).toBe('helpful');
    });
  });

  describe('getHistory', () => {
    it('should return user generation history', async () => {
      prisma.generatedIcebreaker.findMany.mockResolvedValue([
        {
          id: 'gen-1',
          contactId: mockContactId,
          channel: 'email',
          tone: 'professional',
          sent: false,
          feedback: null,
          createdAt: new Date(),
          sentAt: null,
          contact: { firstName: 'John', lastName: 'Doe' },
        },
      ] as any);

      const result = await service.getHistory(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].contactName).toBe('John Doe');
    });
  });

  describe('formatForChannel', () => {
    it('should keep subject for email channel', async () => {
      const message = { subject: 'Hello', body: 'Message body' };
      const result = await service.formatForChannel(message, 'email');

      expect(result.subject).toBe('Hello');
      expect(result.body).toBe('Message body');
    });

    it('should remove subject for LinkedIn channel', async () => {
      const message = { subject: 'Hello', body: 'Message body' };
      const result = await service.formatForChannel(message, 'linkedin');

      expect(result.subject).toBeUndefined();
      expect(result.body).toBe('Message body');
    });

    it('should truncate long messages for LinkedIn', async () => {
      const longBody = 'A'.repeat(400);
      const message = { subject: 'Hello', body: longBody };
      const result = await service.formatForChannel(message, 'linkedin');

      expect(result.body.length).toBe(300);
      expect(result.body.endsWith('...')).toBe(true);
    });
  });

  describe('selectTone', () => {
    it('should adapt tone using ToneAdapterService', async () => {
      toneAdapter.adaptTone.mockResolvedValue({ adaptedMessage: 'Adapted professional message' });

      const result = await service.selectTone('Original message', 'casual', 'professional');

      expect(result).toBe('Adapted professional message');
      expect(toneAdapter.adaptTone).toHaveBeenCalledWith(
        'Original message',
        'casual',
        'professional',
      );
    });
  });
});





