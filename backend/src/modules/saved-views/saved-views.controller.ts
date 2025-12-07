import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SavedViewsService } from './saved-views.service';
import { CreateSavedViewDto } from './dto/create-saved-view.dto';
import { UpdateSavedViewDto } from './dto/update-saved-view.dto';

/**
 * SavedViews Controller
 * US-061: Advanced Filtering - Saved Views
 *
 * Provides endpoints for managing saved filter views:
 * - GET /saved-views - List all saved views
 * - GET /saved-views/default - Get default view
 * - GET /saved-views/:id - Get single view
 * - POST /saved-views - Create view
 * - PATCH /saved-views/:id - Update view
 * - DELETE /saved-views/:id - Delete view
 * - POST /saved-views/:id/set-default - Set as default
 */
@ApiTags('Saved Views')
@ApiBearerAuth()
@Controller('saved-views')
export class SavedViewsController {
  constructor(private readonly savedViewsService: SavedViewsService) {}

  /**
   * GET /api/v1/saved-views
   * Get all saved views for the current user
   */
  @Get()
  @ApiOperation({ summary: 'List all saved views' })
  @ApiResponse({ status: 200, description: 'Saved views retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSavedViews(@Request() req: any) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.getSavedViews(req.user.id);
  }

  /**
   * GET /api/v1/saved-views/default
   * Get the default saved view for the current user
   */
  @Get('default')
  @ApiOperation({ summary: 'Get default saved view' })
  @ApiResponse({ status: 200, description: 'Default view retrieved (or null if none)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDefaultView(@Request() req: any) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.getDefaultView(req.user.id);
  }

  /**
   * GET /api/v1/saved-views/:id
   * Get a specific saved view by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a saved view by ID' })
  @ApiResponse({ status: 200, description: 'Saved view retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Saved view not found' })
  async getSavedView(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.getSavedView(req.user.id, id);
  }

  /**
   * POST /api/v1/saved-views
   * Create a new saved view
   */
  @Post()
  @ApiOperation({ summary: 'Create a new saved view' })
  @ApiResponse({ status: 201, description: 'Saved view created successfully' })
  @ApiResponse({ status: 409, description: 'View with this name already exists' })
  async createSavedView(@Request() req: any, @Body() dto: CreateSavedViewDto) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.createSavedView(req.user.id, dto);
  }

  /**
   * PATCH /api/v1/saved-views/:id
   * Update an existing saved view
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved view' })
  @ApiResponse({ status: 200, description: 'Saved view updated successfully' })
  @ApiResponse({ status: 404, description: 'Saved view not found' })
  @ApiResponse({ status: 409, description: 'View with this name already exists' })
  async updateSavedView(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateSavedViewDto,
  ) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.updateSavedView(req.user.id, id, dto);
  }

  /**
   * DELETE /api/v1/saved-views/:id
   * Delete a saved view
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved view' })
  @ApiResponse({ status: 200, description: 'Saved view deleted successfully' })
  @ApiResponse({ status: 404, description: 'Saved view not found' })
  async deleteSavedView(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.deleteSavedView(req.user.id, id);
  }

  /**
   * POST /api/v1/saved-views/:id/set-default
   * Set a saved view as the default
   */
  @Post(':id/set-default')
  @ApiOperation({ summary: 'Set a saved view as default' })
  @ApiResponse({ status: 200, description: 'Saved view set as default' })
  @ApiResponse({ status: 404, description: 'Saved view not found' })
  async setDefaultView(@Request() req: any, @Param('id') id: string) {
    if (!req.user?.id) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.savedViewsService.setDefaultView(req.user.id, id);
  }
}
