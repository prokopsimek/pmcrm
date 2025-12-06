import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * User data from better-auth session
 */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  image: string | null;
  role: string;
  isActive: boolean;
  emailVerified: boolean;
}

interface AuthState {
  // User data (synced from better-auth session)
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  clearAuth: () => void;
}

/**
 * Auth Store
 *
 * Note: better-auth manages authentication state via cookies/sessions.
 * This store is for local UI state sync only.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: 'pmcrm-auth',
      // Only persist minimal data for hydration
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
