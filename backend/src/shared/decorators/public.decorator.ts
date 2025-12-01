import { SetMetadata } from '@nestjs/common';

/**
 * Key used to mark routes as public (no authentication required)
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (no authentication required)
 * Works with better-auth AuthGuard
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Re-export AllowAnonymous from better-auth for convenience
export { AllowAnonymous } from '@thallesp/nestjs-better-auth';
