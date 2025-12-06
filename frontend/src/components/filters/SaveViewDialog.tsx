'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateSavedView } from '@/hooks/use-saved-views';
import { useAppToast } from '@/hooks/use-toast';
import type { ContactFilters } from '@/types/contact';

interface SaveViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: ContactFilters;
}

/**
 * SaveViewDialog Component
 * US-061: Advanced Filtering
 *
 * Dialog to save current filters as a named view
 */
export function SaveViewDialog({ isOpen, onClose, currentFilters }: SaveViewDialogProps) {
  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const { success, error } = useAppToast();

  const createView = useCreateSavedView();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      error('Name required', { description: 'Please enter a name for this view.' });
      return;
    }

    try {
      await createView.mutateAsync({
        name: name.trim(),
        filters: currentFilters,
        isDefault,
      });

      success('View saved', { description: `"${name}" has been saved.` });

      // Reset and close
      setName('');
      setIsDefault(false);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save the view. Please try again.';
      error('Error saving view', { description: errorMessage });
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('');
      setIsDefault(false);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save View</DialogTitle>
          <DialogDescription>Save the current filter configuration for quick access later.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="view-name">View name</Label>
              <Input
                id="view-name"
                placeholder="e.g., Hot leads, Priority clients"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="view-default" checked={isDefault} onCheckedChange={setIsDefault} />
              <Label htmlFor="view-default" className="text-sm">
                Set as default view
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createView.isPending}>
              {createView.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save View'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

