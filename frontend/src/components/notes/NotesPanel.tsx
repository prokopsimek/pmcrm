'use client';

import { useState } from 'react';
import { Plus, StickyNote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NoteEditor } from './NoteEditor';
import { NoteCard } from './NoteCard';
import type { Note } from '@/types/note';

/**
 * Props for the NotesPanel component
 */
interface NotesPanelProps {
  /** Contact ID to show notes for */
  contactId: string;
  /** List of notes */
  notes: Note[];
  /** Whether notes are loading */
  isLoading?: boolean;
  /** Callback when a new note is created */
  onCreateNote?: (content: string) => void;
  /** Callback when a note is updated */
  onUpdateNote?: (noteId: string, content: string) => void;
  /** Callback when a note is deleted */
  onDeleteNote?: (noteId: string) => void;
  /** Callback when a note pin status is toggled */
  onTogglePin?: (noteId: string) => void;
  /** Whether create is in progress */
  isCreating?: boolean;
  /** Note ID currently being updated */
  updatingNoteId?: string | null;
  /** Note ID currently being deleted */
  deletingNoteId?: string | null;
}

/**
 * Notes panel component for displaying and managing contact notes
 * US-034: Manual Notes
 *
 * Features:
 * - Display notes list (pinned first)
 * - Create new notes with rich text editor
 * - Edit and delete existing notes
 * - Pin/unpin notes
 */
export function NotesPanel({
  contactId,
  notes,
  isLoading = false,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onTogglePin,
  isCreating = false,
  updatingNoteId = null,
  deletingNoteId = null,
}: NotesPanelProps) {
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');

  // Handle create note
  const handleCreate = () => {
    if (newNoteContent.trim()) {
      onCreateNote?.(newNoteContent);
      setNewNoteContent('');
      setIsAddingNote(false);
    }
  };

  // Handle cancel create
  const handleCancel = () => {
    setNewNoteContent('');
    setIsAddingNote(false);
  };

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((n) => n.isPinned);
  const unpinnedNotes = notes.filter((n) => !n.isPinned);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Notes</CardTitle>
          </div>
          {!isAddingNote && (
            <Button size="sm" variant="outline" onClick={() => setIsAddingNote(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Note
            </Button>
          )}
        </div>
        <CardDescription>
          {notes.length === 0 ? 'No notes yet' : `${notes.length} note${notes.length === 1 ? '' : 's'}`}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Add new note form */}
        {isAddingNote && (
          <div className="mb-4 space-y-3">
            <NoteEditor
              content={newNoteContent}
              onChange={setNewNoteContent}
              placeholder="Write your note..."
              autoFocus
              minHeight="120px"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isCreating || !newNoteContent.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Note'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Notes list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 && !isAddingNote ? (
          <div className="text-center py-8">
            <StickyNote className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              No notes yet. Add your first note to keep track of important information.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingNote(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add First Note
            </Button>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-3 pr-4">
              {/* Pinned notes first */}
              {pinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onUpdate={onUpdateNote}
                  onDelete={onDeleteNote}
                  onTogglePin={onTogglePin}
                  isUpdating={updatingNoteId === note.id}
                  isDeleting={deletingNoteId === note.id}
                />
              ))}

              {/* Unpinned notes */}
              {unpinnedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onUpdate={onUpdateNote}
                  onDelete={onDeleteNote}
                  onTogglePin={onTogglePin}
                  isUpdating={updatingNoteId === note.id}
                  isDeleting={deletingNoteId === note.id}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default NotesPanel;











