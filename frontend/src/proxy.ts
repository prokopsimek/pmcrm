import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js Proxy for authentication and organization-based routing
 *
 * Handles:
 * - Authentication check via better-auth session cookie
 * - Organization slug validation
 * - Redirect to organization creation if no org
 * - Redirect old routes to org-prefixed routes
 *
 * Note: Session validation happens on API calls via better-auth AuthGuard.
 * Organization membership is validated in the OrganizationProvider.
 */

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

// Routes that require auth but don't need org context
const AUTH_ONLY_ROUTES = [
  '/organizations',
  '/onboarding',
  '/invitations',
  '/admin',
];

// Protected routes that need org context (will be prefixed with /[orgSlug])
const PROTECTED_ROUTES = [
  '/dashboard',
  '/contacts',
  '/calendar',
  '/reminders',
  '/recommendations',
  '/settings',
  '/members',
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip static files
  if (pathname.includes('.') && !pathname.endsWith('/')) {
    return NextResponse.next();
  }

  // Public paths - always allow
  if (PUBLIC_ROUTES.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Check for session cookie (better-auth uses 'better-auth.session_token')
  // In HTTPS/secure mode, cookies have '__Secure-' prefix
  const hasSession =
    request.cookies.has('better-auth.session_token') ||
    request.cookies.has('__Secure-better-auth.session_token');

  // If no session, redirect to login
  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth-only routes (org management, onboarding) - just pass through
  if (AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check if this is an old-style protected route (no org slug)
  // e.g., /dashboard should redirect to /[orgSlug]/dashboard
  const isOldProtectedRoute = PROTECTED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  if (isOldProtectedRoute) {
    // Redirect to organizations page which will auto-redirect to org dashboard
    return NextResponse.redirect(new URL('/organizations', request.url));
  }

  // Check if this is an org-prefixed route
  const pathParts = pathname.split('/').filter(Boolean);

  if (pathParts.length > 0) {
    const potentialOrgSlug = pathParts[0];
    const restOfPath = '/' + pathParts.slice(1).join('/');

    // If rest of path is empty, default to dashboard
    if (!restOfPath || restOfPath === '/') {
      return NextResponse.redirect(
        new URL(`/${potentialOrgSlug}/dashboard`, request.url)
      );
    }

    // Check if the rest of the path is a protected route
    const isOrgPrefixedProtectedRoute = PROTECTED_ROUTES.some(
      (route) => restOfPath === route || restOfPath.startsWith(route + '/')
    );

    if (isOrgPrefixedProtectedRoute) {
      // This is an org-prefixed route like /dx-heroes/dashboard
      // We'll validate the org membership in the OrganizationProvider
      // Add org slug to request headers for downstream use
      const response = NextResponse.next();
      response.headers.set('x-org-slug', potentialOrgSlug);
      return response;
    }
  }

  // Root path - redirect to organizations or dashboard
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/organizations', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
