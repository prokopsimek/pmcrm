/**
 * LinkedIn Enrichment Controller (US-013)
 * API endpoints for LinkedIn profile enrichment
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  UseGuards,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LinkedInEnrichmentService } from './services/linkedin-enrichment.service';
import { PrismaService } from '@/shared/database/prisma.service';
import {
  LinkedInEnrichmentDto,
  LinkedInEnrichmentResult,
  EnrichmentStatusDto,
  EnrichmentCostDto,
} from './dto/linkedin-enrichment.dto';

/**
 * LinkedIn Enrichment Controller
 * Handles manual enrichment, auto-matching, status tracking, and cost monitoring
 */
@ApiTags('LinkedIn Enrichment')
@ApiBearerAuth()
@Controller('contacts')
export class LinkedInEnrichmentController {
  constructor(
    private readonly linkedInService: LinkedInEnrichmentService,
    private readonly prisma: PrismaService,
  ) {}

  // ============================================================================
  // POST /api/v1/contacts/:id/enrich/linkedin - Manual enrichment
  // ============================================================================

  @Post(':id/enrich/linkedin')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({ summary: 'Enrich contact with LinkedIn profile data' })
  @ApiResponse({
    status: 200,
    description: 'Contact enriched successfully',
    type: LinkedInEnrichmentResult,
  })
  @ApiResponse({ status: 400, description: 'Invalid LinkedIn URL' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async enrichFromLinkedIn(
    @Request() req: any,
    @Param('id') contactId: string,
    @Body() enrichDto: LinkedInEnrichmentDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Validate LinkedIn URL
    if (!enrichDto.linkedinUrl || !this.isValidLinkedInUrl(enrichDto.linkedinUrl)) {
      throw new BadRequestException('Invalid LinkedIn URL format');
    }

    const result = await this.linkedInService.enrichByLinkedInUrl(
      req.user.id,
      contactId,
      enrichDto.linkedinUrl,
    );

    return {
      success: true,
      data: result,
      message: 'Contact enriched successfully',
    };
  }

  // ============================================================================
  // POST /api/v1/contacts/:id/enrich/linkedin/auto - Auto-match enrichment
  // ============================================================================

  @Post(':id/enrich/linkedin/auto')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute (more expensive)
  @ApiOperation({ summary: 'Auto-match and enrich contact using email or name' })
  @ApiResponse({ status: 200, description: 'Contact auto-matched and enriched' })
  @ApiResponse({ status: 404, description: 'No matching LinkedIn profile found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async autoEnrichContact(@Request() req: any, @Param('id') contactId: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Get contact data
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId: req.user.id,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Try email match first
    let matchResult = null;
    if (contact.email) {
      matchResult = await this.linkedInService.autoMatchByEmail(contact.email);
    }

    // Fall back to name match if email fails
    if (!matchResult && contact.firstName) {
      matchResult = await this.linkedInService.autoMatchByName(
        contact.firstName,
        contact.lastName || '',
        contact.company || undefined,
      );
    }

    if (!matchResult || !matchResult.linkedinUrl) {
      throw new NotFoundException('No matching LinkedIn profile found');
    }

    // Enrich contact with matched LinkedIn URL
    const enrichmentResult = await this.linkedInService.enrichByLinkedInUrl(
      req.user.id,
      contactId,
      matchResult.linkedinUrl,
    );

    return {
      success: true,
      data: {
        ...enrichmentResult,
        matchScore: matchResult.matchScore,
        matchMethod: matchResult.matchMethod,
      },
      message: `Contact auto-matched via ${matchResult.matchMethod} (${(matchResult.matchScore * 100).toFixed(0)}% confidence)`,
    };
  }

  // ============================================================================
  // GET /api/v1/contacts/:id/enrichment/status - Get enrichment status
  // ============================================================================

  @Get(':id/enrichment/status')
  @ApiOperation({ summary: 'Get enrichment status and cache validity' })
  @ApiResponse({
    status: 200,
    description: 'Enrichment status retrieved',
    type: EnrichmentStatusDto,
  })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEnrichmentStatus(@Request() req: any, @Param('id') contactId: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const status = await this.linkedInService.getEnrichmentStatus(req.user.id, contactId);

    return status;
  }

  // ============================================================================
  // POST /api/v1/contacts/:id/enrichment/refresh - Force refresh
  // ============================================================================

  @Post(':id/enrichment/refresh')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute (expensive)
  @ApiOperation({ summary: 'Force refresh enrichment data (bypasses cache)' })
  @ApiResponse({ status: 200, description: 'Enrichment refreshed successfully' })
  @ApiResponse({ status: 400, description: 'LinkedIn URL not set' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async refreshEnrichment(@Request() req: any, @Param('id') contactId: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const result = await this.linkedInService.manualRefresh(req.user.id, contactId);

    return {
      success: true,
      data: result,
      message: 'Enrichment data refreshed successfully',
    };
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Validate LinkedIn URL format
   */
  private isValidLinkedInUrl(url: string): boolean {
    const regex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i;
    return regex.test(url);
  }
}

/**
 * Enrichment Credits Controller
 * Separate controller for cost tracking and credit management
 */
@ApiTags('LinkedIn Enrichment')
@ApiBearerAuth()
@Controller('enrichment')
export class EnrichmentCreditsController {
  constructor(private readonly linkedInService: LinkedInEnrichmentService) {}

  // ============================================================================
  // GET /api/v1/enrichment/credits - Get API credit usage
  // ============================================================================

  @Get('credits')
  @ApiOperation({ summary: 'Get enrichment cost summary and credit usage' })
  @ApiResponse({ status: 200, description: 'Cost summary retrieved', type: EnrichmentCostDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getEnrichmentCredits(@Request() req: any) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    const costs = await this.linkedInService.getEnrichmentCosts(req.user.id);

    return costs;
  }
}
