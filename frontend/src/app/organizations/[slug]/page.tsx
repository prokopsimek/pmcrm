'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Building2, Users, Settings, Mail, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { MembersList, InviteMemberDialog } from '@/components/organization';
import { useActiveOrganization, useMyOrganizationRole, useOrganizationMembers, useOrganizationInvitations } from '@/hooks/use-organization';
import { authClient } from '@/lib/auth/client';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout';

/**
 * Organization Details Page
 * Shows organization info, members, and invitations
 */
export default function OrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [organization, setOrganization] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveOrganization } = useActiveOrganization();
  const { isAdmin, role } = useMyOrganizationRole(organization?.id || null);
  const { members } = useOrganizationMembers(organization?.id || null);
  const { invitations } = useOrganizationInvitations(organization?.id || null);

  // Fetch organization by slug
  useEffect(() => {
    const fetchOrganization = async () => {
      try {
        setIsLoading(true);
        // First get list of organizations to find by slug
        // Use the correct method name: 'list' not 'listOrganizations'
        const result = await authClient.organization.list();
        const org = result.data?.find((o: any) => o.slug === slug);

        if (org) {
          setOrganization(org);
          // Set as active organization
          await setActiveOrganization(org.id);
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (slug) {
      fetchOrganization();
    }
  }, [slug, setActiveOrganization]);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="space-y-6">
            <Skeleton className="h-8 w-[100px]" />
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <div>
                    <Skeleton className="h-8 w-[200px] mb-2" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  if (!organization) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <div className="text-center py-8">
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Organization Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The organization you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.
            </p>
            <Button onClick={() => router.push('/organizations')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Organizations
            </Button>
          </div>
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/organizations')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            All Organizations
          </Button>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={organization.logo || undefined} />
                    <AvatarFallback className="text-2xl">
                      {getInitials(organization.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-2xl">{organization.name}</CardTitle>
                    <CardDescription className="text-base">/{organization.slug}</CardDescription>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/organizations/${slug}/settings`)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{members.length} members</span>
                </div>
                {invitations.filter(i => i.status === 'pending').length > 0 && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span>{invitations.filter(i => i.status === 'pending').length} pending invitations</span>
                  </div>
                )}
                {role && (
                  <div className="flex items-center gap-2">
                    <span>Your role: <strong className="capitalize">{role}</strong></span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="members" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="members" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Members
                </TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="invitations" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Invitations
                  </TabsTrigger>
                )}
              </TabsList>
              {isAdmin && (
                <InviteMemberDialog organizationId={organization.id} />
              )}
            </div>

            <TabsContent value="members">
              <Card>
                <CardHeader>
                  <CardTitle>Members</CardTitle>
                  <CardDescription>
                    Manage your organization&apos;s team members
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MembersList organizationId={organization.id} />
                </CardContent>
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="invitations">
                <Card>
                  <CardHeader>
                    <CardTitle>Pending Invitations</CardTitle>
                    <CardDescription>
                      Invitations that have been sent but not yet accepted
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {invitations.filter(i => i.status === 'pending').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p>No pending invitations</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {invitations.filter(i => i.status === 'pending').map((invitation) => (
                          <div
                            key={invitation.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div>
                              <p className="font-medium">{invitation.email}</p>
                              <p className="text-sm text-muted-foreground">
                                Role: <span className="capitalize">{invitation.role}</span> •
                                Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                await authClient.organization.cancelInvitation({
                                  invitationId: invitation.id,
                                });
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}

