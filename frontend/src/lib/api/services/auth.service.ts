/**
 * @deprecated Use better-auth client from @/lib/auth instead
 *
 * better-auth handles:
 * - POST /api/auth/sign-in/email - Email/password login
 * - POST /api/auth/sign-up/email - Email/password registration
 * - GET /api/auth/sign-in/social?provider=google - Google OAuth
 * - GET /api/auth/sign-in/social?provider=microsoft - Microsoft OAuth
 * - POST /api/auth/sign-out - Logout
 * - GET /api/auth/session - Get current session
 */

import { signIn, signUp, signOut, getSession } from '@/lib/auth';

// Re-export better-auth methods for backward compatibility
export const authService = {
  /**
   * @deprecated Use signIn.email() from @/lib/auth
   */
  login: async (email: string, password: string) => {
    const result = await signIn.email({ email, password });
    if (result.error) {
      throw new Error(result.error.message || 'Login failed');
    }
    return result.data;
  },

  /**
   * @deprecated Use signUp.email() from @/lib/auth
   */
  register: async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => {
    const result = await signUp.email({
      email: data.email,
      password: data.password,
      name: `${data.firstName} ${data.lastName}`,
    });
    if (result.error) {
      throw new Error(result.error.message || 'Registration failed');
    }
    return result.data;
  },

  /**
   * @deprecated Use signOut() from @/lib/auth
   */
  logout: async () => {
    await signOut();
  },

  /**
   * @deprecated Use getSession() from @/lib/auth
   */
  getSession: async () => {
    const result = await getSession();
    return result.data;
  },

  /**
   * @deprecated Use signIn.social() from @/lib/auth
   */
  googleLogin: async () => {
    await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    });
  },

  /**
   * @deprecated Use signIn.social() from @/lib/auth
   */
  microsoftLogin: async () => {
    await signIn.social({
      provider: 'microsoft',
      callbackURL: '/dashboard',
    });
  },
};

export default authService;
