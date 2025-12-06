'use client';

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search,
  X,
  CheckSquare,
  Square,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  Mail,
  Building,
  User,
} from 'lucide-react';
import type { PreviewContact } from '@/types';

type FilterType = 'all' | 'new' | 'duplicates' | 'with-labels';

interface ContactPreviewProps {
  contacts: PreviewContact[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  className?: string;
}

/**
 * Contact Preview Component
 * Table view with search, filters, and bulk selection
 */
export function ContactPreview({
  contacts,
  selectedIds,
  onSelectionChange,
  className,
}: ContactPreviewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  // Filter contacts based on search and filter
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName?.toLowerCase().includes(query) ||
          c.lastName?.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query) ||
          c.company?.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    switch (activeFilter) {
      case 'new':
        result = result.filter((c) => !c.duplicateMatch);
        break;
      case 'duplicates':
        result = result.filter((c) => c.duplicateMatch);
        break;
      case 'with-labels':
        result = result.filter((c) => c.labels && c.labels.length > 0);
        break;
    }

    return result;
  }, [contacts, searchQuery, activeFilter]);

  // Count contacts by type
  const counts = useMemo(() => ({
    all: contacts.length,
    new: contacts.filter((c) => !c.duplicateMatch).length,
    duplicates: contacts.filter((c) => c.duplicateMatch).length,
    withLabels: contacts.filter((c) => c.labels && c.labels.length > 0).length,
  }), [contacts]);

  // Selection handlers
  const handleSelectAll = useCallback(() => {
    const selectableIds = filteredContacts
      .filter((c) => c.duplicateMatch?.type !== 'exact')
      .map((c) => c.id);
    onSelectionChange(selectableIds);
  }, [filteredContacts, onSelectionChange]);

  const handleClearSelection = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const handleSelectNew = useCallback(() => {
    const newContactIds = contacts
      .filter((c) => !c.duplicateMatch)
      .map((c) => c.id);
    onSelectionChange(newContactIds);
  }, [contacts, onSelectionChange]);

  const handleToggleContact = useCallback((id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  }, [selectedIds, onSelectionChange]);

  // Check states
  const allVisibleSelected = filteredContacts
    .filter((c) => c.duplicateMatch?.type !== 'exact')
    .every((c) => selectedIds.includes(c.id));

  const someSelected = selectedIds.length > 0;

  // Get status for contact
  const getContactStatus = (contact: PreviewContact) => {
    if (!contact.duplicateMatch) {
      return { type: 'new', label: 'New', icon: CheckCircle, color: 'text-green-600 bg-green-100' };
    }
    if (contact.duplicateMatch.type === 'exact') {
      return { type: 'exact', label: 'Exact Match', icon: AlertTriangle, color: 'text-red-600 bg-red-100' };
    }
    return { type: 'potential', label: 'Potential', icon: HelpCircle, color: 'text-amber-600 bg-amber-100' };
  };

  const filters: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'new', label: 'New', count: counts.new },
    { id: 'duplicates', label: 'Duplicates', count: counts.duplicates },
    { id: 'with-labels', label: 'With Labels', count: counts.withLabels },
  ];

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* Search and Filters Header */}
      <CardHeader className="border-b bg-muted/30 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name, email, or company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10"
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

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
            {filters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  activeFilter === filter.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {filter.label}
                <span className="ml-1.5 text-xs opacity-60">
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Table Header */}
        <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/20 text-sm font-medium text-muted-foreground">
          <div className="w-10 flex justify-center">
            <Checkbox
              checked={allVisibleSelected && filteredContacts.length > 0}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleSelectAll();
                } else {
                  handleClearSelection();
                }
              }}
            />
          </div>
          <div className="flex-1 min-w-[200px]">Contact</div>
          <div className="w-48 hidden md:block">Company</div>
          <div className="w-32">Status</div>
        </div>

        {/* Contact List */}
        <ScrollArea className="h-[400px]">
          {filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="bg-muted rounded-full p-4 mb-4">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'No contacts match your search'
                  : 'No contacts in this category'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredContacts.map((contact, index) => {
                const status = getContactStatus(contact);
                const StatusIcon = status.icon;
                const isExactDuplicate = contact.duplicateMatch?.type === 'exact';
                const isSelected = selectedIds.includes(contact.id);

                return (
                  <div
                    key={contact.id}
                    className={cn(
                      'flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50',
                      isExactDuplicate && 'bg-red-50/50 dark:bg-red-950/20',
                      isSelected && !isExactDuplicate && 'bg-primary/5',
                      'animate-in fade-in slide-in-from-left-1'
                    )}
                    style={{ animationDelay: `${Math.min(index * 10, 200)}ms` }}
                  >
                    {/* Checkbox */}
                    <div className="w-10 flex justify-center">
                      <Checkbox
                        checked={isSelected}
                        disabled={isExactDuplicate}
                        onCheckedChange={() => handleToggleContact(contact.id)}
                      />
                    </div>

                    {/* Contact Info */}
                    <div className="flex-1 min-w-[200px] flex items-center gap-3">
                      {/* Avatar */}
                      {contact.photoUrl ? (
                        <img
                          src={contact.photoUrl}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-medium text-primary">
                            {contact.firstName?.[0] || ''}
                            {contact.lastName?.[0] || ''}
                          </span>
                        </div>
                      )}

                      {/* Name and Email */}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {contact.firstName} {contact.lastName}
                        </p>
                        {contact.email && (
                          <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                            <Mail className="h-3 w-3 shrink-0" />
                            {contact.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Company */}
                    <div className="w-48 hidden md:flex items-center gap-2 text-sm text-muted-foreground">
                      {contact.company ? (
                        <>
                          <Building className="h-4 w-4 shrink-0" />
                          <span className="truncate">{contact.company}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </div>

                    {/* Status */}
                    <div className="w-32">
                      <Badge
                        variant="secondary"
                        className={cn(
                          'gap-1 font-medium',
                          status.type === 'new' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          status.type === 'exact' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          status.type === 'potential' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer with bulk actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <div className="text-sm text-muted-foreground">
            {someSelected ? (
              <>
                <span className="font-medium text-foreground">{selectedIds.length}</span> of{' '}
                {counts.all} selected
              </>
            ) : (
              <>
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
                {activeFilter !== 'all' && ` (filtered)`}
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {someSelected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearSelection}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Selection
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectNew}
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All New
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
