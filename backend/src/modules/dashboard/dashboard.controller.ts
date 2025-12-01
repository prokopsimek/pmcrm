import { Controller, Get, Post, Param, Body, Query, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { DashboardService } from './dashboard.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

/**
 * Dashboard Controller
 * Provides endpoints for dashboard statistics, follow-ups, recommendations, and activity
 *
 * Note: Authentication is handled globally by better-auth AuthGuard
 */
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Get dashboard statistics
   */
  @Get('stats')
  async getStats(@Request() req: AuthenticatedRequest) {
    const userId = req.user.id;
    return this.dashboardService.getStats(userId);
  }

  /**
   * Get pending follow-ups
   */
  @Get('followups')
  async getPendingFollowups(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
    @Query('includeOverdue') includeOverdue?: string,
  ) {
    const userId = req.user.id;
    return this.dashboardService.getPendingFollowups(userId, {
      limit: limit ? parseInt(limit.toString()) : 10,
      includeOverdue: includeOverdue === 'true',
    });
  }

  /**
   * Get AI recommendations
   */
  @Get('recommendations')
  async getRecommendations(
    @Request() req: AuthenticatedRequest,
    @Query('period') period?: 'daily' | 'weekly' | 'monthly',
    @Query('limit') limit?: number,
  ) {
    const userId = req.user.id;
    return this.dashboardService.getRecommendations(userId, {
      period: period || 'daily',
      limit: limit ? parseInt(limit.toString()) : 5,
    });
  }

  /**
   * Get recent activity
   */
  @Get('activity')
  async getRecentActivity(
    @Request() req: AuthenticatedRequest,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const userId = req.user.id;
    return this.dashboardService.getRecentActivity(userId, {
      limit: limit ? parseInt(limit.toString()) : 10,
      offset: offset ? parseInt(offset.toString()) : 0,
    });
  }

  /**
   * Dismiss a recommendation
   */
  @Post('recommendations/:id/dismiss')
  async dismissRecommendation(
    @Request() req: AuthenticatedRequest,
    @Param('id') recommendationId: string,
  ) {
    const userId = req.user.id;
    return this.dashboardService.dismissRecommendation(userId, recommendationId);
  }

  /**
   * Snooze a recommendation
   */
  @Post('recommendations/:id/snooze')
  async snoozeRecommendation(
    @Request() req: AuthenticatedRequest,
    @Param('id') recommendationId: string,
    @Body('days') days: number,
  ) {
    const userId = req.user.id;
    return this.dashboardService.snoozeRecommendation(userId, recommendationId, days);
  }

  /**
   * Provide feedback on a recommendation
   */
  @Post('recommendations/:id/feedback')
  async feedbackRecommendation(
    @Request() req: AuthenticatedRequest,
    @Param('id') recommendationId: string,
    @Body('isHelpful') isHelpful: boolean,
  ) {
    const userId = req.user.id;
    return this.dashboardService.feedbackRecommendation(userId, recommendationId, isHelpful);
  }

  /**
   * Mark follow-up as done
   */
  @Post('followups/:id/complete')
  async markFollowupDone(@Request() req: AuthenticatedRequest, @Param('id') followupId: string) {
    const userId = req.user.id;
    return this.dashboardService.markFollowupDone(userId, followupId);
  }

  /**
   * Snooze a follow-up
   */
  @Post('followups/:id/snooze')
  async snoozeFollowup(
    @Request() req: AuthenticatedRequest,
    @Param('id') followupId: string,
    @Body('days') days: number,
  ) {
    const userId = req.user.id;
    return this.dashboardService.snoozeFollowup(userId, followupId, days);
  }
}
