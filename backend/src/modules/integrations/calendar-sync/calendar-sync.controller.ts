import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  Res,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { CalendarSyncService } from './calendar-sync.service';
import {
  CalendarConnectionResponseDto,
  CalendarCallbackResponseDto,
  CalendarSyncResultDto,
  CalendarDisconnectResultDto,
  CalendarStatusResponseDto,
} from './dto/calendar-connection.dto';
import { FetchEventsResponseDto } from './dto/calendar-event.dto';
import { AddMeetingNotesDto, MeetingNotesResponseDto } from './dto/meeting-notes.dto';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import type { SessionUser } from '@/shared/decorators/current-user.decorator';

/**
 * Calendar Sync Controller
 * Handles OAuth flow, event fetching, and sync operations for calendar integrations
 */
@ApiTags('Integrations - Calendar')
@Controller()
export class CalendarSyncController {
  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly configService: ConfigService,
  ) {}

  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Initiate Google Calendar OAuth flow
   * POST /api/v1/integrations/google-calendar/connect
   */
  @Post('integrations/google-calendar/connect')
  @ApiOperation({ summary: 'Initiate Google Calendar OAuth flow' })
  @ApiResponse({
    status: 200,
    description: 'OAuth authorization URL generated',
    type: CalendarConnectionResponseDto,
  })
  async connectGoogleCalendar(
    @CurrentUser() user: SessionUser | any,
  ): Promise<CalendarConnectionResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.calendarSyncService.connectGoogleCalendar(user.id);
  }

  /**
   * Initiate Outlook Calendar OAuth flow
   * POST /api/v1/integrations/outlook-calendar/connect
   */
  @Post('integrations/outlook-calendar/connect')
  @ApiOperation({ summary: 'Initiate Outlook Calendar OAuth flow' })
  @ApiResponse({
    status: 200,
    description: 'OAuth authorization URL generated',
    type: CalendarConnectionResponseDto,
  })
  async connectOutlookCalendar(
    @CurrentUser() user: SessionUser | any,
  ): Promise<CalendarConnectionResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.calendarSyncService.connectOutlookCalendar(user.id);
  }

  /**
   * Handle Google Calendar OAuth callback
   * GET /api/v1/integrations/google-calendar/callback
   */
  @Get('integrations/google-calendar/callback')
  @AllowAnonymous()
  @ApiOperation({ summary: 'Handle Google Calendar OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with success/error status',
  })
  async handleGoogleCallback(
    @CurrentUser() user: SessionUser | any,
    @Query('code') code: string | null,
    @Query('state') state: string | null,
    @Res() res?: Response,
  ): Promise<CalendarCallbackResponseDto | void> {
    const frontendUrl = this.getFrontendUrl();
    const redirectBase = `${frontendUrl}/settings/integrations`;

    // Validate parameters
    if (!code) {
      if (res) {
        res.redirect(
          `${redirectBase}?error=missing_code&message=${encodeURIComponent('Missing authorization code')}`,
        );
        return;
      }
      throw new BadRequestException('Missing authorization code');
    }

    if (!state) {
      if (res) {
        res.redirect(
          `${redirectBase}?error=missing_state&message=${encodeURIComponent('Missing state parameter')}`,
        );
        return;
      }
      throw new BadRequestException('Missing state parameter');
    }

    try {
      // For callback, get userId from state (OAuth flow)
      const userId = user?.id || 'from-state'; // State validation happens in service

      const result = await this.calendarSyncService.handleOAuthCallback(
        userId,
        code,
        state,
        'google',
      );

      if (res) {
        res.redirect(
          `${redirectBase}?success=google-calendar&message=${encodeURIComponent(result.message || 'Connected successfully')}`,
        );
        return;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (res) {
        res.redirect(
          `${redirectBase}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
        );
        return;
      }

      throw error;
    }
  }

  /**
   * Handle Outlook Calendar OAuth callback
   * GET /api/v1/integrations/outlook-calendar/callback
   */
  @Get('integrations/outlook-calendar/callback')
  @AllowAnonymous()
  @ApiOperation({ summary: 'Handle Outlook Calendar OAuth callback' })
  @ApiResponse({
    status: 302,
    description: 'Redirects to frontend with success/error status',
  })
  async handleOutlookCallback(
    @CurrentUser() user: SessionUser | any,
    @Query('code') code: string | null,
    @Query('state') state: string | null,
    @Res() res?: Response,
  ): Promise<CalendarCallbackResponseDto | void> {
    const frontendUrl = this.getFrontendUrl();
    const redirectBase = `${frontendUrl}/settings/integrations`;

    // Validate parameters
    if (!code) {
      if (res) {
        res.redirect(
          `${redirectBase}?error=missing_code&message=${encodeURIComponent('Missing authorization code')}`,
        );
        return;
      }
      throw new BadRequestException('Missing authorization code');
    }

    if (!state) {
      if (res) {
        res.redirect(
          `${redirectBase}?error=missing_state&message=${encodeURIComponent('Missing state parameter')}`,
        );
        return;
      }
      throw new BadRequestException('Missing state parameter');
    }

    try {
      const userId = user?.id || 'from-state';

      const result = await this.calendarSyncService.handleOAuthCallback(
        userId,
        code,
        state,
        'microsoft',
      );

      if (res) {
        res.redirect(
          `${redirectBase}?success=outlook-calendar&message=${encodeURIComponent(result.message || 'Connected successfully')}`,
        );
        return;
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

      if (res) {
        res.redirect(
          `${redirectBase}?error=oauth_failed&message=${encodeURIComponent(errorMessage)}`,
        );
        return;
      }

      throw error;
    }
  }

  /**
   * Get calendar events
   * GET /api/v1/calendar/events
   */
  @Get('calendar/events')
  @ApiOperation({ summary: 'Get calendar events' })
  @ApiQuery({
    name: 'type',
    required: true,
    enum: ['upcoming', 'past'],
    description: 'Event type to fetch',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Start date for date range (ISO format)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'End date for date range (ISO format)',
  })
  @ApiResponse({
    status: 200,
    description: 'Calendar events fetched successfully',
    type: FetchEventsResponseDto,
  })
  async getEvents(
    @CurrentUser() user: SessionUser | any,
    @Query('type') type: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<FetchEventsResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Validate type parameter
    if (type !== 'upcoming' && type !== 'past') {
      throw new BadRequestException('Invalid type parameter. Must be "upcoming" or "past"');
    }

    // Parse and validate dates
    let parsedStartDate: Date | undefined;
    let parsedEndDate: Date | undefined;

    if (startDate) {
      parsedStartDate = new Date(startDate);
      if (isNaN(parsedStartDate.getTime())) {
        throw new BadRequestException('Invalid startDate format');
      }
    }

    if (endDate) {
      parsedEndDate = new Date(endDate);
      if (isNaN(parsedEndDate.getTime())) {
        throw new BadRequestException('Invalid endDate format');
      }
    }

    // Validate date range
    if (parsedStartDate && parsedEndDate && parsedStartDate >= parsedEndDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const options =
      parsedStartDate || parsedEndDate
        ? { startDate: parsedStartDate, endDate: parsedEndDate }
        : undefined;

    return this.calendarSyncService.fetchEvents(user.id, type, options);
  }

  /**
   * Add notes to a calendar event
   * POST /api/v1/calendar/events/:id/notes
   */
  @Post('calendar/events/:id/notes')
  @ApiOperation({ summary: 'Add notes to a calendar event' })
  @ApiResponse({
    status: 200,
    description: 'Notes added successfully',
    type: MeetingNotesResponseDto,
  })
  async addMeetingNotes(
    @CurrentUser() user: SessionUser | any,
    @Param('id') interactionId: string,
    @Body() dto: AddMeetingNotesDto,
  ): Promise<MeetingNotesResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Validate notes length
    if (dto.notes && dto.notes.length > 10000) {
      throw new BadRequestException('Notes cannot exceed 10,000 characters');
    }

    const options = dto.append ? { append: dto.append } : undefined;

    return this.calendarSyncService.addMeetingNotes(user.id, interactionId, dto.notes, options);
  }

  /**
   * Trigger manual calendar sync
   * POST /api/v1/calendar/sync
   */
  @Post('calendar/sync')
  @ApiOperation({ summary: 'Trigger manual calendar sync' })
  @ApiResponse({
    status: 200,
    description: 'Calendar synced successfully',
    type: CalendarSyncResultDto,
  })
  async manualSync(@CurrentUser() user: SessionUser | any): Promise<CalendarSyncResultDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.calendarSyncService.incrementalSync(user.id);
  }

  /**
   * Disconnect calendar integration
   * DELETE /api/v1/integrations/calendar/disconnect
   */
  @Delete('integrations/calendar/disconnect')
  @ApiOperation({ summary: 'Disconnect calendar integration' })
  @ApiResponse({
    status: 200,
    description: 'Calendar disconnected successfully',
    type: CalendarDisconnectResultDto,
  })
  async disconnectCalendar(
    @CurrentUser() user: SessionUser | any,
  ): Promise<CalendarDisconnectResultDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.calendarSyncService.disconnectCalendar(user.id);
  }

  /**
   * Get calendar integration status
   * GET /api/v1/calendar/status
   */
  @Get('calendar/status')
  @ApiOperation({ summary: 'Get calendar integration status' })
  @ApiResponse({
    status: 200,
    description: 'Calendar status retrieved',
    type: CalendarStatusResponseDto,
  })
  async getStatus(@CurrentUser() user: SessionUser | any): Promise<CalendarStatusResponseDto> {
    if (!user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }

    return this.calendarSyncService.getCalendarStatus(user.id);
  }
}
