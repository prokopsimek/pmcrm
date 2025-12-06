'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { ContactSearchResult } from '@/types/search';
import { User as PersonIcon, Mail as EnvelopeClosedIcon, Building as BuildingIcon } from 'lucide-react';

interface SearchResultItemProps {
  contact: ContactSearchResult;
  query: string;
  isSelected: boolean;
  onClick: () => void;
}

export function SearchResultItem({
  contact,
  query,
  isSelected,
  onClick,
}: SearchResultItemProps) {
  const { firstName, lastName, email, company, highlighted } = contact;

  // Use highlighted versions if available
  const displayFirstName = highlighted?.firstName || firstName;
  const displayLastName = highlighted?.lastName || lastName;
  const displayEmail = highlighted?.email || email;
  const displayCompany = highlighted?.company || company;

  const fullName = `${displayFirstName} ${displayLastName || ''}`.trim();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full px-4 py-3 text-left transition-colors',
        'hover:bg-muted/50 focus:bg-muted/50 focus:outline-none',
        isSelected && 'bg-muted/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <PersonIcon className="h-5 w-5 text-primary" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Name */}
          <div
            className="font-medium text-sm truncate"
            dangerouslySetInnerHTML={{ __html: fullName }}
          />

          {/* Email */}
          {displayEmail && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <EnvelopeClosedIcon className="h-3 w-3 flex-shrink-0" />
              <span
                className="truncate"
                dangerouslySetInnerHTML={{ __html: displayEmail }}
              />
            </div>
          )}

          {/* Company */}
          {displayCompany && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <BuildingIcon className="h-3 w-3 flex-shrink-0" />
              <span
                className="truncate"
                dangerouslySetInnerHTML={{ __html: displayCompany }}
              />
            </div>
          )}

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-2">
              {contact.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-xs bg-primary/10 text-primary"
                >
                  {tag}
                </span>
              ))}
              {contact.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{contact.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Rank indicator (for debugging) */}
        {contact.rank !== undefined && process.env.NODE_ENV === 'development' && (
          <div className="flex-shrink-0 text-xs text-muted-foreground">
            {contact.rank.toFixed(2)}
          </div>
        )}
      </div>
    </button>
  );
}
