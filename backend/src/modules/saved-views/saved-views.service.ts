import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateSavedViewDto } from './dto/create-saved-view.dto';
import { UpdateSavedViewDto } from './dto/update-saved-view.dto';

/**
 * SavedViews Service
 * US-061: Advanced Filtering - Saved Views
 *
 * Handles CRUD operations for user's saved filter views
 */
@Injectable()
export class SavedViewsService {
  private readonly logger = new Logger(SavedViewsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all saved views for a user
   */
  async getSavedViews(userId: string) {
    const views = await this.prisma.savedView.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        filters: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      data: views,
      total: views.length,
    };
  }

  /**
   * Get a single saved view by ID
   */
  async getSavedView(userId: string, viewId: string) {
    const view = await this.prisma.savedView.findFirst({
      where: { id: viewId, userId },
      select: {
        id: true,
        name: true,
        filters: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!view) {
      throw new NotFoundException(`Saved view with ID ${viewId} not found`);
    }

    return view;
  }

  /**
   * Get the default saved view for a user
   */
  async getDefaultView(userId: string) {
    const view = await this.prisma.savedView.findFirst({
      where: { userId, isDefault: true },
      select: {
        id: true,
        name: true,
        filters: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return view; // Can be null if no default is set
  }

  /**
   * Create a new saved view
   */
  async createSavedView(userId: string, dto: CreateSavedViewDto) {
    // Check for duplicate name
    const existing = await this.prisma.savedView.findFirst({
      where: { userId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(`A saved view with name "${dto.name}" already exists`);
    }

    // If this view should be default, unset other defaults
    if (dto.isDefault) {
      await this.prisma.savedView.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const view = await this.prisma.savedView.create({
      data: {
        userId,
        name: dto.name,
        filters: dto.filters,
        isDefault: dto.isDefault ?? false,
      },
      select: {
        id: true,
        name: true,
        filters: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Saved view "${dto.name}" created for user ${userId}`);
    return view;
  }

  /**
   * Update an existing saved view
   */
  async updateSavedView(userId: string, viewId: string, dto: UpdateSavedViewDto) {
    // Verify view exists and belongs to user
    const existing = await this.prisma.savedView.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Saved view with ID ${viewId} not found`);
    }

    // Check for duplicate name if name is being changed
    if (dto.name && dto.name !== existing.name) {
      const duplicate = await this.prisma.savedView.findFirst({
        where: { userId, name: dto.name, id: { not: viewId } },
      });

      if (duplicate) {
        throw new ConflictException(`A saved view with name "${dto.name}" already exists`);
      }
    }

    // If setting as default, unset other defaults
    if (dto.isDefault === true) {
      await this.prisma.savedView.updateMany({
        where: { userId, isDefault: true, id: { not: viewId } },
        data: { isDefault: false },
      });
    }

    const view = await this.prisma.savedView.update({
      where: { id: viewId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.filters !== undefined && { filters: dto.filters }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
      select: {
        id: true,
        name: true,
        filters: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Saved view ${viewId} updated by user ${userId}`);
    return view;
  }

  /**
   * Delete a saved view
   */
  async deleteSavedView(userId: string, viewId: string) {
    // Verify view exists and belongs to user
    const existing = await this.prisma.savedView.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Saved view with ID ${viewId} not found`);
    }

    await this.prisma.savedView.delete({
      where: { id: viewId },
    });

    this.logger.log(`Saved view ${viewId} deleted by user ${userId}`);
    return { success: true };
  }

  /**
   * Set a saved view as the default
   */
  async setDefaultView(userId: string, viewId: string) {
    // Verify view exists and belongs to user
    const existing = await this.prisma.savedView.findFirst({
      where: { id: viewId, userId },
    });

    if (!existing) {
      throw new NotFoundException(`Saved view with ID ${viewId} not found`);
    }

    // Unset all other defaults for this user
    await this.prisma.savedView.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });

    // Set this view as default
    const view = await this.prisma.savedView.update({
      where: { id: viewId },
      data: { isDefault: true },
      select: {
        id: true,
        name: true,
        filters: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`Saved view ${viewId} set as default for user ${userId}`);
    return view;
  }
}




