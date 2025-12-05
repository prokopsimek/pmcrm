import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

interface OAuthConfig {
  scopes: string[];
  userId: string;
  provider: 'google' | 'linkedin' | 'microsoft';
  usePKCE?: boolean;
  integration?: string; // Custom integration name for callback URL (e.g., 'gmail' when using Google OAuth)
}

interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
}

/**
 * Shared OAuth Service for handling OAuth 2.0 flows
 * Implements PKCE, token encryption, and provider-agnostic authentication
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly encryptionKey: Buffer | null;
  private readonly algorithm = 'aes-256-gcm';
  private readonly stateStore = new Map<string, { userId: string; timestamp: number }>();

  constructor(private readonly configService: ConfigService) {
    // Try multiple possible env variable names for encryption key
    const key = this.configService.get<string>('OAUTH_ENCRYPTION_KEY');
    if (key) {
      this.encryptionKey = Buffer.from(key, 'hex');
    } else {
      this.logger.warn('OAUTH_ENCRYPTION_KEY not set - OAuth integrations will not be available');
      this.encryptionKey = null;
    }

    // Clean up expired states every 10 minutes
    setInterval(() => this.cleanupExpiredStates(), 10 * 60 * 1000);
  }

  /**
   * Check if OAuth is properly configured for a provider
   */
  isConfigured(provider: string): boolean {
    try {
      this.getClientId(provider);
      this.getClientSecret(provider);
      return this.encryptionKey !== null;
    } catch {
      return false;
    }
  }

  /**
   * Generate OAuth authorization URL with PKCE support
   */
  generateAuthUrl(config: OAuthConfig): string {
    const { scopes, userId, provider, usePKCE = true, integration } = config;

    // Validate configuration before proceeding
    if (!this.encryptionKey) {
      throw new Error(
        'OAuth encryption key not configured. Please set OAUTH_ENCRYPTION_KEY environment variable.',
      );
    }

    const state = this.generateState(userId);
    const redirectUri = this.getRedirectUri(provider, integration);

    const params = new URLSearchParams({
      client_id: this.getClientId(provider),
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    if (usePKCE) {
      const { codeVerifier, codeChallenge } = this.generatePKCE();
      this.storePKCEVerifier(state, codeVerifier);
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    return `${this.getAuthEndpoint(provider)}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(data: {
    code: string;
    provider: string;
    integration?: string;
  }): Promise<OAuthTokens> {
    const { code, provider, integration } = data;

    const body = new URLSearchParams({
      code,
      client_id: this.getClientId(provider),
      client_secret: this.getClientSecret(provider),
      redirect_uri: this.getRedirectUri(provider, integration),
      grant_type: 'authorization_code',
    });

    const response = await fetch(this.getTokenEndpoint(provider), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, provider: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: this.getClientId(provider),
      client_secret: this.getClientSecret(provider),
      grant_type: 'refresh_token',
    });

    const response = await fetch(this.getTokenEndpoint(provider), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Revoke OAuth token
   */
  async revokeToken(token: string, provider: string): Promise<boolean> {
    const revokeUrl = this.getRevokeEndpoint(provider);
    if (!revokeUrl) {
      return false; // Provider doesn't support revocation
    }

    const response = await fetch(revokeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    });

    return response.ok;
  }

  /**
   * Encrypt token using AES-256-GCM
   */
  encryptToken(token: string): string {
    if (!this.encryptionKey) {
      throw new Error('OAuth encryption key not configured');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);

    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt token using AES-256-GCM
   */
  decryptToken(encryptedToken: string): string {
    if (!this.encryptionKey) {
      throw new Error('OAuth encryption key not configured');
    }

    const parts = encryptedToken.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }

    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex!, 'hex');
    const authTag = Buffer.from(authTagHex!, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    const decryptedBuffer = Buffer.concat([
      decipher.update(Buffer.from(encrypted!, 'hex')),
      decipher.final(),
    ]);

    return decryptedBuffer.toString('utf8');
  }

  /**
   * Validate state parameter for CSRF protection
   */
  validateState(state: string, userId: string): boolean {
    const stored = this.stateStore.get(state);
    if (!stored) {
      return false;
    }

    // State expires after 10 minutes
    if (Date.now() - stored.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      return false;
    }

    return stored.userId === userId;
  }

  // Private helper methods

  private generateState(userId: string): string {
    const state = crypto.randomBytes(32).toString('hex');
    this.stateStore.set(state, { userId, timestamp: Date.now() });
    return state;
  }

  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

    return { codeVerifier, codeChallenge };
  }

  private storePKCEVerifier(state: string, verifier: string): void {
    // In production, store in Redis or database
    // For now, using in-memory store
  }

  private cleanupExpiredStates(): void {
    const now = Date.now();
    const expirationTime = 10 * 60 * 1000; // 10 minutes

    for (const [state, data] of this.stateStore.entries()) {
      if (now - data.timestamp > expirationTime) {
        this.stateStore.delete(state);
      }
    }
  }

  private getClientId(provider: string): string {
    // Check both naming conventions: OAUTH_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID
    const clientId =
      this.configService.get<string>(`OAUTH_${provider.toUpperCase()}_CLIENT_ID`) ||
      this.configService.get<string>(`${provider.toUpperCase()}_CLIENT_ID`);

    if (!clientId) {
      throw new Error(
        `OAuth ${provider} client ID not configured. ` +
          `Please set OAUTH_${provider.toUpperCase()}_CLIENT_ID or ${provider.toUpperCase()}_CLIENT_ID environment variable.`,
      );
    }
    return clientId;
  }

  private getClientSecret(provider: string): string {
    // Check both naming conventions: OAUTH_GOOGLE_CLIENT_SECRET and GOOGLE_CLIENT_SECRET
    const clientSecret =
      this.configService.get<string>(`OAUTH_${provider.toUpperCase()}_CLIENT_SECRET`) ||
      this.configService.get<string>(`${provider.toUpperCase()}_CLIENT_SECRET`);

    if (!clientSecret) {
      throw new Error(
        `OAuth ${provider} client secret not configured. ` +
          `Please set OAUTH_${provider.toUpperCase()}_CLIENT_SECRET or ${provider.toUpperCase()}_CLIENT_SECRET environment variable.`,
      );
    }
    return clientSecret;
  }

  private getRedirectUri(provider: string, integration?: string): string {
    // Check multiple possible env variable names for the base URL
    const baseUrl =
      this.configService.get<string>('APP_URL') ||
      this.configService.get<string>('BETTER_AUTH_URL') ||
      this.configService.get<string>('BACKEND_URL') ||
      'http://localhost:3001';

    // Use integration name if provided (e.g., 'gmail' for Gmail using Google OAuth)
    const callbackPath = integration || provider;
    return `${baseUrl}/api/v1/integrations/${callbackPath}/callback`;
  }

  private getAuthEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      linkedin: 'https://www.linkedin.com/oauth/v2/authorization',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    };
    const endpoint = endpoints[provider];
    if (!endpoint) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }
    return endpoint;
  }

  private getTokenEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/token',
      linkedin: 'https://www.linkedin.com/oauth/v2/accessToken',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    };
    const endpoint = endpoints[provider];
    if (!endpoint) {
      throw new Error(`Unknown OAuth provider: ${provider}`);
    }
    return endpoint;
  }

  private getRevokeEndpoint(provider: string): string | null {
    const endpoints: Record<string, string | null> = {
      google: 'https://oauth2.googleapis.com/revoke',
      linkedin: null, // LinkedIn doesn't support token revocation
      microsoft: null,
    };
    return endpoints[provider] ?? null;
  }
}
