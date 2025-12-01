import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsPhoneNumber } from 'class-validator';

export class CheckDuplicateDto {
  @ApiPropertyOptional({ description: 'Email to check for duplicates' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number to check for duplicates' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;
}

export class DuplicateCheckResult {
  isDuplicate: boolean;
  existingContact?: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}
