/**
 * Authentication helpers for testing
 */
import * as jwt from 'jsonwebtoken';

export interface TestAuthPayload {
  userId: string;
  email: string;
  subscriptionTier?: string;
  roles?: string[];
}

export class AuthTestHelper {
  private static readonly SECRET = 'test-secret-key';
  private static readonly EXPIRY = '1h';

  /**
   * Generate a test JWT token
   */
  static generateToken(payload: TestAuthPayload): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: this.EXPIRY,
      issuer: 'pmcrm-test',
    });
  }

  /**
   * Generate authorization header
   */
  static generateAuthHeader(payload: TestAuthPayload): { Authorization: string } {
    const token = this.generateToken(payload);
    return { Authorization: `Bearer ${token}` };
  }

  /**
   * Create a test user payload
   */
  static createUserPayload(overrides: Partial<TestAuthPayload> = {}): TestAuthPayload {
    return {
      userId: 'test-user-id',
      email: 'test@example.com',
      subscriptionTier: 'free',
      roles: ['user'],
      ...overrides,
    };
  }

  /**
   * Create an admin user payload
   */
  static createAdminPayload(overrides: Partial<TestAuthPayload> = {}): TestAuthPayload {
    return this.createUserPayload({
      ...overrides,
      roles: ['user', 'admin'],
    });
  }

  /**
   * Verify a token (for testing token verification)
   */
  static verifyToken(token: string): TestAuthPayload {
    return jwt.verify(token, this.SECRET) as TestAuthPayload;
  }

  /**
   * Create expired token for testing
   */
  static generateExpiredToken(payload: TestAuthPayload): string {
    return jwt.sign(payload, this.SECRET, {
      expiresIn: '-1h', // Already expired
      issuer: 'pmcrm-test',
    });
  }
}
