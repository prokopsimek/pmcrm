'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building2, Users, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganizations, useActiveOrganization } from '@/hooks/use-organization';
import { ProtectedRoute } from '@/components/auth/protected-route';

/**
 * Organizations List Page
 * Shows all organizations the user belongs to
 * Auto-redirects to first org's dashboard if user has organizations
 */
export default function OrganizationsPage() {
  const router = useRouter();
  const { organizations, isLoading } = useOrganizations();
  const { activeOrganization, setActiveOrganization } = useActiveOrganization();

  // Auto-redirect to active organization's dashboard
  useEffect(() => {
    if (isLoading) return;

    // If user has organizations, redirect to dashboard
    if (organizations.length > 0) {
      // Use active org if set, otherwise first org
      const targetOrg = activeOrganization || organizations[0];
      router.replace(`/${targetOrg.slug}/dashboard`);
    }
    // If no orgs, show the page to create one
  }, [isLoading, organizations, activeOrganization, router]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleOrgClick = async (orgId: string, slug: string) => {
    if (activeOrganization?.id !== orgId) {
      await setActiveOrganization(orgId);
    }
    // Redirect to org dashboard instead of org detail page
    router.push(`/${slug}/dashboard`);
  };

  // Show loading state while checking organizations
  if (isLoading || organizations.length > 0) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {isLoading ? 'Loading...' : 'Redirecting to dashboard...'}
            </p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // Show organization creation prompt when user has no organizations
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome!</h1>
            <p className="text-muted-foreground">
              Create your first organization to get started with your personal network CRM.
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Button
                className="w-full"
                size="lg"
                onClick={() => router.push('/organizations/new')}
              >
                <Plus className="mr-2 h-5 w-5" />
                Create Your Organization
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

