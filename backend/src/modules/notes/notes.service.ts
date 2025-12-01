import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

/**
 * Notes Service
 * US-034: Manual Notes for contacts
 *
 * Handles CRUD operations for contact notes with ownership validation
 */
@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all notes for a contact
   * Returns pinned notes first, then by creation date (newest first)
   */
  async getNotesForContact(userId: string, contactId: string) {
    // Verify contact exists and belongs to user
    await this.verifyContactOwnership(userId, contactId);

    const notes = await this.prisma.note.findMany({
      where: {
        contactId,
        userId,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        content: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: notes,
      total: notes.length,
    };
  }

  /**
   * Create a new note for a contact
   */
  async createNote(userId: string, contactId: string, dto: CreateNoteDto) {
    // Verify contact exists and belongs to user
    await this.verifyContactOwnership(userId, contactId);

    const note = await this.prisma.note.create({
      data: {
        userId,
        contactId,
        content: dto.content,
        isPinned: dto.isPinned ?? false,
      },
      select: {
        id: true,
        content: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Note created for contact ${contactId} by user ${userId}`);
    return note;
  }

  /**
   * Update an existing note
   */
  async updateNote(userId: string, noteId: string, dto: UpdateNoteDto) {
    // Verify note exists and belongs to user
    const existingNote = await this.verifyNoteOwnership(userId, noteId);

    const note = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
      },
      select: {
        id: true,
        content: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Note ${noteId} updated by user ${userId}`);
    return note;
  }

  /**
   * Delete a note
   */
  async deleteNote(userId: string, noteId: string) {
    // Verify note exists and belongs to user
    await this.verifyNoteOwnership(userId, noteId);

    await this.prisma.note.delete({
      where: { id: noteId },
    });

    this.logger.log(`Note ${noteId} deleted by user ${userId}`);
    return { success: true };
  }

  /**
   * Toggle pin status for a note
   */
  async togglePin(userId: string, noteId: string) {
    // Verify note exists and belongs to user
    const existingNote = await this.verifyNoteOwnership(userId, noteId);

    const note = await this.prisma.note.update({
      where: { id: noteId },
      data: {
        isPinned: !existingNote.isPinned,
      },
      select: {
        id: true,
        content: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Note ${noteId} pin toggled to ${note.isPinned} by user ${userId}`);
    return note;
  }

  /**
   * Get a single note by ID
   */
  async getNote(userId: string, noteId: string) {
    const note = await this.verifyNoteOwnership(userId, noteId);

    return {
      id: note.id,
      content: note.content,
      isPinned: note.isPinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }

  /**
   * Verify that a contact belongs to the user
   */
  private async verifyContactOwnership(userId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
        deletedAt: null,
      },
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${contactId} not found`);
    }

    return contact;
  }

  /**
   * Verify that a note belongs to the user
   */
  private async verifyNoteOwnership(userId: string, noteId: string) {
    const note = await this.prisma.note.findFirst({
      where: {
        id: noteId,
        userId,
      },
    });

    if (!note) {
      throw new NotFoundException(`Note with ID ${noteId} not found`);
    }

    return note;
  }
}

