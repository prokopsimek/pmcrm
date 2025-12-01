import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * @deprecated better-auth uses session-based authentication
 * Sessions are automatically refreshed via cookies
 */
export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh-token-here' })
  @IsString()
  refreshToken!: string;
}
