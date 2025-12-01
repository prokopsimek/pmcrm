/**
 * US-080: Team Management - E2E Tests
 * Complete workflow tests for team member management
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/shared/database/prisma.service';
import { TestDbHelper } from '@test/helpers';
import { WorkspaceRole } from '@prisma/client';

describe('Team Management API (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerToken: string;
  let adminToken: string;
  let memberToken: string;
  let workspaceId: string;
  let ownerId: string;
  let adminId: string;
  let memberId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);
  });

  beforeEach(async () => {
    await TestDbHelper.truncateAllTables();

    // Create owner
    const ownerRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'owner@example.com',
      password: 'SecurePassword123!',
      fullName: 'Workspace Owner',
    });

    ownerToken = ownerRes.body.accessToken;
    ownerId = ownerRes.body.user.id;

    // Create workspace
    const workspaceRes = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Test Workspace',
      });

    workspaceId = workspaceRes.body.id;

    // Create admin user
    const adminRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'admin@example.com',
      password: 'SecurePassword123!',
      fullName: 'Admin User',
    });

    adminToken = adminRes.body.accessToken;
    adminId = adminRes.body.user.id;

    // Create member user
    const memberRes = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'member@example.com',
      password: 'SecurePassword123!',
      fullName: 'Member User',
    });

    memberToken = memberRes.body.accessToken;
    memberId = memberRes.body.user.id;
  });

  afterAll(async () => {
    await app.close();
    await TestDbHelper.cleanup();
  });

  describe('POST /api/v1/workspaces/:id/members/invite', () => {
    it('should allow owner to invite a new member', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'newmember@example.com',
          role: WorkspaceRole.MEMBER,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe('newmember@example.com');
          expect(res.body.role).toBe(WorkspaceRole.MEMBER);
          expect(res.body.status).toBe('PENDING');
          expect(res.body).toHaveProperty('token');
        });
    });

    it('should prevent member from inviting others', async () => {
      // First, add member to workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: memberId,
          role: WorkspaceRole.MEMBER,
        },
      });

      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/invite`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          email: 'another@example.com',
          role: WorkspaceRole.MEMBER,
        })
        .expect(403);
    });

    it('should reject duplicate invitation', async () => {
      // Send first invitation
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'duplicate@example.com',
          role: WorkspaceRole.MEMBER,
        })
        .expect(201);

      // Try to send again
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'duplicate@example.com',
          role: WorkspaceRole.MEMBER,
        })
        .expect(409);
    });
  });

  describe('DELETE /api/v1/workspaces/:id/members/:userId', () => {
    beforeEach(async () => {
      // Add admin and member to workspace
      await prisma.workspaceMember.createMany({
        data: [
          {
            workspaceId,
            userId: adminId,
            role: WorkspaceRole.ADMIN,
          },
          {
            workspaceId,
            userId: memberId,
            role: WorkspaceRole.MEMBER,
          },
        ],
      });
    });

    it('should allow owner to remove a member', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${memberId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });

      // Verify member was removed
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: memberId,
          },
        },
      });

      expect(member).toBeNull();
    });

    it('should prevent removing workspace owner', async () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${ownerId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(403);
    });

    it('should prevent member from removing others', async () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/workspaces/${workspaceId}/members/${adminId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/v1/workspaces/:id/members/:userId/role', () => {
    beforeEach(async () => {
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: memberId,
          role: WorkspaceRole.MEMBER,
        },
      });
    });

    it('should allow owner to change member role', async () => {
      return request(app.getHttpServer())
        .put(`/api/v1/workspaces/${workspaceId}/members/${memberId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: WorkspaceRole.ADMIN,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.role).toBe(WorkspaceRole.ADMIN);
        });
    });

    it('should prevent member from changing roles', async () => {
      return request(app.getHttpServer())
        .put(`/api/v1/workspaces/${workspaceId}/members/${adminId}/role`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          role: WorkspaceRole.READONLY,
        })
        .expect(403);
    });
  });

  describe('POST /api/v1/workspaces/:id/roles (Custom Roles)', () => {
    it('should allow owner to create custom role', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Sales Manager',
          description: 'Can manage sales contacts',
          permissions: ['contacts:read', 'contacts:create', 'contacts:update', 'analytics:view'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Sales Manager');
          expect(res.body.permissions).toContain('contacts:read');
          expect(res.body.permissions).toHaveLength(4);
        });
    });

    it('should validate permission names', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Invalid Role',
          permissions: ['invalid:permission', 'another:invalid'],
        })
        .expect(400);
    });

    it('should prevent duplicate role names', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Sales Manager',
          permissions: ['contacts:read'],
        });

      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/roles`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Sales Manager',
          permissions: ['contacts:create'],
        })
        .expect(409);
    });
  });

  describe('GET /api/v1/workspaces/:id/members/:userId/activity', () => {
    beforeEach(async () => {
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: memberId,
          role: WorkspaceRole.MEMBER,
        },
      });

      // Create some activity logs
      await prisma.workspaceActivityLog.createMany({
        data: [
          {
            workspaceId,
            userId: ownerId,
            action: 'member_invited',
            targetUserId: memberId,
          },
          {
            workspaceId,
            userId: ownerId,
            action: 'role_changed',
            targetUserId: memberId,
            metadata: { oldRole: 'MEMBER', newRole: 'ADMIN' },
          },
        ],
      });
    });

    it('should retrieve user activity log', async () => {
      return request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members/${memberId}/activity`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('action');
          expect(res.body[0]).toHaveProperty('createdAt');
        });
    });

    it('should prevent unauthorized access to activity logs', async () => {
      return request(app.getHttpServer())
        .get(`/api/v1/workspaces/${workspaceId}/members/${ownerId}/activity`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/workspaces/:id/members/bulk-invite', () => {
    it('should invite multiple members at once', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/bulk-invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          invitations: [
            { email: 'user1@example.com', role: WorkspaceRole.MEMBER },
            { email: 'user2@example.com', role: WorkspaceRole.ADMIN },
            { email: 'user3@example.com', role: WorkspaceRole.READONLY },
          ],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.successful).toHaveLength(3);
          expect(res.body.failed).toHaveLength(0);
        });
    });

    it('should handle partial failures', async () => {
      // Pre-invite one user
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'existing@example.com',
          role: WorkspaceRole.MEMBER,
        });

      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/bulk-invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          invitations: [
            { email: 'new@example.com', role: WorkspaceRole.MEMBER },
            { email: 'existing@example.com', role: WorkspaceRole.MEMBER },
          ],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.successful).toHaveLength(1);
          expect(res.body.failed).toHaveLength(1);
          expect(res.body.failed[0].email).toBe('existing@example.com');
        });
    });
  });

  describe('POST /api/v1/workspaces/:id/members/:userId/offboard', () => {
    let contactId: string;

    beforeEach(async () => {
      // Add member to workspace
      await prisma.workspaceMember.create({
        data: {
          workspaceId,
          userId: memberId,
          role: WorkspaceRole.MEMBER,
        },
      });

      // Create a contact owned by the member
      const contact = await prisma.contact.create({
        data: {
          userId: memberId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
        },
      });

      contactId = contact.id;
    });

    it('should offboard member and transfer contacts', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/${memberId}/offboard`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          transferToUserId: ownerId,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });

      // Verify member was removed
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: memberId,
          },
        },
      });

      expect(member).toBeNull();

      // Verify contacts were transferred
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      expect(contact?.userId).toBe(ownerId);

      // Verify activity was logged
      const log = await prisma.workspaceActivityLog.findFirst({
        where: {
          workspaceId,
          action: 'member_offboarded',
          targetUserId: memberId,
        },
      });

      expect(log).not.toBeNull();
      expect(log?.metadata).toHaveProperty('transferredTo', ownerId);
    });

    it('should require transferToUserId', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/${memberId}/offboard`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({})
        .expect(400);
    });

    it('should prevent offboarding workspace owner', async () => {
      return request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/${ownerId}/offboard`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          transferToUserId: adminId,
        })
        .expect(403);
    });
  });

  describe('Complete workflow: Invite -> Accept -> Assign Role -> Offboard', () => {
    it('should complete full lifecycle', async () => {
      // 1. Invite new member
      const inviteRes = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/invite`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          email: 'lifecycle@example.com',
          role: WorkspaceRole.MEMBER,
        })
        .expect(201);

      const invitationToken = inviteRes.body.token;

      // 2. Register and accept invitation
      const registerRes = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'lifecycle@example.com',
          password: 'SecurePassword123!',
          fullName: 'Lifecycle User',
          invitationToken,
        })
        .expect(201);

      const newUserId = registerRes.body.user.id;
      const newUserToken = registerRes.body.accessToken;

      // 3. Verify member was added to workspace
      const member = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: newUserId,
          },
        },
      });

      expect(member).not.toBeNull();
      expect(member?.role).toBe(WorkspaceRole.MEMBER);

      // 4. Promote to admin
      await request(app.getHttpServer())
        .put(`/api/v1/workspaces/${workspaceId}/members/${newUserId}/role`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          role: WorkspaceRole.ADMIN,
        })
        .expect(200);

      // 5. Create a contact as new user
      const contactRes = await request(app.getHttpServer())
        .post('/contacts')
        .set('Authorization', `Bearer ${newUserToken}`)
        .send({
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test@example.com',
        })
        .expect(201);

      const contactId = contactRes.body.id;

      // 6. Offboard the user
      await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/members/${newUserId}/offboard`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          transferToUserId: ownerId,
        })
        .expect(200);

      // 7. Verify contact was transferred
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      expect(contact?.userId).toBe(ownerId);

      // 8. Verify activity trail exists
      const logs = await prisma.workspaceActivityLog.findMany({
        where: {
          workspaceId,
          OR: [{ targetUserId: newUserId }, { targetEmail: 'lifecycle@example.com' }],
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(logs.length).toBeGreaterThan(0);
      const actions = logs.map((log) => log.action);
      expect(actions).toContain('member_invited');
      expect(actions).toContain('role_changed');
      expect(actions).toContain('member_offboarded');
    });
  });
});
