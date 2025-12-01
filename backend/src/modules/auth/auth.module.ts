import { Module } from '@nestjs/common';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { auth } from '@/lib/auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from '@/shared/database/database.module';

/**
 * Authentication Module
 * Uses better-auth for authentication via email/password and OAuth (Google, Microsoft)
 */
@Module({
  imports: [
    // Better-auth NestJS integration
    BetterAuthModule.forRoot({
      auth,
      // Route prefix for better-auth endpoints
      basePath: '/api/auth',
    }),
    DatabaseModule,
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, BetterAuthModule],
})
export class AuthModule {}
