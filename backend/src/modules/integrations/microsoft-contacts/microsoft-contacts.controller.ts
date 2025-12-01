import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { MicrosoftContactsService } from './microsoft-contacts.service';
import {
  ImportContactsDto,
  ImportContactsResponseDto,
  SyncContactsResponseDto,
  OAuthInitiateResponseDto,
  OAuthCallbackResponseDto,
  DisconnectIntegrationResponseDto,
  IntegrationStatusResponseDto,
  BidirectionalSyncResponseDto,
  SharedFoldersResponseDto,
  ConflictResolutionDto,
  ConflictResolutionResponseDto,
} from './dto/import-contacts.dto';
import { ImportPreviewResponseDto, ImportPreviewQueryDto } from './dto/import-preview.dto';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { SessionUser } from '@/shared/decorators/current-user.decorator';

/**
 * Microsoft 365 Contacts Integration Controller
 * Handles OAuth flow, contact import, bidirectional sync, and conflict resolution
 */
@ApiTags('Integrations - Microsoft 365 Contacts')
@Controller('integrations/microsoft')
export class MicrosoftContactsController {
  constructor(
    private readonly microsoftContactsService: MicrosoftContactsService,
    private readonly configService: ConfigService,
  ) {}

  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Initiate OAuth flow for Microsoft 365
   * GET /api/v1/integrations/microsoft/auth
   */
  @Get('auth')
  @ApiOperation({ summary: 'Initiate Microsoft 365 OAuth flow' })
  @ApiResponse({
    status: 200,
    description: 'OAuth authorization URL generated',
    type: OAuthInitiateResponseDto,
  })
  async initiateAuth(@CurrentUser() user: SessionUser): Promise<OAuthInitiateResponseDto> {
    return this.microsoftContactsService.initiateOAuthFlow(user.id);
  }

  /**
   * Handle OAuth callback from Microsoft
   * GET /api/v1/integrations/microsoft/callback
   */
  @Get('callback')
  @AllowAnonymous()
  @ApiOperation({ summary: 'Handle Microsoft 365 OAuth callback' })
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

      // Process the OAuth callback - state contains userId
      const result = await this.microsoftContactsService.handleOAuthCallback(code, state);

      // Redirect to frontend with success
      res.redirect(
        `${redirectBase}?success=microsoft&message=${encodeURIComponent(result.message)}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.redirect(
        `${redirectBase}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  /**
   * Get contact folders (including shared address books)
   * GET /api/v1/integrations/microsoft/contacts/folders
   */
  @Get('contacts/folders')
  @ApiOperation({ summary: 'Get contact folders including shared address books' })
  @ApiResponse({
    status: 200,
    description: 'Contact folders retrieved',
    type: SharedFoldersResponseDto,
  })
  async getContactFolders(@CurrentUser() user: SessionUser): Promise<SharedFoldersResponseDto> {
    return this.microsoftContactsService.getContactFolders(user.id);
  }

  /**
   * Get import preview with deduplication analysis
   * GET /api/v1/integrations/microsoft/contacts/preview
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
    description: 'No active Microsoft 365 integration',
  })
  async getImportPreview(
    @CurrentUser() user: SessionUser,
    @Query() query?: ImportPreviewQueryDto,
  ): Promise<ImportPreviewResponseDto> {
    return query
      ? this.microsoftContactsService.previewImport(user.id, query)
      : this.microsoftContactsService.previewImport(user.id);
  }

  /**
   * Import contacts from Microsoft 365
   * POST /api/v1/integrations/microsoft/contacts/import
   */
  @Post('contacts/import')
  @ApiOperation({ summary: 'Import contacts from Microsoft 365' })
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

    if (importDto.categoryMapping && typeof importDto.categoryMapping !== 'object') {
      throw new BadRequestException('categoryMapping must be an object');
    }

    if (importDto.selectedContactIds && !Array.isArray(importDto.selectedContactIds)) {
      throw new BadRequestException('selectedContactIds must be an array');
    }

    if (importDto.excludeCategories && !Array.isArray(importDto.excludeCategories)) {
      throw new BadRequestException('excludeCategories must be an array');
    }

    return this.microsoftContactsService.importContacts(user.id, importDto);
  }

  /**
   * Sync incremental changes from Microsoft 365
   * POST /api/v1/integrations/microsoft/contacts/sync
   */
  @Post('contacts/sync')
  @ApiOperation({ summary: 'Sync incremental changes from Microsoft 365' })
  @ApiResponse({
    status: 200,
    description: 'Contacts synced successfully',
    type: SyncContactsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No active Microsoft 365 integration',
  })
  @ApiResponse({
    status: 401,
    description: 'Token expired or invalid',
  })
  async syncContacts(@CurrentUser() user: SessionUser): Promise<SyncContactsResponseDto> {
    return this.microsoftContactsService.syncIncrementalChanges(user.id);
  }

  /**
   * Push contact to Microsoft 365 (bidirectional sync)
   * PUT /api/v1/integrations/microsoft/contacts/:id/push
   */
  @Put('contacts/:id/push')
  @ApiOperation({ summary: 'Push contact to Microsoft 365 (bidirectional sync)' })
  @ApiResponse({
    status: 200,
    description: 'Contact pushed to Microsoft 365',
    type: BidirectionalSyncResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Contact not found',
  })
  async pushContact(
    @CurrentUser() user: SessionUser,
    @Param('id') contactId: string,
  ): Promise<BidirectionalSyncResponseDto> {
    return this.microsoftContactsService.pushContactToMicrosoft(user.id, contactId);
  }

  /**
   * Resolve conflicts using specified strategy
   * POST /api/v1/integrations/microsoft/contacts/conflicts/resolve
   */
  @Post('contacts/conflicts/resolve')
  @ApiOperation({ summary: 'Resolve contact conflicts' })
  @ApiResponse({
    status: 200,
    description: 'Conflicts resolved',
    type: ConflictResolutionResponseDto,
  })
  async resolveConflicts(
    @CurrentUser() user: SessionUser,
    @Body() dto: ConflictResolutionDto,
  ): Promise<ConflictResolutionResponseDto> {
    return this.microsoftContactsService.resolveConflicts(user.id, dto);
  }

  /**
   * Disconnect Microsoft 365 integration
   * DELETE /api/v1/integrations/microsoft/disconnect
   */
  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect Microsoft 365 integration' })
  @ApiResponse({
    status: 200,
    description: 'Integration disconnected successfully',
    type: DisconnectIntegrationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'No Microsoft 365 integration found',
  })
  async disconnectIntegration(
    @CurrentUser() user: SessionUser,
  ): Promise<DisconnectIntegrationResponseDto> {
    return this.microsoftContactsService.disconnectIntegration(user.id);
  }

  /**
   * Get Microsoft 365 integration status
   * GET /api/v1/integrations/microsoft/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get Microsoft 365 integration status' })
  @ApiResponse({
    status: 200,
    description: 'Integration status retrieved',
    type: IntegrationStatusResponseDto,
  })
  async getStatus(@CurrentUser() user: SessionUser): Promise<IntegrationStatusResponseDto> {
    return this.microsoftContactsService.getIntegrationStatus(user.id);
  }
}
