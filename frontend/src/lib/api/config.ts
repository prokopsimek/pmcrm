/**
 * API Configuration
 */

export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  version: process.env.NEXT_PUBLIC_API_VERSION || 'api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Required for better-auth cookies
} as const;

/**
 * @deprecated better-auth uses HTTP-only cookies, not localStorage tokens
 */
export const AUTH_CONFIG = {
  tokenKey: process.env.NEXT_PUBLIC_AUTH_TOKEN_KEY || 'pmcrm_auth_token',
  refreshTokenKey: process.env.NEXT_PUBLIC_REFRESH_TOKEN_KEY || 'pmcrm_refresh_token',
} as const;

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_CONFIG.baseURL}/${API_CONFIG.version}/${cleanPath}`;
};
