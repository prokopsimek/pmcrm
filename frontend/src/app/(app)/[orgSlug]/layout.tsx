'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useOrganizations, useActiveOrganization } from '@/hooks/use-organization';
import { Loader2 } from 'lucide-react';

/**
 * Layout for organization-scoped routes
 * Validates org slug and sets active organization
 */
export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();
  const orgSlug = params.orgSlug as string;

  const { organizations, isLoading: orgsLoading } = useOrganizations();
  const { setActiveOrganization, activeOrganization } = useActiveOrganization();
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    const validateOrg = async () => {
      if (orgsLoading) return;

      // Find organization by slug
      const org = organizations.find(o => o.slug === orgSlug);

      if (!org) {
        // Organization not found or user doesn't have access
        // Redirect to organizations list
        router.replace('/organizations');
        return;
      }

      // Set active organization if not already set
      if (activeOrganization?.slug !== orgSlug) {
        try {
          await setActiveOrganization(org.id);
        } catch (error) {
          console.error('Failed to set active organization:', error);
          router.replace('/organizations');
          return;
        }
      }

      setIsValidating(false);
    };

    validateOrg();
  }, [orgSlug, organizations, orgsLoading, activeOrganization, setActiveOrganization, router]);

  // Show loading while validating
  if (orgsLoading || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading organization...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}











