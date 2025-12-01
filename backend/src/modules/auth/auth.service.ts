import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';

/**
 * Authentication Service
 * Provides utility methods for user data access
 *
 * Note: Core authentication is handled by better-auth library
 */
@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user by ID with all relevant fields
   */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; image?: string },
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        image: data.image,
        // Also update the name field for better-auth compatibility
        name: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : undefined,
      },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        image: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * Get user's OAuth accounts
   */
  async getUserAccounts(userId: string) {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      select: {
        id: true,
        providerId: true,
        accountId: true,
        createdAt: true,
      },
    });

    return accounts;
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions;
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string) {
    // Delete all sessions
    await this.prisma.session.deleteMany({
      where: { userId },
    });

    // Mark user as inactive
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return { message: 'User account deactivated' };
  }
}
