import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { GmailService } from './gmail.service';
import {
  GmailOAuthInitiateResponseDto,
  GmailStatusResponseDto,
  GmailConfigResponseDto,
  GmailDisconnectResponseDto,
  EmailSyncResultDto,
  UpdateGmailConfigDto,
  TriggerSyncDto,
} from './dto';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { SessionUser } from '@/shared/decorators/current-user.decorator';

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
  async initiateAuth(@CurrentUser() user: SessionUser): Promise<GmailOAuthInitiateResponseDto> {
    return this.gmailService.initiateOAuthFlow(user.id);
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
      const result = await this.gmailService.handleOAuthCallback(code, state);

      // Redirect to frontend with success
      res.redirect(`${redirectBase}?success=gmail&message=${encodeURIComponent(result.message)}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      res.redirect(
        `${redirectBase}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
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
   * Trigger email sync
   * POST /api/v1/integrations/gmail/sync
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger Gmail email sync' })
  @ApiResponse({
    status: 200,
    description: 'Email sync completed',
    type: EmailSyncResultDto,
  })
  async syncEmails(
    @CurrentUser() user: SessionUser,
    @Body() dto?: TriggerSyncDto,
  ): Promise<EmailSyncResultDto> {
    return this.gmailService.syncEmails(user.id, dto);
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
