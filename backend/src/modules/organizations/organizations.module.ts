/**
 * Organizations Module
 * Provides organization management using better-auth organization plugin
 * Endpoints are available via /api/auth/organization/* (handled by better-auth)
 * This module provides additional business logic and NestJS integration
 */
import { Module } from '@nestjs/common';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { DatabaseModule } from '@/shared/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}


