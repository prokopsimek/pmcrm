import { createAuthClient } from 'better-auth/react';
import { organizationClient } from 'better-auth/client/plugins';

/**
 * Better Auth Client for React
 *
 * This client connects to the backend better-auth API at /api/auth/*
 * Includes organization plugin for multi-tenant support
 */
export const authClient = createAuthClient({
  // Base URL of the backend (not the API path)
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL || 'http://localhost:3001',
  // Organization plugin for multi-tenant support
  plugins: [organizationClient()],
});

// Export all auth methods for convenience
export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  // Organization methods
  organization,
  // Better-auth reactive hooks for organizations
  useListOrganizations,
  useActiveOrganization,
} = authClient;

// Re-export organization for easier access
export const {
  create: createOrganization,
  update: updateOrganization,
  delete: deleteOrganization,
  getFullOrganization,
  setActive: setActiveOrganization,
  list: listOrganizations, // Note: method is 'list', aliased as listOrganizations
  inviteMember,
  acceptInvitation,
  rejectInvitation,
  cancelInvitation,
  removeMember,
  updateMemberRole,
  listMembers,
} = authClient.organization;

