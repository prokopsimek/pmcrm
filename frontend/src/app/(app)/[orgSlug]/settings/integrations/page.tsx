'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { PageSkeleton } from '@/components/ui/skeletons';
import { Switch } from '@/components/ui/switch';
import {
    useDisconnectGmailIntegration,
    useDisconnectGoogleCalendar,
    useDisconnectGoogleIntegration,
    useGmailConfig,
    useGmailIntegrationStatus,
    useGoogleCalendarAvailableCalendars,
    useGoogleCalendarConfig,
    useGoogleCalendarStatus,
    useGoogleIntegrationStatus,
    useInitiateGmailAuth,
    useInitiateGoogleAuth,
    useInitiateGoogleCalendarAuth,
    useSyncGmailEmails,
    useSyncGoogleCalendar,
    useSyncGoogleContacts,
    useUpdateGmailConfig,
    useUpdateGoogleCalendarConfig,
} from '@/hooks';
import { formatDistanceToNow } from 'date-fns';
import { Calendar, Link2, Loader2, Mail, MessageSquare, RefreshCw, Settings2, Shield, ShieldCheck } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Integrations Settings Page
 * Manage all third-party integrations
 */
export default function IntegrationsPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showGmailSettings, setShowGmailSettings] = useState(false);
  const [showCalendarSettings, setShowCalendarSettings] = useState(false);
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<string | null>(null);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [syncPeriodDays, setSyncPeriodDays] = useState<number>(30);

  // Helper to create org-prefixed links
  const orgLink = (path: string) => `/${orgSlug}${path}`;

  // Handle OAuth callback query params (success/error messages)
  useEffect(() => {
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    const message = searchParams.get('message');
    const showCalendarSelect = searchParams.get('showCalendarSelect');

    if (success) {
      const integrationName =
        success === 'google' ? 'Google Contacts' :
        success === 'gmail' ? 'Gmail' :
        success === 'google-calendar' ? 'Google Calendar' :
        success;
      const defaultDescription =
        success === 'gmail' ? 'Email sync is now enabled.' :
        success === 'google-calendar' ? 'Select which calendars to sync.' :
        'You can now import your contacts.';
      toast.success(`${integrationName} connected successfully!`, {
        description: message || defaultDescription,
      });

      // Auto-open calendar selection modal after successful calendar connection
      if (showCalendarSelect === 'true' && (success === 'google-calendar' || success === 'outlook-calendar')) {
        setShowCalendarSettings(true);
      }

      // Clean up URL
      router.replace(orgLink('/settings/integrations'));
    } else if (error) {
      toast.error('Connection failed', {
        description: message || 'Please try again.',
      });
      // Clean up URL
      router.replace(orgLink('/settings/integrations'));
    }
  }, [searchParams, router, orgSlug]);

  // Google Contacts specific
  const { data: googleStatus, isLoading: isLoadingGoogleStatus } = useGoogleIntegrationStatus();
  const initiateGoogleAuth = useInitiateGoogleAuth();
  const disconnectGoogle = useDisconnectGoogleIntegration();

  // Gmail specific
  const { data: gmailStatus, isLoading: isLoadingGmailStatus } = useGmailIntegrationStatus();
  const { data: gmailConfig } = useGmailConfig();
  const initiateGmailAuth = useInitiateGmailAuth();
  const updateGmailConfig = useUpdateGmailConfig();
  const syncGmailEmails = useSyncGmailEmails();
  const disconnectGmail = useDisconnectGmailIntegration();

  // Google Calendar specific
  const { data: calendarStatus, isLoading: isLoadingCalendarStatus } = useGoogleCalendarStatus();
  const initiateCalendarAuth = useInitiateGoogleCalendarAuth();
  const disconnectCalendar = useDisconnectGoogleCalendar();
  const { data: availableCalendars, isLoading: isLoadingCalendars } = useGoogleCalendarAvailableCalendars();
  const { data: calendarConfig } = useGoogleCalendarConfig();
  const updateCalendarConfig = useUpdateGoogleCalendarConfig();
  const syncGoogleCalendar = useSyncGoogleCalendar();

  // Google Contacts sync
  const syncGoogleContacts = useSyncGoogleContacts();

  // Rate limiting state for manual sync (production only)
  const [syncCooldowns, setSyncCooldowns] = useState<Record<string, number>>({});
  const [confirmSyncDialog, setConfirmSyncDialog] = useState<{
    open: boolean;
    integration: 'google-contacts' | 'google-calendar' | null;
  }>({ open: false, integration: null });

  // Check if we're in production environment
  const isProduction = process.env.NODE_ENV === 'production';

  // Load cooldowns from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && isProduction) {
      const stored = localStorage.getItem('sync_cooldowns');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSyncCooldowns(parsed);
        } catch {
          // Invalid data, reset
          localStorage.removeItem('sync_cooldowns');
        }
      }
    }
  }, [isProduction]);

  // Save cooldowns to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined' && isProduction && Object.keys(syncCooldowns).length > 0) {
      localStorage.setItem('sync_cooldowns', JSON.stringify(syncCooldowns));
    }
  }, [syncCooldowns, isProduction]);

  // Check if sync is within the hard cooldown (1 hour after confirmed sync)
  const isSyncDisabled = (integration: string): boolean => {
    if (!isProduction) return false;
    const cooldownEnd = syncCooldowns[`${integration}_hard`];
    if (!cooldownEnd) return false;
    return Date.now() < cooldownEnd;
  };

  // Check if user can sync without confirmation (more than 1 hour since last sync)
  const canSyncWithoutConfirm = (integration: string): boolean => {
    if (!isProduction) return true;
    const lastSync = syncCooldowns[`${integration}_soft`];
    if (!lastSync) return true;
    const oneHour = 60 * 60 * 1000;
    return Date.now() - lastSync > oneHour;
  };

  // Get remaining cooldown time in minutes
  const getRemainingCooldown = (integration: string): number => {
    const cooldownEnd = syncCooldowns[`${integration}_hard`];
    if (!cooldownEnd) return 0;
    const remaining = cooldownEnd - Date.now();
    return Math.max(0, Math.ceil(remaining / (60 * 1000)));
  };

  // Execute the actual sync
  const executeSync = (integration: 'google-contacts' | 'google-calendar') => {
    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    if (integration === 'google-contacts') {
      syncGoogleContacts.mutate(undefined, {
        onSuccess: (result) => {
          toast.success('Google Contacts synced', {
            description: `Added: ${result.added}, Updated: ${result.updated}, Deleted: ${result.deleted}`,
          });
          // Set soft cooldown (for confirmation dialog)
          setSyncCooldowns((prev) => ({
            ...prev,
            [`${integration}_soft`]: now,
          }));
        },
        onError: () => {
          toast.error('Google Contacts sync failed', {
            description: 'Please try again later.',
          });
        },
      });
    } else if (integration === 'google-calendar') {
      syncGoogleCalendar.mutate(undefined, {
        onSuccess: (result) => {
          toast.success('Google Calendar synced', {
            description: `Synced ${result.synced} events`,
          });
          // Set soft cooldown (for confirmation dialog)
          setSyncCooldowns((prev) => ({
            ...prev,
            [`${integration}_soft`]: now,
          }));
        },
        onError: () => {
          toast.error('Google Calendar sync failed', {
            description: 'Please try again later.',
          });
        },
      });
    }
  };

  // Handle sync button click
  const handleSyncClick = (integration: 'google-contacts' | 'google-calendar') => {
    if (isSyncDisabled(integration)) {
      const remaining = getRemainingCooldown(integration);
      toast.info(`Sync unavailable`, {
        description: `Please wait ${remaining} more minute${remaining !== 1 ? 's' : ''} before syncing again.`,
      });
      return;
    }

    if (canSyncWithoutConfirm(integration)) {
      executeSync(integration);
    } else {
      // Show confirmation dialog
      setConfirmSyncDialog({ open: true, integration });
    }
  };

  // Handle confirmed sync (sets hard cooldown)
  const handleConfirmSync = () => {
    const integration = confirmSyncDialog.integration;
    if (!integration) return;

    const oneHour = 60 * 60 * 1000;
    const now = Date.now();

    // Set hard cooldown (button disabled for 1 hour)
    setSyncCooldowns((prev) => ({
      ...prev,
      [`${integration}_hard`]: now + oneHour,
      [`${integration}_soft`]: now,
    }));

    executeSync(integration);
    setConfirmSyncDialog({ open: false, integration: null });
  };

  // Pre-select primary calendar when modal opens after new connection
  useEffect(() => {
    if (showCalendarSettings && availableCalendars?.calendars && selectedCalendarIds.length === 0) {
      const primaryCalendar = availableCalendars.calendars.find(c => c.isPrimary);
      if (primaryCalendar) {
        setSelectedCalendarIds([primaryCalendar.id]);
      }
    }
  }, [showCalendarSettings, availableCalendars, selectedCalendarIds.length]);

  const handleConnectGoogle = () => {
    initiateGoogleAuth.mutate(orgSlug, {
      onError: () => {
        toast.error('Failed to connect Google', {
          description: 'Please try again later.',
        });
      },
    });
  };

  const handleConnectGmail = () => {
    initiateGmailAuth.mutate(orgSlug, {
      onError: () => {
        toast.error('Failed to connect Gmail', {
          description: 'Please try again later.',
        });
      },
    });
  };

  const handleConnectGoogleCalendar = () => {
    initiateCalendarAuth.mutate(orgSlug, {
      onError: () => {
        toast.error('Failed to connect Google Calendar', {
          description: 'Please try again later.',
        });
      },
    });
  };

  const handleDisconnectClick = (target: string) => {
    setDisconnectTarget(target);
    setDisconnectDialogOpen(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!disconnectTarget) return;

    try {
      if (disconnectTarget === 'google') {
        await disconnectGoogle.mutateAsync();
        toast.success('Google Contacts disconnected', {
          description: 'Your imported contacts will remain in your account.',
        });
      } else if (disconnectTarget === 'gmail') {
        await disconnectGmail.mutateAsync();
        toast.success('Gmail disconnected', {
          description: 'Your synced emails will remain in your account.',
        });
      } else if (disconnectTarget === 'googleCalendar') {
        await disconnectCalendar.mutateAsync();
        toast.success('Google Calendar disconnected', {
          description: 'Your imported contacts will remain in your account.',
        });
      }
      setDisconnectDialogOpen(false);
      setDisconnectTarget(null);
    } catch {
      toast.error('Failed to disconnect', {
        description: 'Please try again later.',
      });
    }
  };

  const handleManageGoogle = () => {
    router.push(orgLink('/contacts/import/google'));
  };

  const handleManageGmail = () => {
    setShowGmailSettings(true);
  };

  const handleManageGoogleCalendar = () => {
    // Initialize selected calendars and sync period from current config
    setSelectedCalendarIds(calendarConfig?.selectedCalendarIds || []);
    setSyncPeriodDays(calendarConfig?.syncPeriodDays || 30);
    setShowCalendarSettings(true);
  };

  const handleCalendarSelectionToggle = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleSaveCalendarSelection = () => {
    updateCalendarConfig.mutate({ selectedCalendarIds, syncPeriodDays }, {
      onSuccess: () => {
        toast.success('Calendar selection saved', {
          description:
            selectedCalendarIds.length > 0
              ? `${selectedCalendarIds.length} calendar(s) selected for contact import.`
              : 'No calendars selected.',
        });
        setShowCalendarSettings(false);
      },
      onError: () => {
        toast.error('Failed to save calendar selection', {
          description: 'Please try again later.',
        });
      },
    });
  };

  const handleSyncGmail = () => {
    syncGmailEmails.mutate(undefined, {
      onSuccess: (result) => {
        toast.success('Gmail sync started', {
          description: result.message,
        });
      },
      onError: () => {
        toast.error('Gmail sync failed', {
          description: 'Please try again later.',
        });
      },
    });
  };

  const handleToggleSyncEnabled = (enabled: boolean) => {
    updateGmailConfig.mutate(
      { syncEnabled: enabled },
      {
        onSuccess: () => {
          toast.success(enabled ? 'Email sync enabled' : 'Email sync disabled');
        },
        onError: () => {
          toast.error('Failed to update settings');
        },
      }
    );
  };

  const handleTogglePrivacyMode = (privacyMode: boolean) => {
    updateGmailConfig.mutate(
      { privacyMode },
      {
        onSuccess: () => {
          toast.success(
            privacyMode
              ? 'Privacy mode enabled - only email metadata will be synced'
              : 'Full content mode enabled - email bodies will be synced for AI analysis'
          );
        },
        onError: () => {
          toast.error('Failed to update settings');
        },
      }
    );
  };

  if (isLoadingGoogleStatus || isLoadingGmailStatus || isLoadingCalendarStatus) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <PageSkeleton />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
            <p className="text-muted-foreground">
              Connect your favorite tools to sync contacts and communications
            </p>
          </div>

          {/* Contact Sources Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Contact Sources
              </CardTitle>
              <CardDescription>
                Import contacts from external services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Google Contacts */}
                <IntegrationCard
                  type="GOOGLE_CONTACTS"
                  name="Google Contacts"
                  description="Import and sync contacts from your Google account"
                  icon={
                    <svg className="h-7 w-7" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  }
                  status={googleStatus?.isConnected ? 'ACTIVE' : 'DISCONNECTED'}
                  isConnected={googleStatus?.isConnected || false}
                  isLoading={initiateGoogleAuth.isPending || disconnectGoogle.isPending}
                  onConnect={handleConnectGoogle}
                  onDisconnect={() => handleDisconnectClick('google')}
                  onManage={handleManageGoogle}
                  customActions={
                    googleStatus?.isConnected && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncClick('google-contacts')}
                          disabled={isSyncDisabled('google-contacts') || syncGoogleContacts.isPending}
                          title={isSyncDisabled('google-contacts') ? `Wait ${getRemainingCooldown('google-contacts')} min` : undefined}
                        >
                          {syncGoogleContacts.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1 sr-only md:not-sr-only">Sync Now</span>
                        </Button>
                      </div>
                    )
                  }
                />

                {/* Microsoft Graph */}
                <IntegrationCard
                  type="MICROSOFT_GRAPH"
                  name="Microsoft 365"
                  description="Import contacts from Outlook and Microsoft 365"
                  icon={
                    <svg className="h-7 w-7" viewBox="0 0 24 24">
                      <path
                        fill="#F25022"
                        d="M0 0h11.377v11.372H0z"
                      />
                      <path
                        fill="#00A4EF"
                        d="M12.623 0H24v11.372H12.623z"
                      />
                      <path
                        fill="#7FBA00"
                        d="M0 12.623h11.377V24H0z"
                      />
                      <path
                        fill="#FFB900"
                        d="M12.623 12.623H24V24H12.623z"
                      />
                    </svg>
                  }
                  status="DISCONNECTED"
                  isConnected={false}
                  onConnect={() => toast.info('Microsoft integration coming soon!')}
                  onDisconnect={() => {}}
                />
              </div>
            </CardContent>
          </Card>

          {/* Calendar Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Calendar
              </CardTitle>
              <CardDescription>
                Import contacts from calendar meeting attendees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Google Calendar */}
                <IntegrationCard
                  type="GOOGLE_CALENDAR"
                  name="Google Calendar"
                  description={
                    calendarStatus?.isConnected
                      ? calendarStatus.isConfigured
                        ? `${calendarStatus.selectedCalendarIds?.length || 0} calendar(s) selected for import`
                        : 'Connected - select calendars to enable import'
                      : 'Import contacts from meeting attendees'
                  }
                  icon={
                    <svg className="h-7 w-7" viewBox="0 0 200 200">
                      <rect fill="#fff" height="200" width="200"/>
                      <rect fill="#4285f4" height="148" rx="8" width="148" x="26" y="26"/>
                      <rect fill="#fff" height="120" rx="4" width="120" x="40" y="54"/>
                      <rect fill="#ea4335" height="12" width="34" x="48" y="88"/>
                      <rect fill="#ea4335" height="12" width="34" x="48" y="112"/>
                      <rect fill="#ea4335" height="12" width="34" x="48" y="136"/>
                      <rect fill="#34a853" height="12" width="34" x="90" y="88"/>
                      <rect fill="#34a853" height="12" width="34" x="90" y="112"/>
                      <rect fill="#34a853" height="12" width="34" x="90" y="136"/>
                      <rect fill="#fbbc05" height="12" width="34" x="132" y="88"/>
                      <rect fill="#fbbc05" height="12" width="34" x="132" y="112"/>
                      <rect fill="#fbbc05" height="12" width="34" x="132" y="136"/>
                    </svg>
                  }
                  status={calendarStatus?.isConnected ? (calendarStatus.isConfigured ? 'ACTIVE' : 'PENDING') : 'DISCONNECTED'}
                  isConnected={calendarStatus?.isConnected || false}
                  isLoading={initiateCalendarAuth.isPending || disconnectCalendar.isPending}
                  onConnect={handleConnectGoogleCalendar}
                  onDisconnect={() => handleDisconnectClick('googleCalendar')}
                  onManage={handleManageGoogleCalendar}
                  customActions={
                    calendarStatus?.isConnected && calendarStatus.isConfigured && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSyncClick('google-calendar')}
                          disabled={isSyncDisabled('google-calendar') || syncGoogleCalendar.isPending}
                          title={isSyncDisabled('google-calendar') ? `Wait ${getRemainingCooldown('google-calendar')} min` : undefined}
                        >
                          {syncGoogleCalendar.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1 sr-only md:not-sr-only">Sync Now</span>
                        </Button>
                      </div>
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Email Integration Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email
              </CardTitle>
              <CardDescription>
                Connect your email for communication tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Gmail */}
                <IntegrationCard
                  type="GMAIL"
                  name="Gmail"
                  description="Track email communications with your contacts"
                  icon={
                    <svg className="h-7 w-7" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/>
                    </svg>
                  }
                  status={gmailStatus?.isConnected ? 'ACTIVE' : 'DISCONNECTED'}
                  isConnected={gmailStatus?.isConnected || false}
                  isLoading={initiateGmailAuth.isPending || disconnectGmail.isPending}
                  onConnect={handleConnectGmail}
                  onDisconnect={() => handleDisconnectClick('gmail')}
                  onManage={handleManageGmail}
                  customActions={
                    gmailStatus?.isConnected && (
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant={gmailStatus.privacyMode ? 'secondary' : 'default'} className="text-xs">
                          {gmailStatus.privacyMode ? (
                            <>
                              <Shield className="h-3 w-3 mr-1" />
                              Privacy Mode
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              Full Sync
                            </>
                          )}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSyncGmail}
                          disabled={syncGmailEmails.isPending}
                        >
                          {syncGmailEmails.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4" />
                          )}
                          <span className="ml-1 sr-only md:not-sr-only">Sync Now</span>
                        </Button>
                      </div>
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Communication Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Communication
              </CardTitle>
              <CardDescription>
                Connect messaging platforms for better tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* WhatsApp Business */}
                <IntegrationCard
                  type="WHATSAPP_BUSINESS"
                  name="WhatsApp Business"
                  description="Connect WhatsApp Business for messaging"
                  icon={
                    <svg className="h-7 w-7" viewBox="0 0 24 24">
                      <path
                        fill="#25D366"
                        d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"
                      />
                    </svg>
                  }
                  status="DISCONNECTED"
                  isConnected={false}
                  onConnect={() => toast.info('WhatsApp integration coming soon!')}
                  onDisconnect={() => {}}
                />

                {/* LinkedIn - Coming Soon Card */}
                <Card className="border border-border hover:border-primary/50 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                        <svg className="h-7 w-7" viewBox="0 0 24 24">
                          <path
                            fill="#0A66C2"
                            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">LinkedIn</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Connect LinkedIn for professional networking
                        </p>
                        <div className="mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toast.info('LinkedIn integration coming soon!')}
                          >
                            Coming Soon
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disconnect Confirmation Dialog */}
        <Dialog open={disconnectDialogOpen} onOpenChange={setDisconnectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect Integration</DialogTitle>
              <DialogDescription>
                Are you sure you want to disconnect this integration?{' '}
                {disconnectTarget === 'gmail'
                  ? 'Your synced emails will remain in your account.'
                  : 'Your imported contacts will remain in your account.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDisconnectDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnectConfirm}
                disabled={disconnectGoogle.isPending || disconnectGmail.isPending || disconnectCalendar.isPending}
              >
                {(disconnectGoogle.isPending || disconnectGmail.isPending || disconnectCalendar.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  'Disconnect'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Gmail Settings Dialog */}
        <Dialog open={showGmailSettings} onOpenChange={setShowGmailSettings}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Gmail Settings
              </DialogTitle>
              <DialogDescription>
                Configure how your emails are synced with your contacts
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Sync Status */}
              {gmailStatus && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={gmailStatus.isActive ? 'default' : 'secondary'}>
                      {gmailStatus.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Emails Synced</span>
                    <span className="font-medium">{gmailStatus.totalEmailsSynced}</span>
                  </div>
                  {gmailStatus.lastSyncAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last Sync</span>
                      <span className="font-medium">
                        {formatDistanceToNow(new Date(gmailStatus.lastSyncAt), { addSuffix: true })}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Sync Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sync-enabled">Automatic Sync</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically sync emails every 6 hours
                    </p>
                  </div>
                  <Switch
                    id="sync-enabled"
                    checked={gmailConfig?.syncEnabled ?? true}
                    onCheckedChange={handleToggleSyncEnabled}
                    disabled={updateGmailConfig.isPending}
                  />
                </div>

                <Separator />

                {/* Privacy Mode Setting */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="privacy-mode" className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Privacy Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Only sync email metadata (date, subject, snippet)
                      </p>
                    </div>
                    <Switch
                      id="privacy-mode"
                      checked={gmailConfig?.privacyMode ?? true}
                      onCheckedChange={handleTogglePrivacyMode}
                      disabled={updateGmailConfig.isPending}
                    />
                  </div>

                  {/* Privacy Mode Explanation */}
                  <div className={`rounded-lg p-3 text-sm ${gmailConfig?.privacyMode ? 'bg-green-500/10 border border-green-500/20' : 'bg-blue-500/10 border border-blue-500/20'}`}>
                    {gmailConfig?.privacyMode ? (
                      <div className="flex items-start gap-2">
                        <Shield className="h-4 w-4 mt-0.5 text-green-500" />
                        <div>
                          <p className="font-medium text-green-600 dark:text-green-400">Privacy Mode Enabled</p>
                          <p className="text-muted-foreground mt-1">
                            Only email metadata is stored. Email content is not saved to protect your privacy.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="h-4 w-4 mt-0.5 text-blue-500" />
                        <div>
                          <p className="font-medium text-blue-600 dark:text-blue-400">Full Content Mode</p>
                          <p className="text-muted-foreground mt-1">
                            Email bodies are stored for AI-powered features like summaries, sentiment analysis, and smart suggestions.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={handleSyncGmail}
                disabled={syncGmailEmails.isPending}
                className="w-full sm:w-auto"
              >
                {syncGmailEmails.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Now
                  </>
                )}
              </Button>
              <Button
                onClick={() => setShowGmailSettings(false)}
                className="w-full sm:w-auto"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Google Calendar Selection Dialog */}
        <Dialog open={showCalendarSettings} onOpenChange={setShowCalendarSettings}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Google Calendar Settings
              </DialogTitle>
              <DialogDescription>
                Select which calendars to use for importing contacts from meeting attendees
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status */}
              {calendarConfig && (
                <div className="rounded-lg bg-muted p-4">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <div className="text-right">
                      <Badge variant={calendarConfig.isConfigured ? 'default' : 'secondary'}>
                        {calendarConfig.isConfigured ? 'Configured' : 'Not configured'}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground">Calendars Selected</span>
                    <span className="font-medium text-right">{calendarConfig.selectedCalendarIds.length}</span>
                    {calendarConfig.lastSyncAt && (
                      <>
                        <span className="text-muted-foreground">Last Import</span>
                        <span className="font-medium text-right">
                          {formatDistanceToNow(new Date(calendarConfig.lastSyncAt), { addSuffix: true })}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Sync Period */}
              <div className="space-y-2">
                <Label>Sync period</Label>
                <Select
                  value={syncPeriodDays.toString()}
                  onValueChange={(value) => setSyncPeriodDays(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="14">Last 14 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="60">Last 60 days</SelectItem>
                    <SelectItem value="90">Last 3 months</SelectItem>
                    <SelectItem value="180">Last 6 months</SelectItem>
                    <SelectItem value="365">Last 1 year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Import contacts from meetings in this time period
                </p>
              </div>

              <Separator />

              {/* Calendar List */}
              <div className="space-y-2">
                <Label>Select calendars</Label>
                {isLoadingCalendars ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : availableCalendars?.calendars && availableCalendars.calendars.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {availableCalendars.calendars.map((calendar) => (
                      <label
                        key={calendar.id}
                        htmlFor={`calendar-${calendar.id}`}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          id={`calendar-${calendar.id}`}
                          checked={selectedCalendarIds.includes(calendar.id)}
                          onCheckedChange={() => handleCalendarSelectionToggle(calendar.id)}
                          className="mt-0.5"
                        />
                        {calendar.color && (
                          <div
                            className="w-3 h-3 rounded-full shrink-0 mt-1"
                            style={{ backgroundColor: calendar.color }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{calendar.name}</span>
                            {calendar.isPrimary && (
                              <Badge variant="outline" className="text-xs shrink-0">Primary</Badge>
                            )}
                          </div>
                          {calendar.description && (
                            <p className="text-sm text-muted-foreground mt-0.5 break-words">
                              {calendar.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No calendars found
                  </p>
                )}
              </div>

              {selectedCalendarIds.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Select at least one calendar to enable contact import from meetings.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCalendarSettings(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveCalendarSelection}
                disabled={updateCalendarConfig.isPending}
              >
                {updateCalendarConfig.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Selection'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sync Confirmation Dialog (production only) */}
        <AlertDialog
          open={confirmSyncDialog.open}
          onOpenChange={(open) => setConfirmSyncDialog({ ...confirmSyncDialog, open })}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sync Again?</AlertDialogTitle>
              <AlertDialogDescription>
                You synced less than an hour ago. Are you sure you want to sync again?
                After confirming, you won&apos;t be able to sync for 1 hour.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmSync}>
                Sync Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AppLayout>
    </ProtectedRoute>
  );
}
