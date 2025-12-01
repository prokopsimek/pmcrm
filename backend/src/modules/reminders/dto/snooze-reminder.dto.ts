import { IsDate } from 'class-validator';
import { Type } from 'class-transformer';

export class SnoozeReminderDto {
  @Type(() => Date)
  @IsDate()
  snoozeUntil: Date;
}
