import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { DatabaseModule } from '../../shared/database/database.module';

/**
 * Notes Module
 * US-034: Manual Notes for contacts
 *
 * Provides functionality for adding manual notes to contacts with:
 * - Rich text content storage
 * - Timestamping (createdAt, updatedAt)
 * - Pin/unpin important notes
 */
@Module({
  imports: [DatabaseModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}

