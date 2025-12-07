import type { SessionUser } from '@/shared/decorators/current-user.decorator';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import {
    GmailConfigResponseDto,
    GmailDisconnectResponseDto,
    GmailOAuthInitiateResponseDto,
    GmailStatusResponseDto,
    GmailSyncJobResponseDto,
    GmailSyncJobStatusDto,
    QueueGmailSyncDto,
    UpdateGmailConfigDto,
} from './dto';
import { GmailService } from './gmail.service';

/**
 * Gmail Integration Controller
 * Handles OAuth flow, email sync configuration, and sync operations
 */
@ApiTags('Integrations - Gmail')
@Controller('integrations/gmail')
@ApiBearerAuth()
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly configService: ConfigService,
  ) {}

  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Initiate OAuth flow for Gmail
   * GET /api/v1/integrations/gmail/auth
   */
  @Get('auth')
  @ApiOperation({ summary: 'Initiate Gmail OAuth flow' })
  @ApiResponse({
    status: 200,
    description: 'OAuth authorization URL generated',
    type: GmailOAuthInitiateResponseDto,
  })
  async initiateAuth(
    @CurrentUser() user: SessionUser,
    @Query('orgSlug') orgSlug?: string,
  ): Promise<GmailOAuthInitiateResponseDto> {
    return this.gmailService.initiateOAuthFlow(user.id, orgSlug);
  }

  /**
   * Handle OAuth callback from Google
   * GET /api/v1/integrations/gmail/callback
   *
   * Note: This endpoint is marked as @AllowAnonymous because it's called
   * by Google during the OAuth flow, not directly by the authenticated user.
   * The user ID is extracted from the state parameter.
   */
  @Get('callback')
  @AllowAnonymous()
  @ApiOperation({ summary: 'Handle Gmail OAuth callback' })
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

    // Helper function to build redirect URL with optional orgSlug
    const buildRedirectUrl = (orgSlug?: string) => {
      if (orgSlug) {
        return `${frontendUrl}/${orgSlug}/settings/integrations`;
      }
      // Fallback to base settings page (will be handled by frontend middleware)
      return `${frontendUrl}/settings/integrations`;
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
      const result = await this.gmailService.handleOAuthCallback(code, state);
      const redirectUrl = buildRedirectUrl(result.orgSlug);

      // Redirect to frontend with success
      res.redirect(`${redirectUrl}?success=gmail&message=${encodeURIComponent(result.message)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.redirect(
        `${buildRedirectUrl()}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  /**
   * Get Gmail integration status
   * GET /api/v1/integrations/gmail/status
   */
  @Get('status')
  @ApiOperation({ summary: 'Get Gmail integration status' })
  @ApiResponse({
    status: 200,
    description: 'Integration status retrieved',
    type: GmailStatusResponseDto,
  })
  async getStatus(@CurrentUser() user: SessionUser): Promise<GmailStatusResponseDto> {
    return this.gmailService.getStatus(user.id);
  }

  /**
   * Get Gmail sync configuration
   * GET /api/v1/integrations/gmail/config
   */
  @Get('config')
  @ApiOperation({ summary: 'Get Gmail sync configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved',
    type: GmailConfigResponseDto,
  })
  async getConfig(@CurrentUser() user: SessionUser): Promise<GmailConfigResponseDto | null> {
    return this.gmailService.getConfig(user.id);
  }

  /**
   * Update Gmail sync configuration
   * PUT /api/v1/integrations/gmail/config
   */
  @Put('config')
  @ApiOperation({ summary: 'Update Gmail sync configuration' })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated',
    type: GmailConfigResponseDto,
  })
  async updateConfig(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateGmailConfigDto,
  ): Promise<GmailConfigResponseDto> {
    return this.gmailService.updateConfig(user.id, dto);
  }

  /**
   * Queue background email sync job
   * POST /api/v1/integrations/gmail/sync
   * Returns immediately with job ID for status tracking
   */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Queue Gmail email sync (background job)',
    description:
      'Queues a background job to sync all emails within the specified time period. ' +
      'Returns immediately with a job ID that can be used to track progress.',
  })
  @ApiResponse({
    status: 202,
    description: 'Sync job queued successfully',
    type: GmailSyncJobResponseDto,
  })
  async syncEmails(
    @CurrentUser() user: SessionUser,
    @Body() dto?: QueueGmailSyncDto,
  ): Promise<GmailSyncJobResponseDto> {
    return this.gmailService.queueEmailSync(user.id, dto);
  }

  /**
   * Get sync job status
   * GET /api/v1/integrations/gmail/sync/:jobId
   */
  @Get('sync/:jobId')
  @ApiOperation({
    summary: 'Get Gmail sync job status',
    description: 'Returns the current status and progress of a Gmail sync job.',
  })
  @ApiParam({
    name: 'jobId',
    description: 'The sync job ID returned from POST /sync',
  })
  @ApiResponse({
    status: 200,
    description: 'Job status retrieved',
    type: GmailSyncJobStatusDto,
  })
  async getSyncStatus(
    @CurrentUser() user: SessionUser,
    @Param('jobId') jobId: string,
  ): Promise<GmailSyncJobStatusDto> {
    return this.gmailService.getSyncJobStatus(user.id, jobId);
  }

  /**
   * Disconnect Gmail integration
   * DELETE /api/v1/integrations/gmail/disconnect
   */
  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect Gmail integration' })
  @ApiResponse({
    status: 200,
    description: 'Integration disconnected',
    type: GmailDisconnectResponseDto,
  })
  async disconnect(@CurrentUser() user: SessionUser): Promise<GmailDisconnectResponseDto> {
    return this.gmailService.disconnect(user.id);
  }
}
