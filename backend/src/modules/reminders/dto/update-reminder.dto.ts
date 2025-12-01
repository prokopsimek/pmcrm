import { IsString, IsOptional, IsDate, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateReminderDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  scheduledFor?: Date;

  @IsInt()
  @Min(1)
  @IsOptional()
  frequencyDays?: number;
}
