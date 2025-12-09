/**
 * Note Types
 * US-034: Manual Notes
 */

/**
 * Note entity from the API
 */
export interface Note {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Input for creating a new note
 */
export interface CreateNoteInput {
  content: string;
  isPinned?: boolean;
}

/**
 * Input for updating an existing note
 */
export interface UpdateNoteInput {
  content?: string;
  isPinned?: boolean;
}

/**
 * Response from notes list endpoint
 */
export interface NotesResponse {
  data: Note[];
  total: number;
}












