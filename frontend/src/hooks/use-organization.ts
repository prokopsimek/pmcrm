'use client';

import { useCallback, useEffect, useState } from 'react';
import { authClient } from '@/lib/auth/client';

/**
 * Organization data structure from better-auth
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Member data structure
 */
export interface Member {
  id: string;
  userId: string;
  organizationId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
  };
}

/**
 * Invitation data structure
 */
export interface Invitation {
  id: string;
  email: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  expiresAt: Date;
  organizationId: string;
}

/**
 * Hook for managing organizations
 * Waits for session to be ready before fetching organizations
 */
export function useOrganizations() {
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Use the correct method name: 'list' not 'listOrganizations'
      const result = await authClient.organization.list();
      if (result.data) {
        setOrganizations(result.data as Organization[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch organizations'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Wait for session to be ready before fetching organizations
  useEffect(() => {
    // Don't fetch if session is still loading
    if (isSessionLoading) {
      return;
    }

    // Only fetch if user is authenticated
    if (session?.user) {
      fetchOrganizations();
    } else {
      // Not authenticated, stop loading
      setIsLoading(false);
    }
  }, [isSessionLoading, session?.user, fetchOrganizations]);

  return {
    organizations,
    // Include session loading state in overall loading
    isLoading: isSessionLoading || isLoading,
    error,
    refetch: fetchOrganizations,
  };
}

/**
 * Hook for managing the active organization
 */
export function useActiveOrganization() {
  const { data: session, isPending: isSessionLoading } = authClient.useSession();
  const [activeOrganization, setActiveOrganizationState] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch active organization details when session changes
  useEffect(() => {
    const fetchActiveOrg = async () => {
      if (!session?.session?.activeOrganizationId) {
        setActiveOrganizationState(null);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const result = await authClient.organization.getFullOrganization({
          query: { organizationId: session.session.activeOrganizationId },
        });
        if (result.data) {
          setActiveOrganizationState(result.data as unknown as Organization);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch active organization'));
      } finally {
        setIsLoading(false);
      }
    };

    if (!isSessionLoading) {
      fetchActiveOrg();
    }
  }, [session?.session?.activeOrganizationId, isSessionLoading]);

  const setActiveOrganization = useCallback(async (organizationId: string) => {
    try {
      setIsLoading(true);
      await authClient.organization.setActive({ organizationId });
      // Refresh to get the updated org
      const result = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (result.data) {
        setActiveOrganizationState(result.data as unknown as Organization);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to set active organization'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    activeOrganization,
    activeOrganizationId: session?.session?.activeOrganizationId || null,
    isLoading: isLoading || isSessionLoading,
    error,
    setActiveOrganization,
  };
}

/**
 * Hook for creating an organization
 */
export function useCreateOrganization() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createOrganization = useCallback(async (data: { name: string; slug?: string; logo?: string }) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await authClient.organization.create({
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
        logo: data.logo,
      });
      return result.data as unknown as Organization;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create organization');
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    createOrganization,
    isLoading,
    error,
  };
}

/**
 * Hook for managing organization members
 */
export function useOrganizationMembers(organizationId: string | null) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (result.data?.members) {
        setMembers(result.data.members as unknown as Member[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch members'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!organizationId) return;
    await authClient.organization.removeMember({
      organizationId,
      memberIdOrEmail: memberId,
    });
    await fetchMembers();
  }, [organizationId, fetchMembers]);

  const updateRole = useCallback(async (memberId: string, role: 'admin' | 'member') => {
    if (!organizationId) return;
    await authClient.organization.updateMemberRole({
      organizationId,
      memberId,
      role,
    });
    await fetchMembers();
  }, [organizationId, fetchMembers]);

  return {
    members,
    isLoading,
    error,
    refetch: fetchMembers,
    removeMember,
    updateRole,
  };
}

/**
 * Hook for managing organization invitations
 */
export function useOrganizationInvitations(organizationId: string | null) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!organizationId) {
      setInvitations([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const result = await authClient.organization.getFullOrganization({
        query: { organizationId },
      });
      if (result.data?.invitations) {
        setInvitations(result.data.invitations as unknown as Invitation[]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch invitations'));
    } finally {
      setIsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const invite = useCallback(async (email: string, role: 'admin' | 'member') => {
    if (!organizationId) return;
    await authClient.organization.inviteMember({
      organizationId,
      email,
      role,
    });
    await fetchInvitations();
  }, [organizationId, fetchInvitations]);

  const cancelInvitation = useCallback(async (invitationId: string) => {
    await authClient.organization.cancelInvitation({ invitationId });
    await fetchInvitations();
  }, [fetchInvitations]);

  return {
    invitations,
    isLoading,
    error,
    refetch: fetchInvitations,
    invite,
    cancelInvitation,
  };
}

/**
 * Hook for the current user's role in an organization
 */
export function useMyOrganizationRole(organizationId: string | null) {
  const { data: session } = authClient.useSession();
  const { members } = useOrganizationMembers(organizationId);

  const myRole = members.find(m => m.userId === session?.user?.id)?.role || null;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin' || myRole === 'owner';
  const isMember = myRole !== null;

  return {
    role: myRole,
    isOwner,
    isAdmin,
    isMember,
  };
}

