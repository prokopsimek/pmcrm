'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams, useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ListSkeleton } from '@/components/ui/skeletons';
import {
  Bell,
  Plus,
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle,
  MoreHorizontal,
  User,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Mock reminders data - replace with actual API hook
const mockReminders = [
  {
    id: '1',
    title: 'Follow up with John about project',
    contact: { firstName: 'John', lastName: 'Doe' },
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    type: 'follow_up',
    status: 'pending',
  },
  {
    id: '2',
    title: 'Send proposal to client',
    contact: { firstName: 'Jane', lastName: 'Smith' },
    dueDate: new Date().toISOString(),
    type: 'task',
    status: 'pending',
  },
  {
    id: '3',
    title: 'Weekly check-in call',
    contact: { firstName: 'Mike', lastName: 'Johnson' },
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    type: 'meeting',
    status: 'pending',
  },
];

/**
 * Reminders Page - Full reminders list with filters and actions
 */
export default function RemindersPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const searchParams = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const [isLoading] = React.useState(false);

  // Helper to create org-prefixed links
  const orgLink = (path: string) => `/${orgSlug}${path}`;

  const getFilteredReminders = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 86400000);

    switch (filter) {
      case 'overdue':
        return mockReminders.filter((r) => new Date(r.dueDate) < today);
      case 'today':
        return mockReminders.filter((r) => {
          const date = new Date(r.dueDate);
          return date >= today && date < tomorrow;
        });
      case 'upcoming':
        return mockReminders.filter((r) => new Date(r.dueDate) >= tomorrow);
      default:
        return mockReminders;
    }
  };

  const reminders = getFilteredReminders();

  const handleComplete = (id: string) => {
    toast.success('Reminder completed', {
      description: 'The reminder has been marked as done.',
    });
  };

  const handleSnooze = (id: string) => {
    toast.info('Reminder snoozed', {
      description: 'The reminder has been snoozed for 1 day.',
    });
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  };

  const isToday = (dueDate: string) => {
    const date = new Date(dueDate);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const formatDueDate = (dueDate: string) => {
    const date = new Date(dueDate);
    if (isToday(dueDate)) return 'Today';
    if (isOverdue(dueDate)) return 'Overdue';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reminders</h1>
              <p className="text-muted-foreground">
                Manage your follow-ups and scheduled tasks
              </p>
            </div>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Reminder
            </Button>
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-4">
              <TabsTrigger value="all" asChild>
                <Link href={orgLink('/reminders')}>All</Link>
              </TabsTrigger>
              <TabsTrigger value="today" asChild>
                <Link href={orgLink('/reminders?filter=today')}>Today</Link>
              </TabsTrigger>
              <TabsTrigger value="overdue" asChild>
                <Link href={orgLink('/reminders?filter=overdue')} className="data-[state=active]:text-red-600">
                  Overdue
                </Link>
              </TabsTrigger>
              <TabsTrigger value="upcoming" asChild>
                <Link href={orgLink('/reminders?filter=upcoming')}>Upcoming</Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Reminders List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {filter === 'overdue' ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : filter === 'today' ? (
                  <Clock className="h-5 w-5 text-amber-500" />
                ) : (
                  <Bell className="h-5 w-5" />
                )}
                {filter === 'all' && 'All Reminders'}
                {filter === 'today' && "Today's Reminders"}
                {filter === 'overdue' && 'Overdue Reminders'}
                {filter === 'upcoming' && 'Upcoming Reminders'}
                {reminders.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {reminders.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <ListSkeleton items={5} />
              ) : reminders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                    <Bell className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No reminders</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                    {filter === 'overdue'
                      ? "Great! You don't have any overdue reminders."
                      : filter === 'today'
                      ? 'No reminders scheduled for today.'
                      : 'Create your first reminder to stay on top of your follow-ups.'}
                  </p>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Reminder
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {reminders.map((reminder, index) => (
                    <div
                      key={reminder.id}
                      className={cn(
                        'flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors',
                        'animate-in fade-in slide-in-from-left-2',
                        isOverdue(reminder.dueDate) && 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                      )}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{reminder.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {reminder.contact.firstName} {reminder.contact.lastName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={isOverdue(reminder.dueDate) ? 'destructive' : isToday(reminder.dueDate) ? 'default' : 'secondary'}
                          className="flex items-center gap-1"
                        >
                          <Calendar className="h-3 w-3" />
                          {formatDueDate(reminder.dueDate)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleComplete(reminder.id)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleComplete(reminder.id)}>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as done
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleSnooze(reminder.id)}>
                              <Clock className="h-4 w-4 mr-2" />
                              Snooze 1 day
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={orgLink(`/contacts/${reminder.id}`)}>
                                <User className="h-4 w-4 mr-2" />
                                View contact
                              </Link>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}









