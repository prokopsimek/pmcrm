import { plainToClass } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  validateSync,
  Min,
  Max,
  IsUrl,
  IsBoolean,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Min(1000)
  @Max(65535)
  PORT: number = 3000;

  // Use @IsString() instead of @IsUrl() because postgresql:// and redis:// schemes aren't recognized
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  // Legacy JWT configuration - optional when using better-auth
  @IsString()
  @IsOptional()
  JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  JWT_REFRESH_SECRET?: string;

  // Better Auth Configuration
  @IsString()
  @IsOptional()
  BETTER_AUTH_SECRET?: string;

  @IsString()
  @IsOptional()
  BETTER_AUTH_URL?: string;

  @IsNumber()
  @Min(300) // 5 minutes minimum
  JWT_EXPIRATION: number = 900; // 15 minutes

  @IsNumber()
  @Min(3600) // 1 hour minimum
  JWT_REFRESH_EXPIRATION: number = 604800; // 7 days

  @IsString()
  @IsOptional()
  ALLOWED_ORIGINS: string = 'http://localhost:3000,http://localhost:5173';

  @IsBoolean()
  @IsOptional()
  ENABLE_SWAGGER: boolean = true;

  @IsString()
  @IsOptional()
  LOG_LEVEL: string = 'info';

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_TTL: number = 60;

  @IsNumber()
  @IsOptional()
  RATE_LIMIT_MAX: number = 100;

  // AI/LLM Configuration
  @IsString()
  @IsOptional()
  AI_PROVIDER?: string; // 'google' | 'openai' | 'anthropic' - defaults to 'google'

  @IsString()
  @IsOptional()
  AI_MODEL?: string; // Model name, e.g., 'gemini-2.5-flash-preview-05-20', 'gpt-4o', 'claude-3-5-sonnet'

  @IsString()
  @IsOptional()
  GOOGLE_AI_API_KEY?: string;

  @IsString()
  @IsOptional()
  OPENAI_API_KEY?: string;

  @IsString()
  @IsOptional()
  ANTHROPIC_API_KEY?: string;

  // Integration Credentials - Google
  // Can use either OAUTH_GOOGLE_ or GOOGLE_ prefix
  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;

  @IsString()
  @IsOptional()
  OAUTH_GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_GOOGLE_CLIENT_SECRET?: string;

  // Integration Credentials - LinkedIn
  @IsString()
  @IsOptional()
  LINKEDIN_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  LINKEDIN_CLIENT_SECRET?: string;

  // Integration Credentials - Microsoft
  @IsString()
  @IsOptional()
  OAUTH_MICROSOFT_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  OAUTH_MICROSOFT_CLIENT_SECRET?: string;

  // OAuth Token Encryption Key (generate with: openssl rand -hex 32)
  @IsString()
  @IsOptional()
  OAUTH_ENCRYPTION_KEY?: string;

  // Application URL for OAuth redirects
  @IsString()
  @IsOptional()
  APP_URL?: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n${errors.toString()}`);
  }

  return validatedConfig;
}
