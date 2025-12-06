'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth';
import { useAuthStore, type AuthUser } from '@/store/auth.store';

/**
 * Custom hook for authentication using better-auth
 *
 * Provides reactive session state and authentication methods.
 */
export function useAuth() {
  const router = useRouter();
  const { data: session, isPending, error } = useSession();
  const { setUser, setLoading, clearAuth } = useAuthStore();

  // Sync better-auth session with local store
  useEffect(() => {
    if (isPending) {
      setLoading(true);
      return;
    }

    if (session?.user) {
      const authUser: AuthUser = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        firstName: (session.user as any).firstName || null,
        lastName: (session.user as any).lastName || null,
        image: session.user.image ?? null,
        role: (session.user as any).role || 'USER',
        isActive: (session.user as any).isActive ?? true,
        emailVerified: session.user.emailVerified ?? false,
      };
      setUser(authUser);
    } else {
      clearAuth();
    }
  }, [session, isPending, setUser, setLoading, clearAuth]);

  const logout = async () => {
    try {
      await signOut();
      clearAuth();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return {
    // Session data
    user: session?.user
      ? {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          firstName: (session.user as any).firstName || null,
          lastName: (session.user as any).lastName || null,
          image: session.user.image,
          role: (session.user as any).role || 'USER',
          isActive: (session.user as any).isActive ?? true,
          emailVerified: session.user.emailVerified ?? false,
        }
      : null,
    session: session?.session || null,
    isAuthenticated: !!session?.user,
    isLoading: isPending,
    error: error?.message || null,

    // Actions
    logout,
    signOut: logout, // Alias
  };
}

/**
 * Hook for requiring authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(redirectTo = '/login') {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, router, redirectTo]);

  return { isAuthenticated, isLoading };
}
