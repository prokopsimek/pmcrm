/**
 * DTO for SSO registration (Google, Microsoft)
 * US-001: Registration and workspace creation
 */
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class RegisterSSODto {
  @ApiProperty({
    description: 'SSO provider',
    example: 'google',
    enum: ['google', 'microsoft'],
  })
  @IsString()
  @IsIn(['google', 'microsoft'], { message: 'Provider must be either google or microsoft' })
  provider: 'google' | 'microsoft';

  @ApiProperty({
    description: 'Provider user ID',
    example: 'google-123456789',
  })
  @IsString()
  providerId: string;

  @ApiProperty({
    description: 'User email from SSO provider',
    example: 'user@example.com',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'User first name from SSO provider',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({
    description: 'User last name from SSO provider',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    description: 'User profile image URL from SSO provider',
    example: 'https://example.com/image.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  image?: string;
}
