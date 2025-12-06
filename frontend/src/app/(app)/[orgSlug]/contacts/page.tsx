'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { FilterPanel, SavedViewSelector } from '@/components/filters';
import { AppLayout } from '@/components/layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { TableSkeleton } from '@/components/ui/skeletons';
import { useContactFilters, useContacts, useDefaultView, useDeleteContact } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from '@/lib/utils/date';
import type { Contact } from '@/types';
import {
    ArrowUpDown,
    Building,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Edit,
    Eye,
    Grid3X3,
    List,
    Loader2,
    Mail,
    MoreHorizontal,
    Phone,
    Plus,
    Search,
    Trash2,
    Upload,
    Users,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Contacts Page - Full contact list with search, filters, and actions
 * US-061: Advanced Filtering
 */
const PAGE_SIZE = 20;

// Sample tags - in production, fetch from API
const AVAILABLE_TAGS = ['client', 'prospect', 'partner', 'friend', 'colleague', 'vendor', 'investor'];

/**
 * Inner component that uses useContactFilters (requires Suspense)
 */
function ContactsPageContent() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [page, setPage] = useState(1);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<Contact | null>(null);
  const [hasAppliedDefault, setHasAppliedDefault] = useState(false);

  // Use filter hooks for URL sync
  const { filters, setFilters, clearFilters, hasActiveFilters, activeFilterCount } = useContactFilters();

  // Local state for debounced search input
  const [searchInput, setSearchInput] = useState(filters.search || '');

  // Sync searchInput when URL filters change externally (e.g., from saved view)
  useEffect(() => {
    setSearchInput(filters.search || '');
  }, [filters.search]);

  // Debounce search - update URL after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        setFilters({ ...filters, search: searchInput || undefined });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters, setFilters]);

  // Fetch default view
  const { data: defaultView, isLoading: isLoadingDefaultView } = useDefaultView();

  // Apply default view on initial load (once)
  useEffect(() => {
    if (!hasAppliedDefault && !isLoadingDefaultView && defaultView && !hasActiveFilters) {
      setFilters(defaultView.filters);
      setHasAppliedDefault(true);
    } else if (!hasAppliedDefault && !isLoadingDefaultView) {
      setHasAppliedDefault(true);
    }
  }, [defaultView, isLoadingDefaultView, hasAppliedDefault, hasActiveFilters, setFilters]);

  // Build query params for useContacts
  const queryParams = {
    search: filters.search,
    page,
    limit: PAGE_SIZE,
    tags: filters.tags,
    company: filters.company,
    position: filters.position,
    location: filters.location,
    source: filters.source,
    hasEmail: filters.hasEmail,
    hasPhone: filters.hasPhone,
    lastContactedFrom: filters.lastContactedFrom,
    lastContactedTo: filters.lastContactedTo,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  };

  const { data: contactsResponse, isLoading } = useContacts(queryParams);
  const deleteContact = useDeleteContact();

  const contacts = contactsResponse?.data || [];
  const totalContacts = contactsResponse?.total ?? 0;
  const totalPages = contactsResponse?.totalPages ?? 1;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Helper to create org-prefixed links
  const orgLink = (path: string) => `/${orgSlug}${path}`;

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedContacts(contacts.map((c) => c.id));
    } else {
      setSelectedContacts([]);
    }
  };

  const handleSelectContact = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedContacts((prev) => [...prev, id]);
    } else {
      setSelectedContacts((prev) => prev.filter((cid) => cid !== id));
    }
  };

  const handleDeleteClick = (contact: Contact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;

    try {
      await deleteContact.mutateAsync(contactToDelete.id);
      toast.success('Contact deleted', {
        description: `${contactToDelete.firstName} ${contactToDelete.lastName} has been removed.`,
      });
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch {
      toast.error('Failed to delete contact', {
        description: 'Please try again later.',
      });
    }
  };

  const handleBulkDelete = async () => {
    toast.info('Bulk delete', {
      description: `${selectedContacts.length} contacts selected for deletion.`,
    });
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Page Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
              <p className="text-muted-foreground">
                Manage your personal and professional network
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={orgLink('/settings/integrations')}>
                <Button variant="outline" size="sm">
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </Button>
              </Link>
              <Link href={orgLink('/contacts/new')}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </Link>
            </div>
          </div>

          {/* Search and View Controls */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search contacts..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-2">
                  {/* Sort Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        {filters.sortBy === 'importance' ? 'Relationship' :
                         filters.sortBy === 'name' ? 'Name' :
                         filters.sortBy === 'createdAt' ? 'Created' : 'Last Contact'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setFilters({ ...filters, sortBy: 'lastContact', sortOrder: 'desc' })}
                        className={cn(filters.sortBy === 'lastContact' || !filters.sortBy ? 'bg-muted' : '')}
                      >
                        Last Contact
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFilters({ ...filters, sortBy: 'importance', sortOrder: 'desc' })}
                        className={cn(filters.sortBy === 'importance' ? 'bg-muted' : '')}
                      >
                        Relationship Strength
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFilters({ ...filters, sortBy: 'name', sortOrder: 'asc' })}
                        className={cn(filters.sortBy === 'name' ? 'bg-muted' : '')}
                      >
                        Name
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setFilters({ ...filters, sortBy: 'createdAt', sortOrder: 'desc' })}
                        className={cn(filters.sortBy === 'createdAt' ? 'bg-muted' : '')}
                      >
                        Date Created
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {/* Saved Views Selector */}
                  <SavedViewSelector
                    currentFilters={filters}
                    onSelectView={setFilters}
                    hasActiveFilters={hasActiveFilters}
                  />
                  <div className="border-l border-border h-6 mx-2" />
                  <div className="flex items-center rounded-md border border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'rounded-r-none',
                        viewMode === 'list' && 'bg-muted'
                      )}
                      onClick={() => setViewMode('list')}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'rounded-l-none',
                        viewMode === 'grid' && 'bg-muted'
                      )}
                      onClick={() => setViewMode('grid')}
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedContacts.length > 0 && (
                <div className="mt-4 flex items-center gap-4 p-3 bg-muted rounded-lg animate-in slide-in-from-top-2">
                  <span className="text-sm font-medium">
                    {selectedContacts.length} selected
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedContacts([])}
                  >
                    Clear selection
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Advanced Filters Panel */}
          <FilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            availableTags={AVAILABLE_TAGS}
            onClear={clearFilters}
            hasActiveFilters={hasActiveFilters}
            activeFilterCount={activeFilterCount}
          />

          {/* Contacts List/Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Contacts
                {totalContacts > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {totalContacts}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <TableSkeleton rows={5} columns={5} />
              ) : contacts.length === 0 ? (
                <EmptyState search={filters.search || ''} orgSlug={orgSlug} />
              ) : viewMode === 'list' ? (
                <ContactsTable
                  contacts={contacts}
                  selectedContacts={selectedContacts}
                  onSelectAll={handleSelectAll}
                  onSelectContact={handleSelectContact}
                  onDelete={handleDeleteClick}
                  orgSlug={orgSlug}
                />
              ) : (
                <ContactsGrid
                  contacts={contacts}
                  onDelete={handleDeleteClick}
                  orgSlug={orgSlug}
                />
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t mt-6">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalContacts)} of {totalContacts} contacts
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1 px-2">
                      <span className="text-sm font-medium">{page}</span>
                      <span className="text-sm text-muted-foreground">/</span>
                      <span className="text-sm text-muted-foreground">{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Contact</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">
                  {contactToDelete?.firstName} {contactToDelete?.lastName}
                </span>
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={deleteContact.isPending}
              >
                {deleteContact.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AppLayout>
    </ProtectedRoute>
  );
}

/**
 * Main export - wrapped in Suspense for useSearchParams
 */
export default function ContactsPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <AppLayout>
          <div className="space-y-6">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <Card>
              <CardContent className="py-4">
                <div className="h-10 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <TableSkeleton rows={5} columns={5} />
              </CardContent>
            </Card>
          </div>
        </AppLayout>
      </ProtectedRoute>
    }>
      <ContactsPageContent />
    </Suspense>
  );
}

// Empty State Component
function EmptyState({ search, orgSlug }: { search: string; orgSlug: string }) {
  return (
    <div className="text-center py-12">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Users className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-2">
        {search ? 'No contacts found' : 'No contacts yet'}
      </h3>
      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
        {search
          ? `No contacts match "${search}". Try a different search term.`
          : 'Start building your network by adding your first contact or importing from Google.'}
      </p>
      {!search && (
        <div className="flex justify-center gap-4">
          <Link href={`/${orgSlug}/contacts/new`}>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Contact
            </Button>
          </Link>
          <Link href={`/${orgSlug}/settings/integrations`}>
            <Button variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Import from Google
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

// Helper function to get relationship strength label and color
function getRelationshipLabel(importance: number | undefined) {
  // Relationship strength based on unified scoring algorithm
  // Score: 0-100 based on recency, frequency, bidirectionality, engagement, and user investment
  if (importance === undefined || importance < 20) {
    return { label: 'New', color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' };
  }
  if (importance >= 80) {
    return { label: 'Strong', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
  }
  if (importance >= 50) {
    return { label: 'Moderate', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
  }
  return { label: 'Weak', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' };
}

// Contacts Table Component
interface ContactsTableProps {
  contacts: Contact[];
  selectedContacts: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectContact: (id: string, checked: boolean) => void;
  onDelete: (contact: Contact) => void;
  orgSlug: string;
}

function ContactsTable({
  contacts,
  selectedContacts,
  onSelectAll,
  onSelectContact,
  onDelete,
  orgSlug,
}: ContactsTableProps) {
  const allSelected = contacts.length > 0 && selectedContacts.length === contacts.length;

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="py-3 px-4 text-left">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
              />
            </th>
            <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground">
              Name
            </th>
            <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Email
            </th>
            <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground hidden lg:table-cell">
              Company
            </th>
            <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground hidden sm:table-cell">
              Last Contact
            </th>
            <th className="py-3 px-4 text-left text-sm font-medium text-muted-foreground hidden md:table-cell">
              Relationship
            </th>
            <th className="py-3 px-4 text-right text-sm font-medium text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => (
            <tr
              key={contact.id}
              className={cn(
                'border-b border-border hover:bg-muted/50 transition-colors',
                'animate-in fade-in slide-in-from-left-2'
              )}
              style={{ animationDelay: `${index * 20}ms` }}
            >
              <td className="py-3 px-4">
                <Checkbox
                  checked={selectedContacts.includes(contact.id)}
                  onCheckedChange={(checked) =>
                    onSelectContact(contact.id, checked as boolean)
                  }
                />
              </td>
              <td className="py-3 px-4">
                <Link href={`/${orgSlug}/contacts/${contact.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {contact.firstName[0]}
                      {contact.lastName?.[0] || ''}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium hover:underline">
                      {contact.firstName} {contact.lastName}
                    </p>
                    {contact.position && (
                      <p className="text-sm text-muted-foreground">
                        {contact.position}
                      </p>
                    )}
                  </div>
                </Link>
              </td>
              <td className="py-3 px-4 hidden md:table-cell">
                {contact.email ? (
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    {contact.email}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-3 px-4 hidden lg:table-cell">
                {contact.company ? (
                  <span className="text-sm flex items-center gap-1">
                    <Building className="h-3 w-3 text-muted-foreground" />
                    {contact.company}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">-</span>
                )}
              </td>
              <td className="py-3 px-4 hidden sm:table-cell">
                <span className="text-sm text-muted-foreground">
                  {contact.lastContactedAt
                    ? formatDistanceToNow(new Date(contact.lastContactedAt)) + ' ago'
                    : 'Never'}
                </span>
              </td>
              <td className="py-3 px-4 hidden md:table-cell">
                {(() => {
                  const rel = getRelationshipLabel(contact.importance);
                  return (
                    <Badge variant="secondary" className={cn('text-xs', rel.color)}>
                      {rel.label}
                    </Badge>
                  );
                })()}
              </td>
              <td className="py-3 px-4 text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/contacts/${contact.id}`}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/${orgSlug}/contacts/${contact.id}/edit`}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    {contact.email && (
                      <DropdownMenuItem asChild>
                        <a href={`mailto:${contact.email}`}>
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </a>
                      </DropdownMenuItem>
                    )}
                    {contact.phone && (
                      <DropdownMenuItem asChild>
                        <a href={`tel:${contact.phone}`}>
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </a>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(contact)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Contacts Grid Component
interface ContactsGridProps {
  contacts: Contact[];
  onDelete: (contact: Contact) => void;
  orgSlug: string;
}

function ContactsGrid({ contacts, onDelete, orgSlug }: ContactsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {contacts.map((contact, index) => (
        <div
          key={contact.id}
          className={cn(
            'group relative p-4 rounded-lg border border-border hover:border-primary/20 hover:shadow-md transition-all',
            'animate-in fade-in zoom-in-95'
          )}
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <div className="flex items-start justify-between">
            <Link href={`/${orgSlug}/contacts/${contact.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-lg font-medium text-primary">
                  {contact.firstName[0]}
                  {contact.lastName?.[0] || ''}
                </span>
              </div>
              <div>
                <p className="font-medium hover:underline">
                  {contact.firstName} {contact.lastName}
                </p>
                {contact.position && (
                  <p className="text-sm text-muted-foreground">
                    {contact.position}
                  </p>
                )}
              </div>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/${orgSlug}/contacts/${contact.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/${orgSlug}/contacts/${contact.id}/edit`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(contact)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="mt-4 space-y-2">
            {contact.company && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building className="h-4 w-4" />
                {contact.company}
              </div>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Mail className="h-4 w-4" />
                {contact.email}
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4" />
                {contact.phone}
              </a>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-1">
            {/* Relationship Strength Badge */}
            {(() => {
              const rel = getRelationshipLabel(contact.importance);
              return (
                <Badge variant="secondary" className={cn('text-xs', rel.color)}>
                  {rel.label}
                </Badge>
              );
            })()}
            {/* Tags */}
            {contact.tags && contact.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {contact.tags && contact.tags.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{contact.tags.length - 3}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

