'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteTimeline } from '@/hooks/use-timeline';
import type { TimelineEvent, TimelineEventType } from '@/lib/api/services/contacts.service';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
    Calendar,
    ChevronDown,
    FileText,
    Inbox,
    Linkedin,
    Loader2,
    Mail,
    MessageCircle,
    Phone,
    Search,
    Send,
    X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Event type filter configuration
 */
const EVENT_TYPE_FILTERS: {
  label: string;
  value: TimelineEventType | 'all';
  icon: React.ReactNode;
}[] = [
  { label: 'All', value: 'all', icon: null },
  { label: 'Emails', value: 'email', icon: <Mail className="h-3 w-3" /> },
  { label: 'Meetings', value: 'meeting', icon: <Calendar className="h-3 w-3" /> },
  { label: 'Calls', value: 'call', icon: <Phone className="h-3 w-3" /> },
  { label: 'Notes', value: 'note', icon: <FileText className="h-3 w-3" /> },
  { label: 'LinkedIn', value: 'linkedin_message', icon: <Linkedin className="h-3 w-3" /> },
];

interface UnifiedTimelineProps {
  contactId: string;
  orgSlug: string;
}

/**
 * UnifiedTimeline component
 * Displays a unified timeline of events with type filters and search
 */
export function UnifiedTimeline({ contactId, orgSlug }: UnifiedTimelineProps) {
  const [selectedTypes, setSelectedTypes] = useState<TimelineEventType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteTimeline(contactId, {
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    search: debouncedSearch || undefined,
  });

  // Infinite scroll trigger
  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || !hasNextPage || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Toggle event type filter
  const toggleTypeFilter = (type: TimelineEventType | 'all') => {
    if (type === 'all') {
      setSelectedTypes([]);
    } else {
      setSelectedTypes((prev) =>
        prev.includes(type)
          ? prev.filter((t) => t !== type)
          : [...prev, type]
      );
    }
  };

  const events = data?.pages.flatMap((p) => p.data) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search timeline..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type Filters */}
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPE_FILTERS.map((filter) => {
            const isActive =
              filter.value === 'all'
                ? selectedTypes.length === 0
                : selectedTypes.includes(filter.value as TimelineEventType);

            return (
              <Button
                key={filter.value}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleTypeFilter(filter.value)}
                className="h-8"
              >
                {filter.icon && <span className="mr-1">{filter.icon}</span>}
                {filter.label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          {total} {total === 1 ? 'Event' : 'Events'}
        </h3>
      </div>

      {/* Timeline Events */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No events found</h3>
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || selectedTypes.length > 0
                  ? 'Try adjusting your filters'
                  : 'Connect Gmail to see communication history'}
              </p>
              {!debouncedSearch && selectedTypes.length === 0 && (
                <Button className="mt-4" variant="outline" asChild>
                  <a href={`/${orgSlug}/settings/integrations`}>Connect Gmail</a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <TimelineEventItem
              key={event.id}
              event={event}
              isExpanded={expandedId === event.id}
              onToggle={() =>
                setExpandedId(expandedId === event.id ? null : event.id)
              }
            />
          ))}

          {/* Infinite scroll trigger */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="py-4 flex justify-center">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading more events...</span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Scroll to load more
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * TimelineEventItem component
 * Displays a single timeline event with expandable details
 */
function TimelineEventItem({
  event,
  isExpanded,
  onToggle,
}: {
  event: TimelineEvent;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { icon, bgColor, textColor } = getEventTypeStyles(event.type, event.direction);

  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden transition-all duration-200',
        bgColor,
        isExpanded && 'ring-2 ring-primary/20'
      )}
    >
      {/* Clickable Header */}
      <button
        onClick={onToggle}
        className="w-full flex gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center shrink-0',
            textColor
          )}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-medium text-sm truncate">{event.title}</p>
              <Badge variant="secondary" className="text-xs shrink-0">
                {getEventTypeLabel(event.type)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {format(new Date(event.occurredAt), 'MMM d, yyyy')}
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted-foreground transition-transform duration-200',
                  isExpanded && 'rotate-180'
                )}
              />
            </div>
          </div>
          {!isExpanded && event.snippet && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {event.snippet}
            </p>
          )}
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && event.snippet && (
        <div className="px-3 pb-3 pt-0">
          <div className="ml-11 border-t pt-3">
            <p className="text-sm whitespace-pre-wrap">{event.snippet}</p>
            {event.source && (
              <p className="text-xs text-muted-foreground mt-2">
                Source: {event.source}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get icon and colors for event type
 */
function getEventTypeStyles(
  type: TimelineEventType,
  direction?: 'inbound' | 'outbound'
) {
  switch (type) {
    case 'email':
      return direction === 'outbound'
        ? {
            icon: <Send className="h-4 w-4" />,
            bgColor: 'bg-blue-50/50 dark:bg-blue-950/20',
            textColor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400',
          }
        : {
            icon: <Inbox className="h-4 w-4" />,
            bgColor: 'bg-green-50/50 dark:bg-green-950/20',
            textColor: 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400',
          };
    case 'meeting':
      return {
        icon: <Calendar className="h-4 w-4" />,
        bgColor: 'bg-purple-50/50 dark:bg-purple-950/20',
        textColor: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400',
      };
    case 'call':
      return {
        icon: <Phone className="h-4 w-4" />,
        bgColor: 'bg-orange-50/50 dark:bg-orange-950/20',
        textColor: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400',
      };
    case 'note':
      return {
        icon: <FileText className="h-4 w-4" />,
        bgColor: 'bg-yellow-50/50 dark:bg-yellow-950/20',
        textColor: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400',
      };
    case 'linkedin_message':
    case 'linkedin_connection':
      return {
        icon: <Linkedin className="h-4 w-4" />,
        bgColor: 'bg-sky-50/50 dark:bg-sky-950/20',
        textColor: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400',
      };
    case 'whatsapp':
      return {
        icon: <MessageCircle className="h-4 w-4" />,
        bgColor: 'bg-emerald-50/50 dark:bg-emerald-950/20',
        textColor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
      };
    default:
      return {
        icon: <Calendar className="h-4 w-4" />,
        bgColor: 'bg-muted/30',
        textColor: 'bg-gray-100 text-gray-600 dark:bg-gray-900/50 dark:text-gray-400',
      };
  }
}

/**
 * Get human-readable label for event type
 */
function getEventTypeLabel(type: TimelineEventType): string {
  const labels: Record<TimelineEventType, string> = {
    email: 'Email',
    meeting: 'Meeting',
    call: 'Call',
    note: 'Note',
    linkedin_message: 'LinkedIn',
    linkedin_connection: 'LinkedIn',
    whatsapp: 'WhatsApp',
    other: 'Other',
  };
  return labels[type] || 'Other';
}

/**
 * Loading skeleton for timeline
 */
function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

