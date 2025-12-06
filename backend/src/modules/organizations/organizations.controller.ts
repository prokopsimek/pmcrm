/**
 * Organizations Controller
 * Provides additional organization endpoints beyond better-auth
 *
 * Note: Core organization CRUD operations are handled by better-auth at:
 * - POST /api/auth/organization/create
 * - GET /api/auth/organization/list
 * - POST /api/auth/organization/update
 * - POST /api/auth/organization/delete
 * - POST /api/auth/organization/invite-member
 * - POST /api/auth/organization/accept-invitation
 * - GET /api/auth/organization/list-members
 * - etc.
 *
 * This controller provides additional helpers and business logic endpoints.
 */
import { Controller, Get, Param, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationsService } from './organizations.service';
import { CurrentUser } from '@/shared/decorators/current-user.decorator';

@ApiTags('Organizations')
@ApiBearerAuth()
@Controller('organizations')
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  /**
   * Get current user's organizations
   */
  @Get()
  @ApiOperation({ summary: 'Get all organizations for current user' })
  async getMyOrganizations(@CurrentUser('id') userId: string) {
    return this.organizationsService.getUserOrganizations(userId);
  }

  /**
   * Get organization by slug
   */
  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get organization by slug' })
  async getOrganizationBySlug(@CurrentUser('id') userId: string, @Param('slug') slug: string) {
    const org = await this.organizationsService.findBySlug(slug);
    if (!org) {
      return null;
    }

    // Check if user is a member
    const isMember = await this.organizationsService.isMember(userId, org.id);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return org;
  }

  /**
   * Get organization details with stats
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get organization details' })
  async getOrganization(@CurrentUser('id') userId: string, @Param('id') orgId: string) {
    const org = await this.organizationsService.findByIdOrThrow(orgId);

    // Check if user is a member
    const isMember = await this.organizationsService.isMember(userId, orgId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    const stats = await this.organizationsService.getOrganizationStats(orgId);
    const role = await this.organizationsService.getUserRole(userId, orgId);

    return {
      ...org,
      stats,
      currentUserRole: role,
    };
  }

  /**
   * Get organization members
   */
  @Get(':id/members')
  @ApiOperation({ summary: 'Get organization members' })
  async getMembers(@CurrentUser('id') userId: string, @Param('id') orgId: string) {
    // Check if user is a member
    const isMember = await this.organizationsService.isMember(userId, orgId);
    if (!isMember) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return this.organizationsService.getOrganizationMembers(orgId);
  }

  /**
   * Get pending invitations
   */
  @Get(':id/invitations')
  @ApiOperation({ summary: 'Get pending invitations' })
  async getInvitations(@CurrentUser('id') userId: string, @Param('id') orgId: string) {
    // Check if user is admin or owner
    const hasAccess = await this.organizationsService.hasRole(userId, orgId, ['owner', 'admin']);
    if (!hasAccess) {
      throw new ForbiddenException('Only admins can view invitations');
    }

    return this.organizationsService.getPendingInvitations(orgId);
  }

  /**
   * Get current user's role in organization
   */
  @Get(':id/my-role')
  @ApiOperation({ summary: 'Get current user role in organization' })
  async getMyRole(@CurrentUser('id') userId: string, @Param('id') orgId: string) {
    const role = await this.organizationsService.getUserRole(userId, orgId);
    if (!role) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return { role };
  }
}




