'use client';

import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useCmdK, useEscape, useArrowNavigation } from '@/hooks/use-keyboard-shortcut';
import { useSearchState, useSearch } from '@/hooks/use-search';
import { SearchResults } from './SearchResults';
import { RecentSearches } from './RecentSearches';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Search as MagnifyingGlassIcon } from 'lucide-react';

export function GlobalSearch() {
  const { query, isOpen, selectedIndex, setQuery, open, close, selectNext, selectPrevious } =
    useSearchState();
  const inputRef = useRef<HTMLInputElement>(null);

  // Search with debouncing
  const { data, isLoading } = useSearch(query, {
    highlight: true,
    fuzzy: true,
  });

  // Keyboard shortcuts
  useCmdK(open);
  useEscape(close, isOpen);

  useArrowNavigation(
    {
      onArrowDown: () => {
        if (data?.results) {
          selectNext(data.results.length - 1);
        }
      },
      onArrowUp: selectPrevious,
      onEnter: () => {
        if (data?.results && data.results[selectedIndex]) {
          handleSelectResult(data.results[selectedIndex].id);
        }
      },
    },
    isOpen && query.length >= 2
  );

  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelectResult = (contactId: string) => {
    // Navigate to contact detail page
    window.location.href = `/contacts/${contactId}`;
    close();
  };

  const handleSelectRecentSearch = (recentQuery: string) => {
    setQuery(recentQuery);
  };

  const showResults = query.length >= 2;
  const showRecentSearches = query.length < 2;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        <DialogTitle className="sr-only">Search Contacts</DialogTitle>

        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search contacts by name, email, company..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {isLoading && (
            <LoadingSpinner className="h-4 w-4" />
          )}
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>

        {/* Results / Recent Searches */}
        <div className="max-h-[400px] overflow-y-auto">
          {showResults && data && (
            <SearchResults
              results={data.results}
              query={query}
              selectedIndex={selectedIndex}
              onSelect={handleSelectResult}
              isLoading={isLoading}
            />
          )}

          {showRecentSearches && (
            <RecentSearches onSelect={handleSelectRecentSearch} />
          )}

          {showResults && !isLoading && data?.results.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No contacts found for &quot;{query}&quot;
              <p className="mt-2 text-xs">
                Try adjusting your search or check the spelling
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground bg-muted/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border">↑↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border">Enter</kbd>
              Select
            </span>
          </div>
          {data?.duration && (
            <span className="text-xs">
              {data.total} results in {data.duration}ms
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
