import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsUrl,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsDateString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MeetingContextDto {
  @ApiPropertyOptional({ description: 'Where the meeting took place' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @ApiPropertyOptional({
    description: 'When the meeting occurred',
    example: '2025-11-29T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  when?: string;

  @ApiPropertyOptional({ description: 'Meeting topic or notes' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  topic?: string;
}

export class CreateContactDto {
  @ApiProperty({ description: 'First name of the contact', example: 'John' })
  @IsString()
  @MaxLength(255)
  firstName: string;

  @ApiPropertyOptional({ description: 'Last name of the contact', example: 'Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Email address', example: 'john.doe@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number in E.164 format', example: '+14155552671' })
  @IsOptional()
  @IsPhoneNumber()
  @MaxLength(50)
  phone?: string;

  @ApiPropertyOptional({ description: 'Company name', example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  company?: string;

  @ApiPropertyOptional({ description: 'Company ID if company exists', example: 'uuid' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: 'Job title', example: 'Senior Engineer' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @ApiPropertyOptional({ description: 'LinkedIn profile URL' })
  @IsOptional()
  @IsUrl()
  linkedinUrl?: string;

  @ApiPropertyOptional({ description: 'General notes about the contact' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Tags to assign', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Contact frequency in days', example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  contactFrequencyDays?: number;

  @ApiPropertyOptional({ description: 'Meeting context', type: MeetingContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MeetingContextDto)
  meetingContext?: MeetingContextDto;
}
