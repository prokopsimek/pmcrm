/**
 * LinkedIn Enrichment Service (US-013)
 * Main service for LinkedIn profile enrichment with caching and auto-matching
 *
 * Features:
 * - Manual enrichment by LinkedIn URL
 * - Auto-matching by email/name
 * - 30-day cache with manual refresh
 * - Cost tracking per enrichment
 * - Support for Proxycurl API
 */
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/shared/database/prisma.service';
import { ProxycurlClientService } from './proxycurl-client.service';
import { ProfileMatcherService } from './profile-matcher.service';
import {
  LinkedInEnrichmentResult,
  EnrichmentStatusDto,
  AutoMatchResultDto,
  EnrichmentCostDto,
} from '../dto/linkedin-enrichment.dto';

@Injectable()
export class LinkedInEnrichmentService {
  private readonly logger = new Logger(LinkedInEnrichmentService.name);
  private readonly LINKEDIN_URL_REGEX = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
  private readonly CACHE_TTL_DAYS = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly proxycurlClient: ProxycurlClientService,
    private readonly profileMatcher: ProfileMatcherService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================================
  // MAIN ENRICHMENT METHODS
  // ============================================================================

  /**
   * Enrich contact by LinkedIn URL
   * Checks cache first (30-day TTL), then calls API if needed
   */
  async enrichByLinkedInUrl(
    userId: string,
    contactId: string,
    linkedinUrl: string,
  ): Promise<LinkedInEnrichmentResult> {
    // Validate LinkedIn URL format
    if (!this.LINKEDIN_URL_REGEX.test(linkedinUrl)) {
      throw new BadRequestException('Invalid LinkedIn URL format');
    }

    // Find contact and verify ownership
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check cache validity
    if (contact.enrichedAt && this.isCacheValid(contact.enrichedAt)) {
      this.logger.log(`Cache hit for contact ${contactId}`);
      return {
        ...(contact.enrichmentData as any),
        source: 'cache',
        success: true,
      };
    }

    // Cache miss or expired - fetch from API
    try {
      const profileData = await this.proxycurlClient.fetchProfile(linkedinUrl);
      const enrichmentResult = this.transformProxycurlData(profileData);

      // Save to database
      await this.saveEnrichmentData(contactId, linkedinUrl, enrichmentResult, true);

      return {
        ...enrichmentResult,
        source: 'proxycurl',
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`Enrichment failed for ${contactId}: ${error.message}`);

      // Log failed enrichment
      await this.saveEnrichmentData(contactId, linkedinUrl, null, false, error.message);

      throw error;
    }
  }

  /**
   * Manual refresh - force re-fetch even if cache is valid
   */
  async manualRefresh(userId: string, contactId: string): Promise<LinkedInEnrichmentResult> {
    // Find contact
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (!contact.linkedinUrl) {
      throw new BadRequestException('Contact must have a LinkedIn URL set before refreshing');
    }

    // Force fetch from API (skip cache)
    try {
      const profileData = await this.proxycurlClient.fetchProfile(contact.linkedinUrl);
      const enrichmentResult = this.transformProxycurlData(profileData);

      await this.saveEnrichmentData(contactId, contact.linkedinUrl, enrichmentResult, true);

      this.logger.log(`Manual refresh completed for contact ${contactId}`);

      return {
        ...enrichmentResult,
        source: 'proxycurl',
        success: true,
      };
    } catch (error: any) {
      this.logger.error(`Manual refresh failed for ${contactId}: ${error.message}`);
      await this.saveEnrichmentData(contactId, contact.linkedinUrl, null, false, error.message);
      throw error;
    }
  }

  // ============================================================================
  // AUTO-MATCHING METHODS
  // ============================================================================

  /**
   * Auto-match LinkedIn profile by email
   */
  async autoMatchByEmail(email: string): Promise<AutoMatchResultDto | null> {
    try {
      const result = await this.proxycurlClient.searchByEmail(email);

      if (result) {
        return {
          linkedinUrl: result.linkedinUrl,
          matchScore: result.matchScore,
          matchMethod: 'email',
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Email auto-match failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Auto-match LinkedIn profile by name (with fuzzy matching)
   */
  async autoMatchByName(
    firstName: string,
    lastName: string,
    company?: string,
  ): Promise<AutoMatchResultDto | null> {
    try {
      const searchResults = await this.proxycurlClient.searchByName(firstName, lastName, company);

      if (searchResults.length === 0) {
        return null;
      }

      // Find best match using fuzzy matching
      let bestMatch: { url: string; score: number } | null = null;

      for (const result of searchResults) {
        const score = this.profileMatcher.fuzzyMatchByName(
          firstName,
          lastName,
          result.name,
          company,
          result.company,
        );

        if (score > (bestMatch?.score || 0)) {
          bestMatch = { url: result.linkedinUrl, score };
        }
      }

      // Only return if score > 0.85 (85% match)
      if (bestMatch && this.profileMatcher.isAcceptableMatch(bestMatch.score)) {
        return {
          linkedinUrl: bestMatch.url,
          matchScore: bestMatch.score,
          matchMethod: 'name',
        };
      }

      return null;
    } catch (error: any) {
      this.logger.error(`Name auto-match failed: ${error.message}`);
      return null;
    }
  }

  // ============================================================================
  // STATUS & TRACKING METHODS
  // ============================================================================

  /**
   * Get enrichment status for a contact
   */
  async getEnrichmentStatus(userId: string, contactId: string): Promise<EnrichmentStatusDto> {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const isEnriched = !!contact.enrichedAt;
    const cacheValid = contact.enrichedAt ? this.isCacheValid(contact.enrichedAt) : false;
    const daysUntilExpiry = contact.enrichedAt
      ? this.calculateDaysUntilExpiry(contact.enrichedAt)
      : 0;

    return {
      isEnriched,
      lastUpdate: contact.enrichedAt,
      provider: contact.enrichmentProvider,
      cacheValid,
      daysUntilExpiry,
    };
  }

  /**
   * Get enrichment costs for user
   */
  async getEnrichmentCosts(userId: string): Promise<EnrichmentCostDto> {
    const logs = await this.prisma.enrichmentLog.findMany({
      where: {
        contact: {
          userId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const totalCost = logs.reduce((sum, log) => sum + Number(log.cost), 0);
    const successfulEnrichments = logs.filter((log) => log.success).length;
    const failedEnrichments = logs.filter((log) => !log.success).length;

    // Current month cost
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const currentMonthCost = logs
      .filter((log) => log.createdAt >= startOfMonth)
      .reduce((sum, log) => sum + Number(log.cost), 0);

    const averageCostPerEnrichment =
      successfulEnrichments > 0 ? totalCost / successfulEnrichments : 0;

    // Breakdown by provider
    const byProvider: any = {};
    logs.forEach((log) => {
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = { count: 0, cost: 0 };
      }
      byProvider[log.provider].count++;
      byProvider[log.provider].cost += Number(log.cost);
    });

    return {
      totalCost: Number(totalCost.toFixed(2)),
      successfulEnrichments,
      failedEnrichments,
      currentMonthCost: Number(currentMonthCost.toFixed(2)),
      averageCostPerEnrichment: Number(averageCostPerEnrichment.toFixed(4)),
      byProvider,
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Check if enrichment cache is valid (within 30 days)
   */
  isCacheValid(lastUpdate: Date): boolean {
    const expiryDate = new Date(lastUpdate);
    expiryDate.setDate(expiryDate.getDate() + this.CACHE_TTL_DAYS);

    return new Date() < expiryDate;
  }

  /**
   * Calculate days until cache expiry (negative if expired)
   */
  private calculateDaysUntilExpiry(lastUpdate: Date): number {
    const expiryDate = new Date(lastUpdate);
    expiryDate.setDate(expiryDate.getDate() + this.CACHE_TTL_DAYS);

    const diffMs = expiryDate.getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * Transform Proxycurl API data to our enrichment result format
   */
  private transformProxycurlData(data: any): LinkedInEnrichmentResult {
    // Extract current position (first position without end date)
    const currentPosition = data.experiences?.find((exp: any) => !exp.ends_at);

    // Limit to last 5 positions
    const positions = (data.experiences || []).slice(0, 5).map((exp: any) => ({
      company: exp.company,
      title: exp.title,
      description: exp.description,
      startDate: exp.starts_at
        ? `${exp.starts_at.year}-${String(exp.starts_at.month).padStart(2, '0')}`
        : undefined,
      endDate: exp.ends_at
        ? `${exp.ends_at.year}-${String(exp.ends_at.month).padStart(2, '0')}`
        : undefined,
      isCurrent: !exp.ends_at,
    }));

    // Education history
    const education = (data.education || []).map((edu: any) => ({
      school: edu.school,
      degree: edu.degree_name,
      fieldOfStudy: edu.field_of_study,
      startDate: edu.starts_at
        ? `${edu.starts_at.year}-${String(edu.starts_at.month).padStart(2, '0')}`
        : undefined,
      endDate: edu.ends_at
        ? `${edu.ends_at.year}-${String(edu.ends_at.month).padStart(2, '0')}`
        : undefined,
    }));

    // Top 5 skills
    const skills = (data.skills || []).slice(0, 5);

    return {
      firstName: data.first_name,
      lastName: data.last_name,
      headline: data.headline,
      summary: data.summary,
      location:
        data.city && data.country_full_name
          ? `${data.city}, ${data.country_full_name}`
          : data.country_full_name || data.city,
      photoUrl: data.profile_pic_url,
      currentPosition: currentPosition
        ? {
            company: currentPosition.company,
            title: currentPosition.title,
            startDate: currentPosition.starts_at
              ? `${currentPosition.starts_at.year}-${String(currentPosition.starts_at.month).padStart(2, '0')}`
              : undefined,
            isCurrent: true,
          }
        : undefined,
      positions,
      skills,
      education,
      success: true,
      source: 'proxycurl',
    };
  }

  /**
   * Save enrichment data to database
   */
  private async saveEnrichmentData(
    contactId: string,
    linkedinUrl: string,
    enrichmentData: any,
    success: boolean,
    errorMessage?: string,
  ): Promise<void> {
    const cost = this.proxycurlClient.getCostEstimate();

    await this.prisma.$transaction(async (tx) => {
      // Update contact
      await tx.contact.update({
        where: { id: contactId },
        data: {
          enrichmentData: enrichmentData || undefined,
          enrichedAt: success ? new Date() : undefined,
          enrichmentProvider: 'proxycurl',
          linkedinUrl,
        },
      });

      // Create enrichment log
      await tx.enrichmentLog.create({
        data: {
          contactId,
          provider: 'proxycurl',
          cost,
          success,
          errorMessage,
          metadata: {
            linkedinUrl,
            timestamp: new Date().toISOString(),
          },
        },
      });
    });

    this.logger.log(
      `Enrichment ${success ? 'succeeded' : 'failed'} for contact ${contactId} (cost: $${cost})`,
    );
  }
}
