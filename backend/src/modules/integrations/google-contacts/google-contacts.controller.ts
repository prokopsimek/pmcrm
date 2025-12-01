import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { GoogleContactsService } from './google-contacts.service';
import {
  ImportContactsDto,
  ImportContactsResponseDto,
  SyncContactsResponseDto,
  OAuthInitiateResponseDto,
  OAuthCallbackResponseDto,
  DisconnectIntegrationResponseDto,
  IntegrationStatusResponseDto,
} from './dto/import-contacts.dto';
import { ImportPreviewResponseDto, ImportPreviewQueryDto } from './dto/import-preview.dto';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { SessionUser } from '@/shared/decorators/current-user.decorator';

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
  async initiateAuth(@CurrentUser() user: SessionUser): Promise<OAuthInitiateResponseDto> {
    return this.googleContactsService.initiateOAuthFlow(user.id);
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
    const redirectBase = `${frontendUrl}/settings/integrations`;

    try {
      // Validate query parameters
      if (!code || !state) {
        res.redirect(
          `${redirectBase}?error=missing_params&message=${encodeURIComponent('Missing required parameters')}`,
        );
        return;
      }

      if (code.trim() === '' || state.trim() === '') {
        res.redirect(
          `${redirectBase}?error=empty_params&message=${encodeURIComponent('Code and state cannot be empty')}`,
        );
        return;
      }

      // Process the OAuth callback
      const result = await this.googleContactsService.handleOAuthCallback(code, state);

      // Redirect to frontend with success
      res.redirect(`${redirectBase}?success=google&message=${encodeURIComponent(result.message)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.redirect(
        `${redirectBase}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
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
   * Import contacts from Google
   * POST /api/v1/integrations/google/contacts/import
   */
  @Post('contacts/import')
  @ApiOperation({ summary: 'Import contacts from Google Contacts' })
  @ApiResponse({
    status: 200,
    description: 'Contacts imported successfully',
    type: ImportContactsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid import configuration or no active integration',
  })
  async importContacts(
    @CurrentUser() user: SessionUser,
    @Body() importDto: ImportContactsDto,
  ): Promise<ImportContactsResponseDto> {
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

    return this.googleContactsService.importContacts(user.id, importDto);
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
