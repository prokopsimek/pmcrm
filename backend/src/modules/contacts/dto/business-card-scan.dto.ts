import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';

export enum ImageFormat {
  JPEG = 'image/jpeg',
  PNG = 'image/png',
}

export class BusinessCardScanDto {
  @ApiProperty({ description: 'Base64 encoded image data' })
  @IsString()
  imageData: string;

  @ApiProperty({ description: 'Image MIME type', enum: ImageFormat })
  @IsEnum(ImageFormat)
  mimeType: ImageFormat;

  @ApiPropertyOptional({ description: 'Optional filename', example: 'business-card.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;
}

export class BusinessCardParseResult {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  website?: string;
  address?: string;
  confidence: number;
  rawText: string;
}
