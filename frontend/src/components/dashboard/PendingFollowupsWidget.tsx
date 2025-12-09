'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeletons';
import { useMarkFollowupDone, usePendingFollowups, useSnoozeFollowup } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/utils/date';
import { Calendar, CheckCircle, ChevronRight, Clock, UserCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import React from 'react';
import { toast } from 'sonner';

export const PendingFollowupsWidget: React.FC = () => {
  const params = useParams();
  const orgSlug = params?.orgSlug as string | undefined;
  const orgLink = (path: string) => (orgSlug ? `/${orgSlug}${path}` : path);

  const { data: followups, isLoading } = usePendingFollowups({ limit: 10 });
  const markDone = useMarkFollowupDone();
  const snooze = useSnoozeFollowup();

  const handleMarkDone = async (followupId: string, contactName: string) => {
    try {
      await markDone.mutateAsync(followupId);
      toast.success('Follow-up completed', {
        description: `Marked ${contactName} as done`,
      });
    } catch (error) {
      console.error('Failed to mark followup as done:', error);
      toast.error('Failed to mark as done', {
        description: 'Please try again',
      });
    }
  };

  const handleSnooze = async (followupId: string, contactName: string) => {
    try {
      await snooze.mutateAsync({ followupId, days: 7 });
      toast.success('Snoozed for 7 days', {
        description: `Reminder for ${contactName} postponed`,
      });
    } catch (error) {
      console.error('Failed to snooze followup:', error);
      toast.error('Failed to snooze', {
        description: 'Please try again',
      });
    }
  };

  const getRelationshipColor = (strength?: number) => {
    if (!strength) return 'bg-muted';
    if (strength >= 80) return 'bg-green-500';
    if (strength >= 60) return 'bg-blue-500';
    if (strength >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <ListSkeleton items={3} />
        </CardContent>
      </Card>
    );
  }

  if (!followups || followups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending Follow-ups</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="font-medium text-foreground mb-1">All caught up!</p>
            <p className="text-sm text-muted-foreground">No pending follow-ups right now.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Pending Follow-ups</CardTitle>
          <Badge variant="secondary">{followups.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {followups.map((followup, index) => (
            <div
              key={followup.id}
              className={cn(
                'group flex items-start justify-between p-3 rounded-lg border border-border',
                'bg-card hover:bg-accent/50 transition-all duration-200',
                'animate-in fade-in slide-in-from-left-2'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <UserCircle className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={orgLink(`/contacts/${followup.contact.id}`)}
                      className="font-medium text-foreground hover:text-primary truncate transition-colors"
                    >
                      {followup.contact.firstName} {followup.contact.lastName}
                    </Link>
                    {followup.isPastDue && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    )}
                  </div>
                  {followup.contact.company && (
                    <p className="text-sm text-muted-foreground mb-1 truncate">
                      {followup.contact.company}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {followup.lastContactedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDistanceToNow(new Date(followup.lastContactedAt))} ago
                      </span>
                    )}
                    {followup.relationshipStrength !== undefined && (
                      <div className="flex items-center gap-1">
                        <div
                          className={cn(
                            'w-10 h-1.5 rounded-full',
                            getRelationshipColor(followup.relationshipStrength)
                          )}
                        />
                        <span>{followup.relationshipStrength}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    handleSnooze(
                      followup.id,
                      `${followup.contact.firstName} ${followup.contact.lastName}`
                    )
                  }
                  disabled={snooze.isPending}
                  className="h-8 w-8"
                  title="Snooze 7 days"
                >
                  <Clock className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    handleMarkDone(
                      followup.id,
                      `${followup.contact.firstName} ${followup.contact.lastName}`
                    )
                  }
                  disabled={markDone.isPending}
                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                  title="Mark as done"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Link href={orgLink('/reminders')}>
          <Button variant="ghost" className="w-full mt-4 gap-2">
            View all reminders
            <ChevronRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};
