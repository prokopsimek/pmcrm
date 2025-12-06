'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useOrganizations, useActiveOrganization, type Organization } from '@/hooks/use-organization';

/**
 * Context value for organization provider
 */
interface OrganizationContextValue {
  // Current organization from URL slug
  currentOrganization: Organization | null;
  // Is currently loading
  isLoading: boolean;
  // Current org slug from URL
  orgSlug: string | null;
  // All user's organizations
  organizations: Organization[];
  // Set active organization (also changes URL)
  setActiveOrganization: (orgId: string) => Promise<void>;
  // Helper to create org-prefixed URL
  orgLink: (path: string) => string;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

/**
 * Provider component for organization context
 * Syncs URL org slug with better-auth active organization
 */
export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const orgSlug = (params.orgSlug as string) || null;

  const { organizations, isLoading: orgsLoading } = useOrganizations();
  const { activeOrganization, setActiveOrganization: setActive, isLoading: activeLoading } = useActiveOrganization();

  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);

  // Sync current organization with URL slug
  useEffect(() => {
    if (!orgSlug || orgsLoading) {
      setCurrentOrganization(null);
      return;
    }

    const org = organizations.find(o => o.slug === orgSlug);
    setCurrentOrganization(org || null);
  }, [orgSlug, organizations, orgsLoading]);

  // Helper to create org-prefixed URLs
  const orgLink = (path: string): string => {
    if (!orgSlug) return path;
    return `/${orgSlug}${path}`;
  };

  const value: OrganizationContextValue = {
    currentOrganization,
    isLoading: orgsLoading || activeLoading,
    orgSlug,
    organizations,
    setActiveOrganization: setActive,
    orgLink,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

/**
 * Hook to access current organization context
 * Must be used within OrganizationProvider
 */
export function useCurrentOrganization() {
  const context = useContext(OrganizationContext);

  if (!context) {
    throw new Error('useCurrentOrganization must be used within OrganizationProvider');
  }

  return context;
}

/**
 * Hook that returns the orgLink helper
 * Safe to use outside of org context (returns identity function)
 */
export function useOrgLink() {
  const params = useParams();
  const orgSlug = params.orgSlug as string | undefined;

  return (path: string): string => {
    if (!orgSlug) return path;
    return `/${orgSlug}${path}`;
  };
}









