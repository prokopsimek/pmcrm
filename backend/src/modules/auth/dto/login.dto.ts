import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * @deprecated Use better-auth sign-in endpoint instead
 * POST /api/auth/sign-in/email
 */
export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password!: string;
}
