/**
 * Email Sync Controller
 * US-030: Email communication sync
 * REST API endpoints for email synchronization
 */

import { Controller, Get, Post, Put, Delete, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EmailSyncService } from './email-sync.service';
import { GmailClientService } from './services/gmail-client.service';
import { OutlookClientService } from './services/outlook-client.service';
import type { EmailSyncConfig } from '@prisma/client';
import {
  UpdateSyncConfigDto,
  ConnectProviderDto,
  ExcludeContactDto,
  TriggerSyncDto,
} from './dto/sync-config.dto';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { SessionUser } from '@/shared/decorators/current-user.decorator';

/**
 * Note: Authentication is handled globally by better-auth AuthGuard
 */
@ApiTags('Email Sync')
@Controller('integrations/email')
@ApiBearerAuth()
export class EmailSyncController {
  constructor(
    private readonly emailSyncService: EmailSyncService,
    private readonly gmailClient: GmailClientService,
    private readonly outlookClient: OutlookClientService,
  ) {}

  @Get('config')
  @ApiOperation({ summary: 'Get email sync configuration' })
  async getConfig(@CurrentUser() user: SessionUser): Promise<EmailSyncConfig | null> {
    return this.emailSyncService.getConfig(user.id);
  }

  @Put('config')
  @ApiOperation({ summary: 'Update email sync configuration' })
  async updateConfig(
    @CurrentUser() user: SessionUser,
    @Body() dto: UpdateSyncConfigDto,
  ): Promise<EmailSyncConfig> {
    return this.emailSyncService.updateConfig(user.id, dto);
  }

  @Get('gmail/auth-url')
  @ApiOperation({ summary: 'Get Gmail OAuth URL' })
  getGmailAuthUrl(@CurrentUser() user: SessionUser) {
    const url = this.gmailClient.getAuthUrl(user.id);
    return { url };
  }

  @Post('gmail/connect')
  @ApiOperation({ summary: 'Connect Gmail account' })
  @HttpCode(HttpStatus.OK)
  async connectGmail(@CurrentUser() user: SessionUser, @Body() dto: ConnectProviderDto) {
    const tokens = await this.gmailClient.exchangeCodeForTokens(dto.code);

    // Store tokens in integrations table
    await this.emailSyncService.updateConfig(user.id, {
      gmailEnabled: true,
    });

    // In a real implementation, also store tokens in integration table
    // await this.integrationsService.storeTokens(user.id, 'google', tokens);

    return {
      success: true,
      provider: 'gmail',
      message: 'Gmail connected successfully',
    };
  }

  @Get('outlook/auth-url')
  @ApiOperation({ summary: 'Get Outlook OAuth URL' })
  getOutlookAuthUrl(@CurrentUser() user: SessionUser) {
    const url = this.outlookClient.getAuthUrl(user.id);
    return { url };
  }

  @Post('outlook/connect')
  @ApiOperation({ summary: 'Connect Outlook account' })
  @HttpCode(HttpStatus.OK)
  async connectOutlook(@CurrentUser() user: SessionUser, @Body() dto: ConnectProviderDto) {
    const tokens = await this.outlookClient.exchangeCodeForTokens(dto.code);

    await this.emailSyncService.updateConfig(user.id, {
      outlookEnabled: true,
    });

    // In a real implementation, also store tokens in integration table
    // await this.integrationsService.storeTokens(user.id, 'microsoft', tokens);

    return {
      success: true,
      provider: 'outlook',
      message: 'Outlook connected successfully',
    };
  }

  @Post('sync')
  @ApiOperation({ summary: 'Trigger manual email sync' })
  @HttpCode(HttpStatus.OK)
  async triggerSync(@CurrentUser() user: SessionUser, @Body() dto: TriggerSyncDto) {
    const provider = dto.provider || 'gmail';
    const fullSync = dto.fullSync || false;

    if (provider === 'both') {
      // Sync both providers
      const gmailResult = await this.emailSyncService.syncEmails(user.id, 'gmail', fullSync);
      const outlookResult = await this.emailSyncService.syncEmails(user.id, 'outlook', fullSync);

      return {
        gmail: gmailResult,
        outlook: outlookResult,
      };
    }

    return this.emailSyncService.syncEmails(user.id, provider, fullSync);
  }

  @Get('status')
  @ApiOperation({ summary: 'Get email sync status' })
  async getSyncStatus(@CurrentUser() user: SessionUser) {
    return this.emailSyncService.getSyncStatus(user.id);
  }

  @Post('exclude')
  @ApiOperation({ summary: 'Exclude contact email from sync' })
  @HttpCode(HttpStatus.OK)
  async excludeContact(@CurrentUser() user: SessionUser, @Body() dto: ExcludeContactDto) {
    await this.emailSyncService.excludeContactFromSync(user.id, dto.email);
    return {
      success: true,
      message: `Email ${dto.email} excluded from sync`,
    };
  }

  @Delete('disconnect')
  @ApiOperation({ summary: 'Disconnect email provider' })
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentUser() user: SessionUser,
    @Body() body: { provider: 'gmail' | 'outlook' },
  ) {
    if (body.provider === 'gmail') {
      await this.emailSyncService.updateConfig(user.id, {
        gmailEnabled: false,
      });
    } else {
      await this.emailSyncService.updateConfig(user.id, {
        outlookEnabled: false,
      });
    }

    return {
      success: true,
      message: `${body.provider} disconnected successfully`,
    };
  }
}
