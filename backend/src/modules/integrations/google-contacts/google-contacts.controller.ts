import { QueueName } from '@/shared/config/bull.config';
import { PrismaService } from '@/shared/database/prisma.service';
import type { SessionUser } from '@/shared/decorators/current-user.decorator';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { InjectQueue } from '@nestjs/bull';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Queue } from 'bull';
import type { Response } from 'express';
import {
  DisconnectIntegrationResponseDto,
  ImportContactsDto,
  IntegrationStatusResponseDto,
  OAuthInitiateResponseDto,
  SyncContactsResponseDto,
} from './dto/import-contacts.dto';
import { ImportJobResponseDto, ImportJobStatusDto } from './dto/import-job.dto';
import { ImportPreviewQueryDto, ImportPreviewResponseDto } from './dto/import-preview.dto';
import { GoogleContactsService } from './google-contacts.service';

/**
 * Google Contacts Integration Controller
 * Handles OAuth flow, contact import, and sync operations
 */
@ApiTags('Integrations - Google Contacts')
@Controller('integrations/google')
export class GoogleContactsController {
  constructor(
    private readonly googleContactsService: GoogleContactsService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue(QueueName.INTEGRATION_SYNC)
    private readonly integrationSyncQueue: Queue,
  ) {}

  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Initiate OAuth flow for Google Contacts
   * GET /api/v1/integrations/google/auth
   */
  @Get('auth')
  @ApiOperation({ summary: 'Initiate Google OAuth flow' })
  @ApiResponse({
    status: 200,
    description: 'OAuth authorization URL generated',
    type: OAuthInitiateResponseDto,
  })
  async initiateAuth(
    @CurrentUser() user: SessionUser,
    @Query('orgSlug') orgSlug?: string,
  ): Promise<OAuthInitiateResponseDto> {
    return this.googleContactsService.initiateOAuthFlow(user.id, orgSlug);
  }

  /**
   * Handle OAuth callback from Google
   * GET /api/v1/integrations/google/callback
   *
   * Note: This endpoint is marked as @AllowAnonymous because it's called
   * by Google during the OAuth flow, not directly by the authenticated user.
   * The user ID is extracted from the state parameter which was set during
   * the OAuth initiation.
   */
  @Get('callback')
  @AllowAnonymous()
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with success/error status',
  })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.getFrontendUrl();

    // Helper to build redirect URL with optional orgSlug
    const buildRedirectUrl = (orgSlug?: string) => {
      const basePath = orgSlug ? `/${orgSlug}/settings/integrations` : '/settings/integrations';
      return `${frontendUrl}${basePath}`;
    };

    try {
      // Validate query parameters
      if (!code || !state) {
        res.redirect(
          `${buildRedirectUrl()}?error=missing_params&message=${encodeURIComponent('Missing required parameters')}`,
        );
        return;
      }

      if (code.trim() === '' || state.trim() === '') {
        res.redirect(
          `${buildRedirectUrl()}?error=empty_params&message=${encodeURIComponent('Code and state cannot be empty')}`,
        );
        return;
      }

      // Process the OAuth callback
      const result = await this.googleContactsService.handleOAuthCallback(code, state);
      const redirectUrl = buildRedirectUrl(result.orgSlug);

      // Redirect to frontend with success
      res.redirect(`${redirectUrl}?success=google&message=${encodeURIComponent(result.message)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.redirect(
        `${buildRedirectUrl()}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  /**
   * Get import preview with deduplication analysis
   * GET /api/v1/integrations/google/contacts/preview
   */
  @Get('contacts/preview')
  @ApiOperation({ summary: 'Preview contacts import with deduplication' })
  @ApiResponse({
    status: 200,
    description: 'Import preview generated',
    type: ImportPreviewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No active Google Contacts integration',
  })
  async getImportPreview(
    @CurrentUser() user: SessionUser,
    @Query() query?: ImportPreviewQueryDto,
  ): Promise<ImportPreviewResponseDto> {
    return query
      ? this.googleContactsService.previewImport(user.id, query)
      : this.googleContactsService.previewImport(user.id);
  }

  /**
   * Import contacts from Google (queues background job)
   * POST /api/v1/integrations/google/contacts/import
   *
   * Returns immediately with a job ID. Use GET /contacts/import/:jobId to poll status.
   */
  @Post('contacts/import')
  @ApiOperation({ summary: 'Start background import of contacts from Google Contacts' })
  @ApiResponse({
    status: 200,
    description: 'Import job queued successfully',
    type: ImportJobResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid import configuration or no active integration',
  })
  async importContacts(
    @CurrentUser() user: SessionUser,
    @Body() importDto: ImportContactsDto,
  ): Promise<ImportJobResponseDto> {
    // Validate DTO
    if (typeof importDto.skipDuplicates !== 'boolean') {
      throw new BadRequestException('skipDuplicates must be a boolean');
    }

    if (typeof importDto.updateExisting !== 'boolean') {
      throw new BadRequestException('updateExisting must be a boolean');
    }

    if (importDto.tagMapping && typeof importDto.tagMapping !== 'object') {
      throw new BadRequestException('tagMapping must be an object');
    }

    if (importDto.selectedContactIds && !Array.isArray(importDto.selectedContactIds)) {
      throw new BadRequestException('selectedContactIds must be an array');
    }

    // Queue import job via service
    return this.googleContactsService.queueImportJob(user.id, importDto, this.integrationSyncQueue);
  }

  /**
   * Get import job status
   * GET /api/v1/integrations/google/contacts/import/:jobId
   */
  @Get('contacts/import/:jobId')
  @ApiOperation({ summary: 'Get status of an import job' })
  @ApiParam({ name: 'jobId', description: 'Import job ID' })
  @ApiResponse({
    status: 200,
    description: 'Import job status retrieved',
    type: ImportJobStatusDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Import job not found',
  })
  async getImportJobStatus(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
  ): Promise<ImportJobStatusDto> {
    const importJob = await this.prisma.importJob.findFirst({
      where: {
        id: jobId,
        userId: user.id,
      },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    // Calculate progress percentage
    const progress =
      importJob.totalCount > 0
        ? Math.round((importJob.processedCount / importJob.totalCount) * 100)
        : 0;

    return {
      jobId: importJob.id,
      status: importJob.status as 'queued' | 'processing' | 'completed' | 'failed',
      totalCount: importJob.totalCount,
      processedCount: importJob.processedCount,
      importedCount: importJob.importedCount,
      skippedCount: importJob.skippedCount,
      failedCount: importJob.failedCount,
      progress,
      errors: importJob.errors as Array<{ contactId: string; error: string }>,
      startedAt: importJob.startedAt ?? undefined,
      completedAt: importJob.completedAt ?? undefined,
      createdAt: importJob.createdAt,
    };
  }

  /**
   * Sync incremental changes from Google Contacts
   * POST /api/v1/integrations/google/contacts/sync
   */
  @Post('contacts/sync')
  @ApiOperation({ summary: 'Sync incremental changes from Google Contacts' })
  @ApiResponse({
    status: 200,
    description: 'Contacts synced successfully',
    type: SyncContactsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No active Google Contacts integration',
  })
  @ApiResponse({
    status: 401,
    description: 'Token expired or invalid',
  })
  async syncContacts(@CurrentUser() user: SessionUser): Promise<SyncContactsResponseDto> {
    return this.googleContactsService.syncIncrementalChanges(user.id);
  }

  /**
   * Disconnect Google Contacts integration
   * DELETE /api/v1/integrations/google/disconnect
   */
  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect Google Contacts integration' })
  @ApiResponse({
    status: 200,
    description: 'Integration disconnected successfully',
    type: DisconnectIntegrationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No Google Contacts integration found',
  })
  async disconnectIntegration(
    @CurrentUser() user: SessionUser,
  ): Promise<DisconnectIntegrationResponseDto> {
    return this.googleContactsService.disconnectIntegration(user.id);
  }

  /**
   * Get Google Contacts integration status
   * GET /api/v1/integrations/google/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get Google Contacts integration status' })
  @ApiResponse({
    status: 200,
    description: 'Integration status retrieved',
    type: IntegrationStatusResponseDto,
  })
  async getStatus(@CurrentUser() user: SessionUser): Promise<IntegrationStatusResponseDto> {
    return this.googleContactsService.getIntegrationStatus(user.id);
  }
}
