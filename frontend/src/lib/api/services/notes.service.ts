import { apiClient } from '../client';
import type { Note, NotesResponse, CreateNoteInput, UpdateNoteInput } from '@/types/note';

/**
 * Notes API Service
 * US-034: Manual Notes for contacts
 */
export const notesService = {
  /**
   * Get all notes for a contact
   * Returns notes with pinned first, then sorted by creation date (newest first)
   */
  getNotesForContact: async (contactId: string): Promise<NotesResponse> => {
    const response = await apiClient.get<NotesResponse>(`/contacts/${contactId}/notes`);
    return response.data;
  },

  /**
   * Create a new note for a contact
   */
  createNote: async (contactId: string, data: CreateNoteInput): Promise<Note> => {
    const response = await apiClient.post<Note>(`/contacts/${contactId}/notes`, data);
    return response.data;
  },

  /**
   * Get a single note by ID
   */
  getNote: async (noteId: string): Promise<Note> => {
    const response = await apiClient.get<Note>(`/notes/${noteId}`);
    return response.data;
  },

  /**
   * Update an existing note
   */
  updateNote: async (noteId: string, data: UpdateNoteInput): Promise<Note> => {
    const response = await apiClient.patch<Note>(`/notes/${noteId}`, data);
    return response.data;
  },

  /**
   * Delete a note
   */
  deleteNote: async (noteId: string): Promise<{ success: boolean }> => {
    const response = await apiClient.delete<{ success: boolean }>(`/notes/${noteId}`);
    return response.data;
  },

  /**
   * Toggle pin status of a note
   */
  togglePin: async (noteId: string): Promise<Note> => {
    const response = await apiClient.post<Note>(`/notes/${noteId}/toggle-pin`);
    return response.data;
  },
};











