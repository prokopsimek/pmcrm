import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { DueDateCalculatorService } from './services/due-date-calculator.service';
import { PrioritySorterService } from './services/priority-sorter.service';
import { ReminderNotificationJob } from './jobs/reminder-notification.job';
import { DatabaseModule } from '../../shared/database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'reminders',
    }),
  ],
  controllers: [RemindersController],
  providers: [
    RemindersService,
    DueDateCalculatorService,
    PrioritySorterService,
    ReminderNotificationJob,
  ],
  exports: [RemindersService],
})
export class RemindersModule {}
