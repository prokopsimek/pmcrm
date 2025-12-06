import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';

/**
 * Notes Controller
 * US-034: Manual Notes for contacts
 *
 * Provides endpoints for managing notes on contacts:
 * - GET /contacts/:contactId/notes - List notes
 * - POST /contacts/:contactId/notes - Create note
 * - PATCH /notes/:noteId - Update note
 * - DELETE /notes/:noteId - Delete note
 * - POST /notes/:noteId/toggle-pin - Toggle pin status
 */
@ApiTags('Notes')
@ApiBearerAuth()
@Controller()
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  /**
   * GET /api/v1/contacts/:contactId/notes
   * Get all notes for a contact (pinned first, then by date)
   */
  @Get('contacts/:contactId/notes')
  @ApiOperation({ summary: 'Get all notes for a contact' })
  @ApiResponse({ status: 200, description: 'Notes retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async getNotesForContact(@CurrentUser() user: any, @Param('contactId') contactId: string) {
    return this.notesService.getNotesForContact(user.id, contactId);
  }

  /**
   * POST /api/v1/contacts/:contactId/notes
   * Create a new note for a contact
   */
  @Post('contacts/:contactId/notes')
  @ApiOperation({ summary: 'Create a new note for a contact' })
  @ApiResponse({ status: 201, description: 'Note created successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async createNote(
    @CurrentUser() user: any,
    @Param('contactId') contactId: string,
    @Body() createNoteDto: CreateNoteDto,
  ) {
    return this.notesService.createNote(user.id, contactId, createNoteDto);
  }

  /**
   * GET /api/v1/notes/:noteId
   * Get a single note by ID
   */
  @Get('notes/:noteId')
  @ApiOperation({ summary: 'Get a note by ID' })
  @ApiResponse({ status: 200, description: 'Note retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async getNote(@CurrentUser() user: any, @Param('noteId') noteId: string) {
    return this.notesService.getNote(user.id, noteId);
  }

  /**
   * PATCH /api/v1/notes/:noteId
   * Update an existing note
   */
  @Patch('notes/:noteId')
  @ApiOperation({ summary: 'Update a note' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async updateNote(
    @CurrentUser() user: any,
    @Param('noteId') noteId: string,
    @Body() updateNoteDto: UpdateNoteDto,
  ) {
    return this.notesService.updateNote(user.id, noteId, updateNoteDto);
  }

  /**
   * DELETE /api/v1/notes/:noteId
   * Delete a note
   */
  @Delete('notes/:noteId')
  @ApiOperation({ summary: 'Delete a note' })
  @ApiResponse({ status: 200, description: 'Note deleted successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async deleteNote(@CurrentUser() user: any, @Param('noteId') noteId: string) {
    return this.notesService.deleteNote(user.id, noteId);
  }

  /**
   * POST /api/v1/notes/:noteId/toggle-pin
   * Toggle the pinned status of a note
   */
  @Post('notes/:noteId/toggle-pin')
  @ApiOperation({ summary: 'Toggle pin status of a note' })
  @ApiResponse({ status: 200, description: 'Pin status toggled successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async togglePin(@CurrentUser() user: any, @Param('noteId') noteId: string) {
    return this.notesService.togglePin(user.id, noteId);
  }
}




