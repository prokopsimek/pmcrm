/**
 * Icebreaker Service - Main Business Logic
 * US-051: AI icebreaker message generation
 */

import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { AIServiceFactory } from '../services/ai-service.factory';
import { ToneAdapterService } from './services/tone-adapter.service';
import { StyleLearnerService } from './services/style-learner.service';
import {
  GenerateIcebreakerDto,
  RegenerateIcebreakerDto,
  EditIcebreakerDto,
  SelectVariationDto,
  SubmitFeedbackDto,
  IcebreakerResponseDto,
  IcebreakerHistoryDto,
} from './dto/generate-icebreaker.dto';
import {
  GenerationContext,
  ContactContext,
  UserContext,
  MessageVariation,
  Channel,
  Tone,
} from './types';

@Injectable()
export class IcebreakerService {
  private readonly logger = new Logger(IcebreakerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiServiceFactory: AIServiceFactory,
    private readonly toneAdapter: ToneAdapterService,
    private readonly styleLearner: StyleLearnerService,
  ) {}

  async generateIcebreaker(
    userId: string,
    dto: GenerateIcebreakerDto,
  ): Promise<IcebreakerResponseDto> {
    this.logger.log(`Generating icebreaker for user ${userId}, contact ${dto.contactId}`);

    // 1. Fetch and validate contact
    const contact = await this.getContactWithContext(userId, dto.contactId);

    // 2. Fetch user context
    const user = await this.getUserContext(userId);

    // 3. Build generation context
    const context: GenerationContext = {
      contact: await this.buildContactContext(contact, dto.triggerEvent),
      user,
      channel: dto.channel as Channel,
      tone: dto.tone as Tone,
      wordLimit: dto.wordLimit || 150,
    };

    // 4. Generate variations using configured AI provider
    const aiService = this.aiServiceFactory.getService();
    const result = await aiService.generateIcebreaker(context);
    const providerInfo = this.aiServiceFactory.getProviderInfo();

    // 5. Store in database
    const generated = await this.prisma.generatedIcebreaker.create({
      data: {
        userId,
        contactId: dto.contactId,
        channel: dto.channel,
        tone: dto.tone,
        triggerEvent: dto.triggerEvent,
        variations: result.variations as any,
        llmProvider: providerInfo.provider,
        modelVersion: result.modelVersion,
        promptVersion: result.promptVersion,
        tokensUsed: 0, // Vercel AI SDK doesn't expose token count directly
        costUsd: 0, // Pricing varies by provider, tracked separately if needed
        contextData: context as any,
        generationTime: result.generationTimeMs,
      },
    });

    return {
      id: generated.id,
      variations: result.variations.map((v) => ({
        subject: v.subject,
        body: v.body,
        talkingPoints: v.talkingPoints,
        reasoning: v.reasoning,
        variationIndex: v.variationIndex,
      })),
      usageMetrics: {
        provider: providerInfo.provider,
        modelVersion: result.modelVersion,
        promptVersion: result.promptVersion,
        tokensUsed: 0,
        costUsd: 0,
        generationTimeMs: result.generationTimeMs,
      },
      contactId: dto.contactId,
      channel: dto.channel,
      tone: dto.tone,
      createdAt: generated.createdAt,
    };
  }

  async regenerateIcebreaker(
    userId: string,
    generationId: string,
    dto: RegenerateIcebreakerDto,
  ): Promise<IcebreakerResponseDto> {
    this.logger.log(`Regenerating icebreaker ${generationId}`);

    // Get original generation
    const original = await this.prisma.generatedIcebreaker.findUnique({
      where: { id: generationId, userId },
    });

    if (!original) {
      throw new NotFoundException('Generation not found');
    }

    // Build new DTO with overrides
    const newDto: GenerateIcebreakerDto = {
      contactId: original.contactId,
      channel: original.channel as any,
      tone: (dto.tone || original.tone) as any,
      triggerEvent: dto.triggerEvent || original.triggerEvent || undefined,
      wordLimit: (original.contextData as any)?.wordLimit,
    };

    return this.generateIcebreaker(userId, newDto);
  }

  async editIcebreaker(
    userId: string,
    generationId: string,
    dto: EditIcebreakerDto,
  ): Promise<{ id: string; edited: boolean; editedContent: string }> {
    this.logger.log(`Editing icebreaker ${generationId}`);

    const updated = await this.prisma.generatedIcebreaker.update({
      where: { id: generationId, userId },
      data: {
        edited: true,
        editedContent: dto.editedContent,
      },
    });

    return {
      id: updated.id,
      edited: updated.edited,
      editedContent: updated.editedContent!,
    };
  }

  async selectVariation(
    userId: string,
    generationId: string,
    dto: SelectVariationDto,
  ): Promise<{ id: string; selected: MessageVariation }> {
    this.logger.log(`Selecting variation ${dto.variationIndex} for ${generationId}`);

    const generation = await this.prisma.generatedIcebreaker.findUnique({
      where: { id: generationId, userId },
    });

    if (!generation) {
      throw new NotFoundException('Generation not found');
    }

    const variations = generation.variations as any[];

    if (dto.variationIndex < 0 || dto.variationIndex >= variations.length) {
      throw new Error('Invalid variation index');
    }

    const selected = variations[dto.variationIndex];

    const updated = await this.prisma.generatedIcebreaker.update({
      where: { id: generationId, userId },
      data: {
        selected: selected,
      },
    });

    return {
      id: updated.id,
      selected: updated.selected as any,
    };
  }

  async submitFeedback(
    userId: string,
    generationId: string,
    dto: SubmitFeedbackDto,
  ): Promise<{ id: string; feedback: string }> {
    this.logger.log(`Submitting feedback for ${generationId}: ${dto.feedback}`);

    const updated = await this.prisma.generatedIcebreaker.update({
      where: { id: generationId, userId },
      data: {
        feedback: dto.feedback,
      },
    });

    return {
      id: updated.id,
      feedback: updated.feedback!,
    };
  }

  async getHistory(userId: string): Promise<IcebreakerHistoryDto[]> {
    const history = await this.prisma.generatedIcebreaker.findMany({
      where: { userId },
      include: {
        contact: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    });

    return history.map((h) => ({
      id: h.id,
      contactId: h.contactId,
      contactName: `${h.contact.firstName} ${h.contact.lastName || ''}`.trim(),
      channel: h.channel,
      tone: h.tone,
      sent: h.sent,
      feedback: h.feedback || undefined,
      createdAt: h.createdAt,
      sentAt: h.sentAt || undefined,
    }));
  }

  async selectTone(message: string, fromTone: Tone, toTone: Tone): Promise<string> {
    const result = await this.toneAdapter.adaptTone(message, fromTone, toTone);
    return result.adaptedMessage;
  }

  async formatForChannel(
    message: { subject?: string; body: string },
    channel: Channel,
  ): Promise<{ subject?: string; body: string }> {
    if (channel === 'email') {
      return message;
    }

    // For LinkedIn and WhatsApp, remove subject and potentially trim body
    const formatted: { subject?: string; body: string } = {
      body: message.body,
    };

    if (channel === 'linkedin' && formatted.body.length > 300) {
      formatted.body = formatted.body.substring(0, 297) + '...';
    }

    return formatted;
  }

  async generateVariations(context: GenerationContext): Promise<MessageVariation[]> {
    const aiService = this.aiServiceFactory.getService();
    const result = await aiService.generateIcebreaker(context);
    return result.variations;
  }

  async learnWritingStyle(userId: string) {
    return this.styleLearner.learnFromSentMessages(userId);
  }

  async findMutualConnections(userId: string, contactId: string): Promise<string[]> {
    // Find other contacts that work at the same companies
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId, userId },
      include: {
        employments: {
          include: {
            company: true,
          },
        },
      },
    });

    if (!contact) {
      return [];
    }

    // Find other contacts in same companies
    const companyIds = contact.employments.map((e) => e.companyId);

    if (companyIds.length === 0) {
      return [];
    }

    const mutualContacts = await this.prisma.contact.findMany({
      where: {
        userId,
        id: { not: contactId },
        employments: {
          some: {
            companyId: { in: companyIds },
          },
        },
      },
      select: {
        firstName: true,
        lastName: true,
      },
      take: 5,
    });

    if (!mutualContacts) {
      return [];
    }

    return mutualContacts.map((c) => `${c.firstName} ${c.lastName || ''}`.trim());
  }

  private async getContactWithContext(userId: string, contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        employments: {
          where: { isCurrent: true },
          include: {
            company: true,
          },
        },
        interactionParticipants: {
          include: {
            interaction: {
              select: {
                occurredAt: true,
                summary: true,
              },
            },
          },
          orderBy: {
            interaction: {
              occurredAt: 'desc',
            },
          },
          take: 1,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (contact.userId !== userId) {
      throw new UnauthorizedException('Unauthorized access to contact');
    }

    return contact;
  }

  private async getUserContext(userId: string): Promise<UserContext> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get writing style profile
    const writingStyleProfile = await this.styleLearner.getWritingStyleProfile(userId);

    // Build full name from available fields
    const userName =
      user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;

    return {
      userName,
      userTitle: undefined, // Could be added to user preferences in the future
      writingStyleProfile,
    };
  }

  private async buildContactContext(contact: any, triggerEvent?: string): Promise<ContactContext> {
    const currentEmployment = contact.employments[0];
    const lastInteraction = contact.interactionParticipants[0]?.interaction;

    // Find mutual connections
    const mutualConnections = await this.findMutualConnections(contact.userId, contact.id);

    return {
      contactName: `${contact.firstName} ${contact.lastName || ''}`.trim(),
      currentTitle: currentEmployment?.title || contact.enrichmentData?.currentTitle,
      currentCompany: currentEmployment?.company?.name || contact.enrichmentData?.currentCompany,
      relationshipSummary: this.buildRelationshipSummary(contact),
      lastInteractionDate: lastInteraction?.occurredAt,
      mutualConnections,
      triggerEvent,
    };
  }

  private buildRelationshipSummary(contact: any): string {
    const parts: string[] = [];

    if (contact.importance > 0) {
      const tier = contact.importance >= 80 ? 'High' : contact.importance >= 50 ? 'Medium' : 'Low';
      parts.push(`Importance: ${tier}`);
    }

    if (contact.lastContact) {
      const daysSince = Math.floor(
        (Date.now() - new Date(contact.lastContact).getTime()) / (1000 * 60 * 60 * 24),
      );
      parts.push(`Last contacted ${daysSince} days ago`);
    }

    const lastInteraction = contact.interactionParticipants[0]?.interaction;
    if (lastInteraction?.summary) {
      parts.push(`Last interaction: ${lastInteraction.summary}`);
    }

    return parts.join('. ') || 'No previous interaction history';
  }
}
