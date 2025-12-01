/**
 * Contact Summary Service
 * Manages AI-generated summaries and recommendations with caching
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { GeminiService, AIRecommendation, TimelineSummary } from './gemini.service';
import { AISummaryType } from '@prisma/client';

export interface ContactSummaryResult {
  id: string;
  summaryType: AISummaryType;
  content: string;
  recommendations?: AIRecommendation[];
  generatedAt: Date;
  emailsIncluded: number;
  lastEmailDate: Date | null;
  isCached: boolean;
}

@Injectable()
export class ContactSummaryService {
  private readonly logger = new Logger(ContactSummaryService.name);
  private readonly CACHE_DURATION_HOURS = 24; // Summary valid for 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Get or generate timeline summary for a contact
   */
  async getTimelineSummary(
    userId: string,
    contactId: string,
    forceRegenerate = false,
  ): Promise<ContactSummaryResult> {
    // Verify contact belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check for cached summary
    if (!forceRegenerate) {
      const cached = await this.prisma.contactAISummary.findUnique({
        where: {
          contactId_summaryType: {
            contactId,
            summaryType: 'TIMELINE',
          },
        },
      });

      if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
        return {
          id: cached.id,
          summaryType: cached.summaryType,
          content: cached.content,
          recommendations: cached.recommendations as AIRecommendation[] | undefined,
          generatedAt: cached.generatedAt,
          emailsIncluded: cached.emailsIncluded,
          lastEmailDate: cached.lastEmailDate,
          isCached: true,
        };
      }
    }

    // Fetch emails for this contact
    const emails = await this.prisma.emailThread.findMany({
      where: { contactId },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    });

    if (emails.length === 0) {
      // No emails - return empty summary
      const emptySummary = await this.prisma.contactAISummary.upsert({
        where: {
          contactId_summaryType: {
            contactId,
            summaryType: 'TIMELINE',
          },
        },
        create: {
          contactId,
          summaryType: 'TIMELINE',
          content: 'No email communication history available yet.',
          emailsIncluded: 0,
          expiresAt: new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000),
        },
        update: {
          content: 'No email communication history available yet.',
          emailsIncluded: 0,
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000),
        },
      });

      return {
        id: emptySummary.id,
        summaryType: emptySummary.summaryType,
        content: emptySummary.content,
        generatedAt: emptySummary.generatedAt,
        emailsIncluded: 0,
        lastEmailDate: null,
        isCached: false,
      };
    }

    // Generate new summary using AI
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

    const summary = await this.geminiService.generateTimelineSummary(
      contactName,
      emails.map((e) => ({
        subject: e.subject || '(no subject)',
        snippet: e.snippet || '',
        direction: e.direction === 'INBOUND' ? 'inbound' : 'outbound',
        date: e.occurredAt,
      })),
    );

    // Store in cache
    const stored = await this.prisma.contactAISummary.upsert({
      where: {
        contactId_summaryType: {
          contactId,
          summaryType: 'TIMELINE',
        },
      },
      create: {
        contactId,
        summaryType: 'TIMELINE',
        content: JSON.stringify(summary),
        emailsIncluded: emails.length,
        lastEmailDate: emails[0]?.occurredAt || null,
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000),
        metadata: { model: 'gemini-2.5-flash' },
      },
      update: {
        content: JSON.stringify(summary),
        emailsIncluded: emails.length,
        lastEmailDate: emails[0]?.occurredAt || null,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000),
        metadata: { model: 'gemini-2.5-flash' },
      },
    });

    return {
      id: stored.id,
      summaryType: stored.summaryType,
      content: stored.content,
      generatedAt: stored.generatedAt,
      emailsIncluded: emails.length,
      lastEmailDate: emails[0]?.occurredAt || null,
      isCached: false,
    };
  }

  /**
   * Get or generate recommendations for a contact
   */
  async getRecommendations(
    userId: string,
    contactId: string,
    forceRegenerate = false,
  ): Promise<ContactSummaryResult> {
    // Verify contact belongs to user
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, userId, deletedAt: null },
      include: {
        reminders: {
          where: { completedAt: null },
          orderBy: { scheduledFor: 'asc' },
          take: 10,
        },
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check for cached recommendations
    if (!forceRegenerate) {
      const cached = await this.prisma.contactAISummary.findUnique({
        where: {
          contactId_summaryType: {
            contactId,
            summaryType: 'RECOMMENDATIONS',
          },
        },
      });

      if (cached && (!cached.expiresAt || cached.expiresAt > new Date())) {
        return {
          id: cached.id,
          summaryType: cached.summaryType,
          content: cached.content,
          recommendations: cached.recommendations as AIRecommendation[] | undefined,
          generatedAt: cached.generatedAt,
          emailsIncluded: cached.emailsIncluded,
          lastEmailDate: cached.lastEmailDate,
          isCached: true,
        };
      }
    }

    // Fetch emails for this contact
    const emails = await this.prisma.emailThread.findMany({
      where: { contactId },
      orderBy: { occurredAt: 'desc' },
      take: 30,
    });

    // Generate recommendations using AI
    const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ');

    const recommendations = await this.geminiService.generateRecommendations(
      contactName,
      {
        company: contact.company || undefined,
        position: contact.position || undefined,
        lastContactDate: contact.lastContact || undefined,
        tags: contact.tags,
      },
      emails.map((e) => ({
        subject: e.subject || '(no subject)',
        snippet: e.snippet || '',
        direction: e.direction === 'INBOUND' ? 'inbound' : 'outbound',
        date: e.occurredAt,
      })),
      contact.reminders.map((r) => ({
        title: r.title,
        scheduledFor: r.scheduledFor,
      })),
    );

    // Store in cache
    const stored = await this.prisma.contactAISummary.upsert({
      where: {
        contactId_summaryType: {
          contactId,
          summaryType: 'RECOMMENDATIONS',
        },
      },
      create: {
        contactId,
        summaryType: 'RECOMMENDATIONS',
        content: `${recommendations.length} recommendations generated`,
        recommendations: JSON.parse(JSON.stringify(recommendations)),
        emailsIncluded: emails.length,
        lastEmailDate: emails[0]?.occurredAt || null,
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000),
        metadata: { model: 'gemini-2.5-flash' },
      },
      update: {
        content: `${recommendations.length} recommendations generated`,
        recommendations: JSON.parse(JSON.stringify(recommendations)),
        emailsIncluded: emails.length,
        lastEmailDate: emails[0]?.occurredAt || null,
        generatedAt: new Date(),
        expiresAt: new Date(Date.now() + this.CACHE_DURATION_HOURS * 60 * 60 * 1000),
        metadata: { model: 'gemini-2.5-flash' },
      },
    });

    return {
      id: stored.id,
      summaryType: stored.summaryType,
      content: stored.content,
      recommendations,
      generatedAt: stored.generatedAt,
      emailsIncluded: emails.length,
      lastEmailDate: emails[0]?.occurredAt || null,
      isCached: false,
    };
  }

  /**
   * Check if summary needs regeneration (used by background job)
   */
  async getSummariesToRegenerate(): Promise<
    Array<{ contactId: string; summaryType: AISummaryType }>
  > {
    const expiredSummaries = await this.prisma.contactAISummary.findMany({
      where: {
        OR: [{ expiresAt: { lte: new Date() } }, { expiresAt: null }],
      },
      select: {
        contactId: true,
        summaryType: true,
      },
    });

    return expiredSummaries;
  }

  /**
   * Get contacts with new email activity since last summary
   */
  async getContactsWithNewActivity(): Promise<string[]> {
    const contacts = await this.prisma.$queryRaw<Array<{ contactId: string }>>`
      SELECT DISTINCT et."contactId"
      FROM email_threads et
      LEFT JOIN contact_ai_summaries cas
        ON et."contactId" = cas."contactId"
        AND cas."summaryType" = 'TIMELINE'
      WHERE et."occurredAt" > COALESCE(cas."lastEmailDate", '1970-01-01'::timestamp)
    `;

    return contacts.map((c) => c.contactId);
  }
}
