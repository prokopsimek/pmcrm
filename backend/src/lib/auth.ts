import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { organization } from 'better-auth/plugins';
import { Pool } from 'pg';

// Create PostgreSQL connection pool for Prisma 7.x driver adapter
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create adapter for Prisma 7.x
const adapter = new PrismaPg(pool);

// Create Prisma client with adapter
const prisma = new PrismaClient({ adapter });

/**
 * Better Auth Configuration
 *
 * Provides authentication via:
 * - Email and password
 * - Google OAuth
 * - Microsoft OAuth
 *
 * Organization management:
 * - Create and manage organizations
 * - Invite members with roles (owner, admin, member)
 * - Member management and permissions
 */
export const auth = betterAuth({
  // Database configuration using Prisma adapter
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),

  // Base URL for callbacks - will be set from environment
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',

  // Secret key for signing tokens
  secret: process.env.BETTER_AUTH_SECRET,

  // Email and password authentication
  emailAndPassword: {
    enabled: true,
    // Password requirements
    minPasswordLength: 8,
    // Send verification email on signup
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement email sending
      console.log(`Password reset requested for ${user.email}: ${url}`);
    },
  },

  // Social providers
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      // Request offline access for refresh tokens
      accessType: 'offline',
      prompt: 'select_account consent',
      // Map Google profile to user fields
      mapProfileToUser: (profile) => ({
        firstName: profile.given_name,
        lastName: profile.family_name,
        image: profile.picture,
      }),
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      prompt: 'select_account',
      // Map Microsoft profile to user fields
      mapProfileToUser: (profile) => ({
        firstName: profile.givenName || profile.name?.split(' ')[0],
        lastName: profile.surname || profile.name?.split(' ').slice(1).join(' '),
        image: profile.picture,
      }),
    },
  },

  // Custom user schema - map to existing users table structure
  user: {
    modelName: 'user', // Better-auth will use 'user' table
    additionalFields: {
      firstName: {
        type: 'string',
        required: false,
        input: true,
      },
      lastName: {
        type: 'string',
        required: false,
        input: true,
      },
      role: {
        type: 'string',
        required: false,
        defaultValue: 'USER',
        input: false, // Don't allow users to set their own role
      },
      isActive: {
        type: 'boolean',
        required: false,
        defaultValue: true,
        input: false,
      },
    },
  },

  // Session configuration
  session: {
    // Session expiration time (7 days)
    expiresIn: 60 * 60 * 24 * 7,
    // Update session expiration on each request
    updateAge: 60 * 60 * 24, // 1 day
    // Cookie settings
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  // Advanced options
  advanced: {
    // Cookie settings for cross-origin requests
    crossSubDomainCookies: {
      enabled: false, // Set to true if using subdomains
    },
    // Cookie attributes for cross-origin authentication
    // Required when frontend and backend are on different domains
    cookies: {
      session_token: {
        attributes: {
          sameSite: 'none' as const,
          secure: true,
        },
      },
    },
  },

  // Trusted origins for CORS
  trustedOrigins: [process.env.FRONTEND_URL || 'http://localhost:3000'],

  // Plugins
  plugins: [
    organization({
      // Allow any authenticated user to create organizations
      allowUserToCreateOrganization: true,
      // Creator becomes owner by default
      creatorRole: 'owner',
      // Maximum members per organization
      membershipLimit: 100,
      // Invitation expiration (48 hours)
      invitationExpiresIn: 60 * 60 * 48,
      // Send invitation email callback
      sendInvitationEmail: async (data) => {
        const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invitations/${data.id}`;
        // TODO: Integrate with email service (e.g., SendGrid, Resend)
        console.log(`Organization invitation sent to ${data.email}`);
        console.log(`  Organization: ${data.organization.name}`);
        console.log(`  Invited by: ${data.inviter.user.email}`);
        console.log(`  Role: ${data.role}`);
        console.log(`  Invite link: ${inviteLink}`);
      },
    }),
  ],
});

// Export type for the auth instance
export type Auth = typeof auth;
