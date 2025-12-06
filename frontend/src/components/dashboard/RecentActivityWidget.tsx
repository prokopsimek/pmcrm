'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  UserPlus,
  Mail,
  Calendar,
  Link as LinkIcon,
  FileText,
  CheckCircle,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { useRecentActivity } from '@/hooks';
import { formatDistanceToNow } from '@/lib/utils/date';
import type { ActivityItem } from '@/types';
import { cn } from '@/lib/utils';

export const RecentActivityWidget: React.FC = () => {
  const { data: activities, isLoading } = useRecentActivity({ limit: 20 });
  const [showAll, setShowAll] = React.useState(false);

  const getActivityIcon = (type: ActivityItem['type']) => {
    const iconClass = 'h-4 w-4';
    switch (type) {
      case 'contact_added':
        return <UserPlus className={iconClass} />;
      case 'email_sent':
        return <Mail className={iconClass} />;
      case 'meeting':
        return <Calendar className={iconClass} />;
      case 'integration_connected':
        return <LinkIcon className={iconClass} />;
      case 'note_added':
        return <FileText className={iconClass} />;
      case 'reminder_completed':
        return <CheckCircle className={iconClass} />;
      default:
        return <Activity className={iconClass} />;
    }
  };

  const getActivityColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'contact_added':
        return 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400';
      case 'email_sent':
        return 'bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400';
      case 'meeting':
        return 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400';
      case 'integration_connected':
        return 'bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400';
      case 'note_added':
        return 'bg-muted text-muted-foreground';
      case 'reminder_completed':
        return 'bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ListSkeleton items={5} />
        </CardContent>
      </Card>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Activity className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground mb-1">No activity yet</p>
            <p className="text-sm text-muted-foreground">
              Start adding contacts and interactions to see activity here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayedActivities = showAll ? activities : activities.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {displayedActivities.map((activity, index) => (
              <div
                key={activity.id}
                className={cn(
                  'flex items-start gap-3 relative animate-in fade-in slide-in-from-left-2'
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <div
                  className={cn(
                    'relative z-10 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background',
                    getActivityColor(activity.type)
                  )}
                >
                  {getActivityIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-foreground">
                    {activity.description}
                    {activity.contact && (
                      <>
                        {' '}
                        <Link
                          href={`/contacts/${activity.contact.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {activity.contact.firstName} {activity.contact.lastName}
                        </Link>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(activity.timestamp))} ago
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {activities.length > 10 && !showAll && (
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => setShowAll(true)}
          >
            Show all ({activities.length} items)
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {showAll && activities.length > 10 && (
          <Button
            variant="ghost"
            className="w-full mt-4"
            onClick={() => setShowAll(false)}
          >
            Show less
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
