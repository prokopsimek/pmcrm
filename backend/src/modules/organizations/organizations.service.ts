/**
 * Organizations Service
 * Provides organization-related business logic
 * Note: Core CRUD operations are handled by better-auth organization plugin
 * This service provides additional helpers and business logic
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/shared/database/prisma.service';
import { Organization, Member } from '@prisma/client';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get organization by ID
   */
  async findById(id: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }

  /**
   * Get organization by slug
   */
  async findBySlug(slug: string): Promise<Organization | null> {
    return this.prisma.organization.findUnique({
      where: { slug },
    });
  }

  /**
   * Get organization by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<Organization> {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException(`Organization with ID ${id} not found`);
    }
    return org;
  }

  /**
   * Get all organizations for a user
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const memberships = await this.prisma.member.findMany({
      where: { userId },
      include: { organization: true },
    });
    return memberships.map((m) => m.organization);
  }

  /**
   * Get all members of an organization
   */
  async getOrganizationMembers(
    organizationId: string,
  ): Promise<
    (Member & { user: { id: string; email: string; name: string | null; image: string | null } })[]
  > {
    return this.prisma.member.findMany({
      where: { organizationId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
          },
        },
      },
    });
  }

  /**
   * Check if user is a member of an organization
   */
  async isMember(userId: string, organizationId: string): Promise<boolean> {
    const member = await this.prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });
    return !!member;
  }

  /**
   * Get user's role in an organization
   */
  async getUserRole(userId: string, organizationId: string): Promise<string | null> {
    const member = await this.prisma.member.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });
    return member?.role || null;
  }

  /**
   * Check if user has specific role in organization
   */
  async hasRole(userId: string, organizationId: string, roles: string[]): Promise<boolean> {
    const userRole = await this.getUserRole(userId, organizationId);
    return userRole ? roles.includes(userRole) : false;
  }

  /**
   * Get pending invitations for an organization
   */
  async getPendingInvitations(organizationId: string) {
    return this.prisma.invitation.findMany({
      where: {
        organizationId,
        status: 'pending',
      },
      include: {
        inviter: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get organization statistics
   */
  async getOrganizationStats(organizationId: string) {
    const [memberCount, pendingInvitationCount] = await Promise.all([
      this.prisma.member.count({ where: { organizationId } }),
      this.prisma.invitation.count({
        where: { organizationId, status: 'pending' },
      }),
    ]);

    return {
      memberCount,
      pendingInvitationCount,
    };
  }
}
