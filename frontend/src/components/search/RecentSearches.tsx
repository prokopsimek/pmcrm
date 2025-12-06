'use client';

import React from 'react';
import { useRecentSearches, useClearSearchHistory } from '@/hooks/use-search';
import { Clock as ClockIcon, X as Cross2Icon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecentSearchesProps {
  onSelect: (query: string) => void;
}

export function RecentSearches({ onSelect }: RecentSearchesProps) {
  const { data: recentSearches, isLoading } = useRecentSearches();
  const { clearOne, clearAll } = useClearSearchHistory();

  const handleClearOne = (e: React.MouseEvent, searchId: string) => {
    e.stopPropagation();
    clearOne.mutate(searchId);
  };

  const handleClearAll = () => {
    if (confirm('Clear all search history?')) {
      clearAll.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 bg-muted/50 animate-pulse rounded-md"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!recentSearches || recentSearches.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        <ClockIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recent searches</p>
        <p className="mt-1 text-xs">Start searching to see your history</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-4 py-2">
        <div className="text-xs font-medium text-muted-foreground">
          Recent Searches
        </div>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-0.5">
        {recentSearches.map((search) => (
          <button
            key={search.id}
            type="button"
            onClick={() => onSelect(search.query)}
            className={cn(
              'w-full px-4 py-2.5 text-left transition-colors group',
              'hover:bg-muted/50 focus:bg-muted/50 focus:outline-none'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <ClockIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {search.query}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {search.resultCount} result{search.resultCount !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => handleClearOne(e, search.id)}
                className={cn(
                  'p-1 rounded-sm opacity-0 group-hover:opacity-100',
                  'hover:bg-muted transition-opacity',
                  'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary'
                )}
                aria-label="Remove from history"
              >
                <Cross2Icon className="h-3 w-3" />
              </button>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
