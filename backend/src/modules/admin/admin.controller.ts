import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

/**
 * Admin Controller
 * REST API endpoints for administrative user management
 * All endpoints require ADMIN role
 */
@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  /**
   * Guard to ensure only ADMIN users can access these endpoints
   */
  private checkAdminRole(userRole: string) {
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users (admin only)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async listUsers(
    @CurrentUser('role') userRole: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    this.checkAdminRole(userRole);
    return this.adminService.listUsers(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
      search,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user details (admin only)' })
  async getUser(@CurrentUser('role') userRole: string, @Param('id') userId: string) {
    this.checkAdminRole(userRole);
    return this.adminService.getUser(userId);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Update user role (admin only)' })
  async updateUserRole(
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') adminUserId: string,
    @Param('id') userId: string,
    @Body('role') newRole: string,
  ) {
    this.checkAdminRole(userRole);

    // Validate role
    if (!Object.values(UserRole).includes(newRole as UserRole)) {
      throw new BadRequestException(
        `Invalid role: ${newRole}. Must be one of: ${Object.values(UserRole).join(', ')}`,
      );
    }

    return this.adminService.updateUserRole(userId, newRole as UserRole, adminUserId);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Activate/deactivate user (admin only)' })
  async setUserStatus(
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') adminUserId: string,
    @Param('id') userId: string,
    @Body('isActive') isActive: boolean,
  ) {
    this.checkAdminRole(userRole);
    return this.adminService.setUserActiveStatus(userId, isActive, adminUserId);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  async deleteUser(
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') adminUserId: string,
    @Param('id') userId: string,
  ) {
    this.checkAdminRole(userRole);
    return this.adminService.deleteUser(userId, adminUserId);
  }
}
