'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Pin, PinOff, Pencil, Trash2, MoreVertical, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { cn } from '@/lib/utils';
import { NoteEditor } from './NoteEditor';
import type { Note } from '@/types/note';

/**
 * Props for the NoteCard component
 */
interface NoteCardProps {
  /** Note data */
  note: Note;
  /** Callback when note is updated */
  onUpdate?: (noteId: string, content: string) => void;
  /** Callback when note is deleted */
  onDelete?: (noteId: string) => void;
  /** Callback when note pin status is toggled */
  onTogglePin?: (noteId: string) => void;
  /** Whether update is in progress */
  isUpdating?: boolean;
  /** Whether delete is in progress */
  isDeleting?: boolean;
}

/**
 * Note card component displaying a single note
 * US-034: Manual Notes
 *
 * Features:
 * - Display rich text content
 * - Pin/unpin notes
 * - Edit inline
 * - Delete with confirmation
 * - Timestamp display
 */
export function NoteCard({
  note,
  onUpdate,
  onDelete,
  onTogglePin,
  isUpdating = false,
  isDeleting = false,
}: NoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(note.content);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Handle save edit
  const handleSave = () => {
    if (editContent.trim() && editContent !== note.content) {
      onUpdate?.(note.id, editContent);
    }
    setIsEditing(false);
  };

  // Handle cancel edit
  const handleCancel = () => {
    setEditContent(note.content);
    setIsEditing(false);
  };

  // Handle delete confirmation
  const handleDelete = () => {
    onDelete?.(note.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card
        className={cn(
          'transition-all duration-200',
          note.isPinned && 'border-primary/50 bg-primary/5',
          isDeleting && 'opacity-50 pointer-events-none'
        )}
      >
        <CardContent className="p-4">
          {/* Header with pin indicator and actions */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {note.isPinned && (
                <Pin className="h-3 w-3 text-primary fill-primary" />
              )}
              <span>
                {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
              </span>
              {note.updatedAt !== note.createdAt && (
                <span className="italic">(edited)</span>
              )}
            </div>

            {!isEditing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onTogglePin?.(note.id)}>
                    {note.isPinned ? (
                      <>
                        <PinOff className="h-4 w-4 mr-2" />
                        Unpin
                      </>
                    ) : (
                      <>
                        <Pin className="h-4 w-4 mr-2" />
                        Pin
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Content */}
          {isEditing ? (
            <div className="space-y-3">
              <NoteEditor
                content={editContent}
                onChange={setEditContent}
                autoFocus
                minHeight="100px"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isUpdating}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isUpdating || !editContent.trim()}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isUpdating ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div
              className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2"
              dangerouslySetInnerHTML={{ __html: note.content }}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this note? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default NoteCard;












