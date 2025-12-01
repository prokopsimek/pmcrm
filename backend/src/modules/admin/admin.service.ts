import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { UserRole } from '@prisma/client';

export interface UserListItem {
  id: string;
  email: string;
  name: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListResponse {
  users: UserListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Admin Service
 * Provides administrative functionality for user management
 */
@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all users with pagination
   */
  async listUsers(
    page: number = 1,
    pageSize: number = 20,
    search?: string,
  ): Promise<UserListResponse> {
    const skip = (page - 1) * pageSize;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      pageSize,
    };
  }

  /**
   * Get single user details
   */
  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscription: true,
        onboardingState: true,
        organizationMembers: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return user;
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, newRole: UserRole, adminUserId: string) {
    // Prevent self-demotion
    if (userId === adminUserId && newRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You cannot change your own role');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    });
  }

  /**
   * Activate or deactivate user
   */
  async setUserActiveStatus(userId: string, isActive: boolean, adminUserId: string) {
    // Prevent self-deactivation
    if (userId === adminUserId && !isActive) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string, adminUserId: string) {
    // Prevent self-deletion
    if (userId === adminUserId) {
      throw new ForbiddenException('You cannot delete your own account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    // Delete user and all related data (cascade should handle this)
    return this.prisma.user.delete({
      where: { id: userId },
    });
  }
}
