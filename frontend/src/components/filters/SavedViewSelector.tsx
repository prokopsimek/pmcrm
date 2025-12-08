'use client';

import { useState } from 'react';
import { Bookmark, ChevronDown, Star, Trash2, MoreVertical, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSavedViews, useDeleteSavedView, useSetDefaultView } from '@/hooks/use-saved-views';
import type { SavedView } from '@/types/saved-view';
import type { ContactFilters } from '@/types/contact';
import { SaveViewDialog } from './SaveViewDialog';

interface SavedViewSelectorProps {
  currentFilters: ContactFilters;
  onSelectView: (filters: ContactFilters) => void;
  hasActiveFilters: boolean;
}

/**
 * SavedViewSelector Component
 * US-061: Advanced Filtering
 *
 * Dropdown to select, create, and manage saved filter views
 */
export function SavedViewSelector({ currentFilters, onSelectView, hasActiveFilters }: SavedViewSelectorProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [viewToDelete, setViewToDelete] = useState<SavedView | null>(null);

  const { data: savedViewsData, isLoading } = useSavedViews();
  const deleteView = useDeleteSavedView();
  const setDefaultView = useSetDefaultView();

  const savedViews = savedViewsData?.data || [];

  // Handle selecting a saved view
  const handleSelectView = (view: SavedView) => {
    onSelectView(view.filters);
  };

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    if (viewToDelete) {
      await deleteView.mutateAsync(viewToDelete.id);
      setViewToDelete(null);
    }
  };

  // Handle setting default
  const handleSetDefault = async (view: SavedView) => {
    await setDefaultView.mutateAsync(view.id);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Bookmark className="h-4 w-4" />
            <span className="hidden sm:inline">Saved Views</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {/* Saved views list */}
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : savedViews.length > 0 ? (
            <>
              {savedViews.map((view) => (
                <div key={view.id} className="flex items-center group">
                  <DropdownMenuItem
                    onClick={() => handleSelectView(view)}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-1">
                      {view.isDefault && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                      <span className="truncate">{view.name}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" side="right">
                      {!view.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(view)}>
                          <Star className="h-4 w-4 mr-2" />
                          Set as default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setViewToDelete(view)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
              <DropdownMenuSeparator />
            </>
          ) : (
            <div className="px-2 py-3 text-sm text-muted-foreground text-center">No saved views yet</div>
          )}

          {/* Save current view button */}
          {hasActiveFilters && (
            <DropdownMenuItem onClick={() => setIsSaveDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Save current view
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save view dialog */}
      <SaveViewDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        currentFilters={currentFilters}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!viewToDelete} onOpenChange={() => setViewToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved view?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{viewToDelete?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteView.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}











