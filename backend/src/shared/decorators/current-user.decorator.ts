import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User data stored in the session by better-auth
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session data from better-auth
 */
export interface SessionData {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

/**
 * Full session object from better-auth
 */
export interface BetterAuthSession {
  user: SessionUser;
  session: SessionData;
}

/**
 * Decorator to extract current user from better-auth session
 *
 * Usage:
 * - @CurrentUser() user: SessionUser - Get full user object
 * - @CurrentUser('id') userId: string - Get specific property
 */
export const CurrentUser = createParamDecorator(
  (data: keyof SessionUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as SessionUser;

    return data ? user?.[data] : user;
  },
);

/**
 * Legacy alias for backward compatibility
 * @deprecated Use SessionUser interface instead
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}
