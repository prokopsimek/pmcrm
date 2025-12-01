/**
 * Organization Response DTO
 */
import { ApiProperty } from '@nestjs/swagger';

export class OrganizationStatsDto {
  @ApiProperty({ description: 'Number of members in the organization' })
  memberCount: number;

  @ApiProperty({ description: 'Number of pending invitations' })
  pendingInvitationCount: number;
}

export class OrganizationResponseDto {
  @ApiProperty({ description: 'Organization ID' })
  id: string;

  @ApiProperty({ description: 'Organization name' })
  name: string;

  @ApiProperty({ description: 'Organization slug (URL-friendly identifier)' })
  slug: string;

  @ApiProperty({ description: 'Organization logo URL', required: false })
  logo?: string;

  @ApiProperty({ description: 'Organization metadata', required: false })
  metadata?: Record<string, unknown>;

  @ApiProperty({ description: 'Organization creation date' })
  createdAt: Date;

  @ApiProperty({ description: 'Organization statistics', required: false })
  stats?: OrganizationStatsDto;

  @ApiProperty({ description: 'Current user role in organization', required: false })
  currentUserRole?: string;
}

export class MemberResponseDto {
  @ApiProperty({ description: 'Member ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Organization ID' })
  organizationId: string;

  @ApiProperty({ description: 'Member role (owner, admin, member)' })
  role: string;

  @ApiProperty({ description: 'When the member joined' })
  createdAt: Date;

  @ApiProperty({ description: 'User details' })
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
  };
}

export class InvitationResponseDto {
  @ApiProperty({ description: 'Invitation ID' })
  id: string;

  @ApiProperty({ description: 'Invited email address' })
  email: string;

  @ApiProperty({ description: 'Assigned role' })
  role: string;

  @ApiProperty({ description: 'Invitation status' })
  status: string;

  @ApiProperty({ description: 'Invitation expiration date' })
  expiresAt: Date;

  @ApiProperty({ description: 'When the invitation was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Inviter details' })
  inviter: {
    id: string;
    email: string;
    name: string | null;
  };
}
