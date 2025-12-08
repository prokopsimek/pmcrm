'use client';

import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { useAuth, useDashboardStats } from '@/hooks';
import { StatsGridSkeleton, PageSkeleton } from '@/components/ui';
import {
  StatsWidget,
  PendingFollowupsWidget,
  AIRecommendationsWidget,
  RecentActivityWidget,
  QuickActionsWidget,
} from '@/components/dashboard';
import { AppLayout } from '@/components/layout';
import { Users, Clock, AlertCircle, TrendingUp } from 'lucide-react';

/**
 * Dashboard Page - Central hub for Personal Network CRM
 * Uses AppLayout with sidebar navigation
 */
export default function DashboardPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Helper to create org-prefixed links
  const orgLink = (path: string) => `/${orgSlug}${path}`;

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
              {getTimeGreeting()}, {user?.firstName || 'there'}!
            </h1>
            <p className="text-muted-foreground">
              Here&apos;s what&apos;s happening with your network today.
            </p>
          </div>

          {/* Stats Row */}
          {statsLoading ? (
            <StatsGridSkeleton />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              <StatsWidget
                title="Total Contacts"
                value={stats?.totalContacts || 0}
                change={stats?.contactsChange}
                trend={
                  stats?.contactsChange && stats.contactsChange > 0
                    ? 'up'
                    : stats?.contactsChange && stats.contactsChange < 0
                    ? 'down'
                    : 'neutral'
                }
                icon={<Users className="h-5 w-5" />}
                link={orgLink('/contacts')}
                colorClass="text-blue-600 dark:text-blue-400"
              />
              <StatsWidget
                title="Due Today"
                value={stats?.dueToday || 0}
                change={stats?.dueTodayChange}
                trend={
                  stats?.dueTodayChange && stats.dueTodayChange < 0
                    ? 'up'
                    : stats?.dueTodayChange && stats.dueTodayChange > 0
                    ? 'down'
                    : 'neutral'
                }
                icon={<Clock className="h-5 w-5" />}
                link={orgLink('/reminders')}
                colorClass="text-amber-600 dark:text-amber-400"
              />
              <StatsWidget
                title="Overdue"
                value={stats?.overdue || 0}
                change={stats?.overdueChange}
                trend={
                  stats?.overdueChange && stats.overdueChange < 0
                    ? 'up'
                    : stats?.overdueChange && stats.overdueChange > 0
                    ? 'down'
                    : 'neutral'
                }
                icon={<AlertCircle className="h-5 w-5" />}
                link={orgLink('/reminders?filter=overdue')}
                colorClass="text-destructive"
              />
              <StatsWidget
                title="New This Week"
                value={stats?.newThisWeek || 0}
                change={stats?.newThisWeekChange}
                trend={
                  stats?.newThisWeekChange && stats.newThisWeekChange > 0
                    ? 'up'
                    : stats?.newThisWeekChange && stats.newThisWeekChange < 0
                    ? 'down'
                    : 'neutral'
                }
                icon={<TrendingUp className="h-5 w-5" />}
                colorClass="text-green-600 dark:text-green-400"
              />
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - 2/3 width */}
            <div className="lg:col-span-2 space-y-6">
              <PendingFollowupsWidget />
              <RecentActivityWidget />
            </div>

            {/* Right Column - 1/3 width */}
            <div className="space-y-6">
              <AIRecommendationsWidget />
              <QuickActionsWidget />
            </div>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}











