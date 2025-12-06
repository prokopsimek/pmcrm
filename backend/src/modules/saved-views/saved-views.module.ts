import { Module } from '@nestjs/common';
import { SavedViewsController } from './saved-views.controller';
import { SavedViewsService } from './saved-views.service';
import { DatabaseModule } from '../../shared/database/database.module';

/**
 * SavedViews Module
 * US-061: Advanced Filtering - Saved Views
 *
 * Provides functionality for saving and managing filter configurations:
 * - CRUD operations for saved views
 * - Default view management
 */
@Module({
  imports: [DatabaseModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}





