import { IsString, IsOptional, IsDate, IsInt, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReminderDto {
  @IsString()
  @IsNotEmpty()
  contactId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  message?: string;

  @Type(() => Date)
  @IsDate()
  scheduledFor: Date;

  @IsInt()
  @Min(1)
  @IsOptional()
  frequencyDays?: number;
}
