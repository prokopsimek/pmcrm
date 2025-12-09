'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CardSkeleton } from '@/components/ui/skeletons';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  Video,
  Coffee,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock events data
const mockEvents = [
  {
    id: '1',
    title: 'Video call with John',
    type: 'meeting',
    time: '10:00 AM',
    contact: 'John Doe',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
  {
    id: '2',
    title: 'Follow-up with Jane',
    type: 'reminder',
    time: '2:00 PM',
    contact: 'Jane Smith',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  },
  {
    id: '3',
    title: 'Coffee meeting',
    type: 'meeting',
    time: '4:30 PM',
    contact: 'Mike Johnson',
    color: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400',
  },
];

/**
 * Calendar Page - Calendar view with meetings and reminders
 */
export default function CalendarPage() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [isLoading] = React.useState(false);

  // Helper to create org-prefixed links
  const orgLink = (path: string) => `/${orgSlug}${path}`;

  const monthYear = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const goToPrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Generate calendar days
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days = [];

    // Previous month padding
    const prevMonth = new Date(year, month, 0);
    for (let i = startPadding - 1; i >= 0; i--) {
      days.push({
        day: prevMonth.getDate() - i,
        isCurrentMonth: false,
        isToday: false,
        date: new Date(year, month - 1, prevMonth.getDate() - i),
      });
    }

    // Current month days
    const today = new Date();
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(year, month, i);
      days.push({
        day: i,
        isCurrentMonth: true,
        isToday:
          today.getDate() === i &&
          today.getMonth() === month &&
          today.getFullYear() === year,
        date,
        hasEvents: i === today.getDate() && month === today.getMonth(),
      });
    }

    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        isToday: false,
        date: new Date(year, month + 1, i),
      });
    }

    return days;
  };

  const calendarDays = generateCalendarDays();

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'meeting':
        return <Video className="h-3 w-3" />;
      case 'reminder':
        return <Bell className="h-3 w-3" />;
      case 'call':
        return <Phone className="h-3 w-3" />;
      default:
        return <Coffee className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <ProtectedRoute>
        <AppLayout>
          <CardSkeleton />
        </AppLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
              <p className="text-muted-foreground">
                View your meetings and scheduled follow-ups
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={orgLink('/reminders')}>
                <Button variant="outline" size="sm">
                  <Bell className="h-4 w-4 mr-2" />
                  Reminders
                </Button>
              </Link>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Calendar Grid */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {monthYear}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToToday}
                    >
                      Today
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToPrevMonth}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={goToNextMonth}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Week days header */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <button
                      key={index}
                      className={cn(
                        'aspect-square p-1 rounded-lg text-sm transition-colors relative',
                        'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                        day.isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/50',
                        day.isToday && 'bg-primary text-primary-foreground hover:bg-primary/90'
                      )}
                    >
                      <span className="block">{day.day}</span>
                      {day.hasEvents && !day.isToday && (
                        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Today's Events */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Today&apos;s Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                {mockEvents.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Calendar className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      No events scheduled for today
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mockEvents.map((event, index) => (
                      <div
                        key={event.id}
                        className={cn(
                          'p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer',
                          'animate-in fade-in slide-in-from-right-2'
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded-lg',
                              event.color
                            )}
                          >
                            {getEventIcon(event.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.contact}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {event.time}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}












