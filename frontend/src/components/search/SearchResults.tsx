'use client';

import React from 'react';
import { SearchResultItem } from './SearchResultItem';
import type { ContactSearchResult } from '@/types/search';

interface SearchResultsProps {
  results: ContactSearchResult[];
  query: string;
  selectedIndex: number;
  onSelect: (contactId: string) => void;
  isLoading?: boolean;
}

export function SearchResults({
  results,
  query,
  selectedIndex,
  onSelect,
  isLoading,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-muted/50 animate-pulse rounded-md"
            />
          ))}
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="py-2">
      <div className="px-4 py-2 text-xs font-medium text-muted-foreground">
        Contacts ({results.length})
      </div>
      <div className="space-y-0.5">
        {results.map((result, index) => (
          <SearchResultItem
            key={result.id}
            contact={result}
            query={query}
            isSelected={index === selectedIndex}
            onClick={() => onSelect(result.id)}
          />
        ))}
      </div>
    </div>
  );
}
