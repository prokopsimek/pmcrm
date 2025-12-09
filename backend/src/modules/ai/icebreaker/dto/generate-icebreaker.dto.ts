/**
 * DTOs for Icebreaker Generation
 * US-051: AI icebreaker message generation
 */

import { IsString, IsEnum, IsOptional, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ChannelEnum {
  EMAIL = 'email',
  LINKEDIN = 'linkedin',
  WHATSAPP = 'whatsapp',
}

export enum ToneEnum {
  PROFESSIONAL = 'professional',
  FRIENDLY = 'friendly',
  CASUAL = 'casual',
}

export enum FeedbackEnum {
  HELPFUL = 'helpful',
  NOT_HELPFUL = 'not_helpful',
  NEEDS_IMPROVEMENT = 'needs_improvement',
}

export class GenerateIcebreakerDto {
  @ApiProperty({ description: 'Contact ID to generate icebreaker for' })
  @IsUUID()
  contactId!: string;

  @ApiProperty({ enum: ChannelEnum, description: 'Communication channel' })
  @IsEnum(ChannelEnum)
  channel!: ChannelEnum;

  @ApiProperty({ enum: ToneEnum, description: 'Message tone' })
  @IsEnum(ToneEnum)
  tone!: ToneEnum;

  @ApiPropertyOptional({ description: 'Optional trigger event context' })
  @IsOptional()
  @IsString()
  triggerEvent?: string;

  @ApiPropertyOptional({ description: 'Maximum word count', minimum: 50, maximum: 500 })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(500)
  @Type(() => Number)
  wordLimit?: number;
}

export class MessageVariationDto {
  @ApiPropertyOptional({ description: 'Email subject line (email channel only)' })
  subject?: string;

  @ApiProperty({ description: 'Message body content' })
  body!: string;

  @ApiProperty({ description: 'Key talking points', type: [String] })
  talkingPoints!: string[];

  @ApiProperty({ description: 'Reasoning for this variation' })
  reasoning!: string;

  @ApiProperty({ description: 'Variation index (0-2)' })
  variationIndex!: number;
}

export class UsageMetricsDto {
  @ApiProperty({ description: 'LLM provider used' })
  provider!: string;

  @ApiProperty({ description: 'Model version' })
  modelVersion!: string;

  @ApiProperty({ description: 'Prompt version' })
  promptVersion!: string;

  @ApiProperty({ description: 'Total tokens used' })
  tokensUsed!: number;

  @ApiProperty({ description: 'Cost in USD' })
  costUsd!: number;

  @ApiProperty({ description: 'Generation time in milliseconds' })
  generationTimeMs!: number;
}

export class IcebreakerResponseDto {
  @ApiProperty({ description: 'Generation ID' })
  id!: string;

  @ApiProperty({ description: 'Generated message variations', type: [MessageVariationDto] })
  variations!: MessageVariationDto[];

  @ApiProperty({ description: 'Usage metrics', type: UsageMetricsDto })
  usageMetrics!: UsageMetricsDto;

  @ApiProperty({ description: 'Contact ID' })
  contactId!: string;

  @ApiProperty({ description: 'Channel used' })
  channel!: string;

  @ApiProperty({ description: 'Tone used' })
  tone!: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;
}

export class SelectVariationDto {
  @ApiProperty({ description: 'Index of selected variation (0-2)', minimum: 0, maximum: 2 })
  @IsInt()
  @Min(0)
  @Max(2)
  @Type(() => Number)
  variationIndex!: number;
}

export class EditIcebreakerDto {
  @ApiProperty({ description: 'Edited message content' })
  @IsString()
  editedContent!: string;
}

export class RegenerateIcebreakerDto {
  @ApiPropertyOptional({ enum: ToneEnum, description: 'New tone (optional)' })
  @IsOptional()
  @IsEnum(ToneEnum)
  tone?: ToneEnum;

  @ApiPropertyOptional({ description: 'New trigger event (optional)' })
  @IsOptional()
  @IsString()
  triggerEvent?: string;
}

export class SubmitFeedbackDto {
  @ApiProperty({ enum: FeedbackEnum, description: 'Feedback on generated message' })
  @IsEnum(FeedbackEnum)
  feedback!: FeedbackEnum;
}

export class IcebreakerHistoryDto {
  @ApiProperty({ description: 'Generation ID' })
  id!: string;

  @ApiProperty({ description: 'Contact ID' })
  contactId!: string;

  @ApiProperty({ description: 'Contact name' })
  contactName!: string;

  @ApiProperty({ description: 'Channel used' })
  channel!: string;

  @ApiProperty({ description: 'Tone used' })
  tone!: string;

  @ApiProperty({ description: 'Whether message was sent' })
  sent!: boolean;

  @ApiPropertyOptional({ description: 'Feedback provided' })
  feedback?: string;

  @ApiProperty({ description: 'Created at timestamp' })
  createdAt!: Date;

  @ApiPropertyOptional({ description: 'Sent at timestamp' })
  sentAt?: Date;
}



