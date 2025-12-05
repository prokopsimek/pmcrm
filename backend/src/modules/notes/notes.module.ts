import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../shared/database/database.module';
import { ContactsModule } from '../contacts/contacts.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

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
  imports: [DatabaseModule, forwardRef(() => ContactsModule)],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
