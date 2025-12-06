'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ContactFilters, ContactSource } from '@/types/contact';
import { ChevronDown, ChevronUp, Filter, X } from 'lucide-react';
import { useState } from 'react';

/**
 * Source options for the filter
 */
const SOURCE_OPTIONS: { value: ContactSource; label: string }[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'IMPORT', label: 'Import' },
  { value: 'GOOGLE_CONTACTS', label: 'Google Contacts' },
  { value: 'GOOGLE_CALENDAR', label: 'Google Calendar' },
  { value: 'MICROSOFT_CONTACTS', label: 'Microsoft Contacts' },
  { value: 'MICROSOFT_CALENDAR', label: 'Microsoft Calendar' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'API', label: 'API' },
];

interface FilterPanelProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  availableTags?: string[];
  onClear: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

/**
 * FilterPanel Component
 * US-061: Advanced Filtering
 *
 * Collapsible panel with all filter options for contacts
 */
export function FilterPanel({
  filters,
  onFiltersChange,
  availableTags = [],
  onClear,
  hasActiveFilters,
  activeFilterCount,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Update a single filter field
  const updateFilter = <K extends keyof ContactFilters>(key: K, value: ContactFilters[K]) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    });
  };

  // Toggle a tag in the filters
  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];
    updateFilter('tags', newTags.length > 0 ? newTags : undefined);
  };

  return (
    <div className="bg-card border rounded-lg">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-medium">Filters</span>
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t p-4 space-y-4">
          {/* Tags filter */}
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={filters.tags?.includes(tag) ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-colors',
                      filters.tags?.includes(tag) && 'bg-primary hover:bg-primary/90'
                    )}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Text filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Company */}
            <div className="space-y-2">
              <Label htmlFor="filter-company" className="text-sm font-medium">
                Company
              </Label>
              <Input
                id="filter-company"
                placeholder="Filter by company..."
                value={filters.company || ''}
                onChange={(e) => updateFilter('company', e.target.value || undefined)}
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="filter-position" className="text-sm font-medium">
                Position
              </Label>
              <Input
                id="filter-position"
                placeholder="Filter by position..."
                value={filters.position || ''}
                onChange={(e) => updateFilter('position', e.target.value || undefined)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="filter-location" className="text-sm font-medium">
                Location
              </Label>
              <Input
                id="filter-location"
                placeholder="Filter by location..."
                value={filters.location || ''}
                onChange={(e) => updateFilter('location', e.target.value || undefined)}
              />
            </div>
          </div>

          {/* Source filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Source</Label>
            <Select
              value={filters.source || 'all'}
              onValueChange={(value) => updateFilter('source', value === 'all' ? undefined : (value as ContactSource))}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {SOURCE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boolean filters */}
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="filter-has-email"
                checked={filters.hasEmail === true}
                onCheckedChange={(checked) => updateFilter('hasEmail', checked ? true : undefined)}
              />
              <Label htmlFor="filter-has-email" className="text-sm">
                Has email
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="filter-has-phone"
                checked={filters.hasPhone === true}
                onCheckedChange={(checked) => updateFilter('hasPhone', checked ? true : undefined)}
              />
              <Label htmlFor="filter-has-phone" className="text-sm">
                Has phone
              </Label>
            </div>
          </div>

          {/* Date range filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-last-contacted-from" className="text-sm font-medium">
                Last contacted from
              </Label>
              <Input
                id="filter-last-contacted-from"
                type="date"
                value={filters.lastContactedFrom?.split('T')[0] || ''}
                onChange={(e) =>
                  updateFilter('lastContactedFrom', e.target.value ? new Date(e.target.value).toISOString() : undefined)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-last-contacted-to" className="text-sm font-medium">
                Last contacted to
              </Label>
              <Input
                id="filter-last-contacted-to"
                type="date"
                value={filters.lastContactedTo?.split('T')[0] || ''}
                onChange={(e) =>
                  updateFilter('lastContactedTo', e.target.value ? new Date(e.target.value).toISOString() : undefined)
                }
              />
            </div>
          </div>

          {/* Clear filters button */}
          {hasActiveFilters && (
            <div className="pt-2 border-t">
              <Button variant="outline" size="sm" onClick={onClear}>
                <X className="h-4 w-4 mr-2" />
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}





