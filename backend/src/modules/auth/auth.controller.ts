import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous, Session } from '@thallesp/nestjs-better-auth';
import { AuthService } from './auth.service';

interface SessionData {
  user: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
    role: string;
    isActive: boolean;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
  };
}

/**
 * Authentication Controller
 * Provides endpoints for session management
 *
 * Note: better-auth handles authentication endpoints automatically at /api/auth/*
 * - POST /api/auth/sign-in/email - Email/password login
 * - POST /api/auth/sign-up/email - Email/password registration
 * - POST /api/auth/sign-out - Logout
 * - GET /api/auth/sign-in/social/google - Google OAuth
 * - GET /api/auth/sign-in/social/microsoft - Microsoft OAuth
 * - GET /api/auth/callback/* - OAuth callbacks
 * - GET /api/auth/session - Get current session
 */
@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Get current authenticated user session
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get current user session' })
  @ApiResponse({ status: 200, description: 'Returns the current user session' })
  @ApiResponse({ status: 401, description: 'Unauthorized - no valid session' })
  async getCurrentUser(@Session() session: SessionData) {
    // Session decorator automatically validates the session
    // If no valid session exists, it returns null
    if (!session) {
      return { user: null };
    }

    // Fetch additional user data if needed
    const user = await this.authService.getUserById(session.user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        image: user.image,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      session: {
        expiresAt: session.session.expiresAt,
      },
    };
  }

  /**
   * Health check for auth service
   */
  @AllowAnonymous()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Auth service health check' })
  @ApiResponse({ status: 200, description: 'Auth service is healthy' })
  healthCheck() {
    return {
      status: 'ok',
      message: 'Authentication service is running',
      provider: 'better-auth',
    };
  }
}
