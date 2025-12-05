import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ReminderNotificationJob } from './jobs/reminder-notification.job';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { DueDateCalculatorService } from './services/due-date-calculator.service';
import { PrioritySorterService } from './services/priority-sorter.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'reminders',
    }),
    forwardRef(() => ContactsModule),
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
