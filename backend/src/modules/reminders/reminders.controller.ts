import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { SetFrequencyDto } from './dto/set-frequency.dto';
import { BulkFrequencyDto } from './dto/bulk-frequency.dto';
import { SnoozeReminderDto } from './dto/snooze-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

/**
 * Reminders Controller
 * Note: Authentication is handled globally by better-auth AuthGuard
 */
@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  /**
   * POST /api/v1/reminders
   * Create a new reminder
   */
  @Post()
  async createReminder(@CurrentUser() user: any, @Body() createReminderDto: CreateReminderDto) {
    return this.remindersService.createReminder(user.id, createReminderDto);
  }

  /**
   * GET /api/v1/reminders/:id
   * Get a specific reminder
   */
  @Get(':id')
  async getReminder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.remindersService.getReminder(user.id, id);
  }

  /**
   * PUT /api/v1/reminders/:id
   * Update a reminder
   */
  @Put(':id')
  async updateReminder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() updateReminderDto: UpdateReminderDto,
  ) {
    return this.remindersService.updateReminder(user.id, id, updateReminderDto);
  }

  /**
   * DELETE /api/v1/reminders/:id
   * Delete a reminder
   */
  @Delete(':id')
  async deleteReminder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.remindersService.deleteReminder(user.id, id);
  }

  /**
   * PUT /api/v1/reminders/:id/frequency
   * Update reminder frequency
   */
  @Put(':id/frequency')
  async updateReminderFrequency(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() setFrequencyDto: SetFrequencyDto,
  ) {
    return this.remindersService.updateReminder(user.id, id, setFrequencyDto);
  }

  /**
   * POST /api/v1/reminders/bulk/frequency
   * Bulk update frequency for contacts by tags
   */
  @Post('bulk/frequency')
  async bulkSetFrequency(@CurrentUser() user: any, @Body() bulkFrequencyDto: BulkFrequencyDto) {
    return this.remindersService.bulkSetFrequency(
      bulkFrequencyDto.tags,
      bulkFrequencyDto.frequencyDays,
    );
  }

  /**
   * GET /api/v1/reminders/dashboard
   * Get dashboard with pending reminders
   * Query params: ?filter=day|week|month
   */
  @Get('dashboard')
  async getDashboard(
    @CurrentUser() user: any,
    @Query('filter') filter: 'day' | 'week' | 'month' = 'week',
  ) {
    return this.remindersService.getDueReminders(user.id, filter);
  }

  /**
   * GET /api/v1/reminders/overdue
   * Get overdue reminders
   */
  @Get('overdue')
  async getOverdueReminders(@CurrentUser() user: any) {
    return this.remindersService.getOverdueReminders(user.id);
  }

  /**
   * POST /api/v1/reminders/:id/snooze
   * Snooze a reminder
   */
  @Post(':id/snooze')
  async snoozeReminder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() snoozeReminderDto: SnoozeReminderDto,
  ) {
    return this.remindersService.snoozeReminder(user.id, id, snoozeReminderDto.snoozeUntil);
  }

  /**
   * POST /api/v1/reminders/:id/done
   * Mark reminder as done
   */
  @Post(':id/done')
  async markReminderDone(@CurrentUser() user: any, @Param('id') id: string) {
    return this.remindersService.markReminderDone(user.id, id);
  }
}
