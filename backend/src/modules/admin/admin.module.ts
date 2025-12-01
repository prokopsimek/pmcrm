import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DatabaseModule } from '@/shared/database/database.module';

/**
 * Admin Module
 * Provides administrative functionality for user management
 * Only accessible by users with ADMIN role
 */
@Module({
  imports: [DatabaseModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
