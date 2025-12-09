import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notesService } from '@/lib/api';
import type { CreateNoteInput, UpdateNoteInput } from '@/types/note';

/**
 * Query keys for notes
 */
export const notesQueryKeys = {
  all: ['notes'] as const,
  lists: () => [...notesQueryKeys.all, 'list'] as const,
  list: (contactId: string) => [...notesQueryKeys.lists(), contactId] as const,
  detail: (noteId: string) => [...notesQueryKeys.all, 'detail', noteId] as const,
};

/**
 * Hook to get all notes for a contact
 * US-034: Manual Notes
 */
export function useContactNotes(contactId: string) {
  return useQuery({
    queryKey: notesQueryKeys.list(contactId),
    queryFn: () => notesService.getNotesForContact(contactId),
    enabled: !!contactId,
  });
}

/**
 * Hook to create a new note
 */
export function useCreateNote(contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateNoteInput) => notesService.createNote(contactId, data),
    onSuccess: () => {
      // Invalidate notes list to refetch
      queryClient.invalidateQueries({ queryKey: notesQueryKeys.list(contactId) });
    },
  });
}

/**
 * Hook to update an existing note
 */
export function useUpdateNote(contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: UpdateNoteInput }) =>
      notesService.updateNote(noteId, data),
    onSuccess: (updatedNote) => {
      // Update the note in the list cache
      queryClient.invalidateQueries({ queryKey: notesQueryKeys.list(contactId) });
      // Also update the detail cache if it exists
      queryClient.setQueryData(notesQueryKeys.detail(updatedNote.id), updatedNote);
    },
  });
}

/**
 * Hook to delete a note
 */
export function useDeleteNote(contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => notesService.deleteNote(noteId),
    onSuccess: () => {
      // Invalidate notes list to refetch
      queryClient.invalidateQueries({ queryKey: notesQueryKeys.list(contactId) });
    },
  });
}

/**
 * Hook to toggle pin status of a note
 */
export function useToggleNotePin(contactId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (noteId: string) => notesService.togglePin(noteId),
    onSuccess: (updatedNote) => {
      // Invalidate notes list to refetch (pinned notes should be reordered)
      queryClient.invalidateQueries({ queryKey: notesQueryKeys.list(contactId) });
      // Also update the detail cache if it exists
      queryClient.setQueryData(notesQueryKeys.detail(updatedNote.id), updatedNote);
    },
  });
}

/**
 * Combined hook for all note operations
 * Provides a convenient way to use all note mutations together
 */
export function useNoteActions(contactId: string) {
  const createNote = useCreateNote(contactId);
  const updateNote = useUpdateNote(contactId);
  const deleteNote = useDeleteNote(contactId);
  const togglePin = useToggleNotePin(contactId);

  return {
    createNote,
    updateNote,
    deleteNote,
    togglePin,
    // Convenience flags
    isCreating: createNote.isPending,
    isUpdating: updateNote.isPending,
    isDeleting: deleteNote.isPending,
    isTogglingPin: togglePin.isPending,
  };
}












