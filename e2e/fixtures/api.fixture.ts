/**
 * API fixtures for E2E tests
 * Provides helpers for API interactions and authentication
 */
import { test as base, APIRequestContext } from '@playwright/test';

type APIFixture = {
  apiContext: APIRequestContext;
  registerUser: (data: {
    email: string;
    password: string;
    fullName: string;
  }) => Promise<{ accessToken: string; user: any }>;
  loginUser: (email: string, password: string) => Promise<{ accessToken: string }>;
  authenticatedRequest: (
    token: string
  ) => {
    get: (url: string) => Promise<any>;
    post: (url: string, data: any) => Promise<any>;
    put: (url: string, data: any) => Promise<any>;
    delete: (url: string) => Promise<any>;
  };
};

/**
 * Extend base test with API fixture
 */
export const test = base.extend<APIFixture>({
  apiContext: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({
      baseURL: process.env.BASE_URL || 'http://localhost:3000',
    });
    await use(context);
    await context.dispose();
  },

  registerUser: async ({ apiContext }, use) => {
    const register = async (data: {
      email: string;
      password: string;
      fullName: string;
    }) => {
      const response = await apiContext.post('/api/v1/users/register', {
        data,
      });

      if (!response.ok()) {
        throw new Error(`Registration failed: ${await response.text()}`);
      }

      const body = await response.json();
      return {
        accessToken: body.accessToken,
        user: body.user,
      };
    };

    await use(register);
  },

  loginUser: async ({ apiContext }, use) => {
    const login = async (email: string, password: string) => {
      const response = await apiContext.post('/api/v1/users/login', {
        data: { email, password },
      });

      if (!response.ok()) {
        throw new Error(`Login failed: ${await response.text()}`);
      }

      const body = await response.json();
      return {
        accessToken: body.accessToken,
      };
    };

    await use(login);
  },

  authenticatedRequest: async ({ apiContext }, use) => {
    const createAuthenticatedRequest = (token: string) => ({
      get: async (url: string) => {
        const response = await apiContext.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.json();
      },
      post: async (url: string, data: any) => {
        const response = await apiContext.post(url, {
          data,
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.json();
      },
      put: async (url: string, data: any) => {
        const response = await apiContext.put(url, {
          data,
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.json();
      },
      delete: async (url: string) => {
        const response = await apiContext.delete(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        return response.json();
      },
    });

    await use(createAuthenticatedRequest);
  },
});

export { expect } from '@playwright/test';
