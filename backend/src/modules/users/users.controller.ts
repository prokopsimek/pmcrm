import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { CompleteOnboardingStepDto } from './dto';

/**
 * Users Controller
 * Note: Organization/workspace management is handled by better-auth organization plugin
 * via /api/auth/organization/* endpoints
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findByIdOrThrow(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id') id: string) {
    return this.usersService.findByIdOrThrow(id);
  }

  /**
   * Get onboarding status
   */
  @Get('onboarding/status')
  @ApiOperation({ summary: 'Get onboarding status' })
  async getOnboardingStatus(@CurrentUser('id') userId: string) {
    return this.usersService.getOnboardingStatus(userId);
  }

  /**
   * Complete onboarding step
   */
  @Post('onboarding/complete-step')
  @ApiOperation({ summary: 'Complete an onboarding step' })
  async completeOnboardingStep(
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteOnboardingStepDto,
  ) {
    return this.usersService.completeOnboardingStep(userId, dto.step);
  }
}
