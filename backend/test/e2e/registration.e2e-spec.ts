/**
 * E2E tests for US-001: Registration and workspace creation
 * Tests complete user flows from registration to workspace setup
 */
import { AppModule } from '@/app.module';
import { PrismaService } from '@/shared/database/prisma.service';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

describe('Registration and Workspace Creation (E2E) - US-001', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

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

    prismaService = app.get<PrismaService>(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await prismaService.$disconnect();
    await app.close();
  });

  afterEach(async () => {
    // Clean up test data
    await prismaService.invitation.deleteMany({});
    await prismaService.workspaceMember.deleteMany({});
    await prismaService.workspace.deleteMany({});
    await prismaService.onboardingState.deleteMany({});
    await prismaService.subscription.deleteMany({});
    await prismaService.user.deleteMany({});
  });

  describe('Complete Registration Flow', () => {
    it('should complete full registration with email/password', async () => {
      const registerData = {
        email: 'e2e-test@example.com',
        password: 'SecurePass123!',
        firstName: 'E2E',
        lastName: 'Test',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(registerData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.email).toBe(registerData.email);
      expect(response.body.user.role).toBe('USER');
      expect(response.body.user.password).toBeUndefined(); // Should not expose password

      // Verify user in database
      const userInDb = await prismaService.user.findUnique({
        where: { email: registerData.email },
      });
      expect(userInDb).toBeTruthy();
      expect(userInDb?.firstName).toBe(registerData.firstName);
    });

    it('should reject registration with duplicate email', async () => {
      const registerData = {
        email: 'duplicate@example.com',
        password: 'SecurePass123!',
        firstName: 'First',
        lastName: 'User',
      };

      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(registerData)
        .expect(201);

      // Duplicate registration
      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(registerData)
        .expect(409);

      expect(response.body.message).toContain('already exists');
    });

    it('should validate email format', async () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(invalidData)
        .expect(400);

      expect(response.body.message).toContain('email');
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.message).toContain('password');
    });
  });

  describe('SSO Registration Flow', () => {
    it('should register user with Google OAuth', async () => {
      const ssoData = {
        provider: 'google',
        providerId: 'google-e2e-test-123',
        email: 'google-user@example.com',
        firstName: 'Google',
        lastName: 'User',
        image: 'https://example.com/image.jpg',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/users/register/sso')
        .send(ssoData)
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.ssoProvider).toBe('google');
      expect(response.body.user.ssoProviderId).toBe(ssoData.providerId);

      // Verify in database
      const userInDb = await prismaService.user.findUnique({
        where: { email: ssoData.email },
      });
      expect(userInDb?.ssoProvider).toBe('google');
      expect(userInDb?.password).toBeNull(); // SSO users should not have password
    });

    it('should login existing SSO user', async () => {
      const ssoData = {
        provider: 'microsoft',
        providerId: 'microsoft-existing-456',
        email: 'existing-sso@example.com',
        firstName: 'Existing',
        lastName: 'User',
      };

      // First registration
      const firstResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register/sso')
        .send(ssoData)
        .expect(201);

      const firstUserId = firstResponse.body.user.id;

      // Second attempt should login, not create new user
      const secondResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register/sso')
        .send(ssoData)
        .expect(201);

      expect(secondResponse.body.user.id).toBe(firstUserId);

      // Verify only one user in database
      const usersInDb = await prismaService.user.findMany({
        where: { email: ssoData.email },
      });
      expect(usersInDb).toHaveLength(1);
    });
  });

  describe('Workspace Creation Flow', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      // Register a user first
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'workspace-owner@example.com',
          password: 'SecurePass123!',
          firstName: 'Workspace',
          lastName: 'Owner',
        });

      accessToken = registerResponse.body.accessToken;
      userId = registerResponse.body.user.id;
    });

    it('should create workspace with name and logo', async () => {
      const workspaceData = {
        name: 'E2E Test Workspace',
        logo: 'https://example.com/workspace-logo.png',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workspaceData)
        .expect(201);

      expect(response.body.name).toBe(workspaceData.name);
      expect(response.body.logo).toBe(workspaceData.logo);
      expect(response.body.ownerId).toBe(userId);

      // Verify workspace in database
      const workspaceInDb = await prismaService.workspace.findUnique({
        where: { id: response.body.id },
        include: { members: true },
      });
      expect(workspaceInDb).toBeTruthy();
      expect(workspaceInDb?.members).toHaveLength(1);
      expect(workspaceInDb?.members[0].role).toBe('ADMIN');
    });

    it('should automatically assign ADMIN role to creator', async () => {
      const workspaceData = {
        name: 'Admin Test Workspace',
      };

      const response = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(workspaceData)
        .expect(201);

      // Check workspace membership
      const membership = await prismaService.workspaceMember.findFirst({
        where: {
          workspaceId: response.body.id,
          userId,
        },
      });

      expect(membership?.role).toBe('ADMIN');
    });

    it('should require authentication', async () => {
      const workspaceData = {
        name: 'Unauthorized Workspace',
      };

      await request(app.getHttpServer()).post('/api/v1/workspaces').send(workspaceData).expect(401);
    });
  });

  describe('Team Invitation Flow', () => {
    let accessToken: string;
    let workspaceId: string;

    beforeEach(async () => {
      // Register user and create workspace
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'team-admin@example.com',
          password: 'SecurePass123!',
          firstName: 'Team',
          lastName: 'Admin',
        });

      accessToken = registerResponse.body.accessToken;

      const workspaceResponse = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Team Test Workspace' });

      workspaceId = workspaceResponse.body.id;
    });

    it('should invite team members via email', async () => {
      const inviteData = {
        emails: ['member1@example.com', 'member2@example.com'],
        role: 'MEMBER',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invite`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(inviteData)
        .expect(201);

      expect(response.body).toHaveLength(2);
      expect(response.body[0].status).toBe('PENDING');
      expect(response.body[0].role).toBe('MEMBER');

      // Verify invitations in database
      const invitationsInDb = await prismaService.invitation.findMany({
        where: { workspaceId },
      });
      expect(invitationsInDb).toHaveLength(2);
    });

    it('should set invitation expiration to 7 days', async () => {
      const inviteData = {
        emails: ['expiry-test@example.com'],
        role: 'MEMBER',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invite`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(inviteData)
        .expect(201);

      const expiresAt = new Date(response.body[0].expiresAt);
      const now = new Date();
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      expect(Math.round(diffDays)).toBe(7);
    });

    it('should bulk invite from CSV', async () => {
      const csvContent = `email,role
bulk1@example.com,MEMBER
bulk2@example.com,ADMIN
bulk3@example.com,MEMBER`;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invite/bulk`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csvContent), 'invitations.csv')
        .expect(201);

      expect(response.body.success).toHaveLength(3);
      expect(response.body.failed).toHaveLength(0);
    });

    it('should handle invalid emails in CSV gracefully', async () => {
      const csvContent = `email,role
valid@example.com,MEMBER
invalid-email,MEMBER
another-valid@example.com,ADMIN`;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invite/bulk`)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from(csvContent), 'invitations.csv')
        .expect(201);

      expect(response.body.success).toHaveLength(2);
      expect(response.body.failed).toHaveLength(1);
      expect(response.body.failed[0].email).toBe('invalid-email');
    });
  });

  describe('Onboarding Wizard Flow', () => {
    let accessToken: string;
    let userId: string;

    beforeEach(async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'onboarding-user@example.com',
          password: 'SecurePass123!',
          firstName: 'Onboarding',
          lastName: 'User',
        });

      accessToken = registerResponse.body.accessToken;
      userId = registerResponse.body.user.id;

      // Initialize onboarding
      await request(app.getHttpServer())
        .post('/api/v1/users/onboarding/init')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);
    });

    it('should get onboarding status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users/onboarding/status')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.currentStep).toBe('profile');
      expect(response.body.steps).toEqual(['profile', 'integrations', 'import_contacts']);
      expect(response.body.completedSteps).toEqual([]);
      expect(response.body.isCompleted).toBe(false);
    });

    it('should complete onboarding steps in order', async () => {
      // Complete profile step
      const step1Response = await request(app.getHttpServer())
        .post('/api/v1/users/onboarding/complete-step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ step: 'profile' })
        .expect(200);

      expect(step1Response.body.currentStep).toBe('integrations');
      expect(step1Response.body.completedSteps).toContain('profile');

      // Complete integrations step
      const step2Response = await request(app.getHttpServer())
        .post('/api/v1/users/onboarding/complete-step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ step: 'integrations' })
        .expect(200);

      expect(step2Response.body.currentStep).toBe('import_contacts');
      expect(step2Response.body.completedSteps).toContain('integrations');

      // Complete final step
      const step3Response = await request(app.getHttpServer())
        .post('/api/v1/users/onboarding/complete-step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ step: 'import_contacts' })
        .expect(200);

      expect(step3Response.body.isCompleted).toBe(true);
      expect(step3Response.body.completedAt).toBeDefined();
    });
  });

  describe('Trial Period Flow', () => {
    it('should start 14-day trial after registration', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'trial-user@example.com',
          password: 'SecurePass123!',
          firstName: 'Trial',
          lastName: 'User',
        })
        .expect(201);

      const userId = registerResponse.body.user.id;

      // Check trial subscription
      const subscription = await prismaService.subscription.findUnique({
        where: { userId },
      });

      expect(subscription?.plan).toBe('TRIAL');
      expect(subscription?.status).toBe('ACTIVE');
      expect(subscription?.trialEndsAt).toBeDefined();

      const trialEnd = new Date(subscription!.trialEndsAt);
      const now = new Date();
      const diffDays = (trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

      expect(Math.round(diffDays)).toBe(14);
    });

    it('should not require credit card for trial', async () => {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'no-cc-user@example.com',
          password: 'SecurePass123!',
          firstName: 'No CC',
          lastName: 'User',
        })
        .expect(201);

      const userId = registerResponse.body.user.id;

      const subscription = await prismaService.subscription.findUnique({
        where: { userId },
      });

      expect(subscription?.paymentMethodId).toBeNull();
    });
  });

  describe('Complete User Journey', () => {
    it('should complete entire registration → workspace → team invitation flow', async () => {
      // 1. Register user
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/users/register')
        .send({
          email: 'journey-user@example.com',
          password: 'SecurePass123!',
          firstName: 'Journey',
          lastName: 'User',
        })
        .expect(201);

      const { accessToken, user } = registerResponse.body;
      expect(user.role).toBe('USER');

      // 2. Create workspace
      const workspaceResponse = await request(app.getHttpServer())
        .post('/api/v1/workspaces')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Journey Workspace',
          logo: 'https://example.com/logo.png',
        })
        .expect(201);

      const { id: workspaceId } = workspaceResponse.body;

      // Verify ADMIN role
      const membership = await prismaService.workspaceMember.findFirst({
        where: { workspaceId, userId: user.id },
      });
      expect(membership?.role).toBe('ADMIN');

      // 3. Initialize onboarding
      await request(app.getHttpServer())
        .post('/api/v1/users/onboarding/init')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      // 4. Complete profile step
      await request(app.getHttpServer())
        .post('/api/v1/users/onboarding/complete-step')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ step: 'profile' })
        .expect(200);

      // 5. Invite team members
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/v1/workspaces/${workspaceId}/invite`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          emails: ['team1@example.com', 'team2@example.com'],
          role: 'MEMBER',
        })
        .expect(201);

      expect(inviteResponse.body).toHaveLength(2);

      // 6. Verify trial is active
      const subscription = await prismaService.subscription.findUnique({
        where: { userId: user.id },
      });
      expect(subscription?.status).toBe('ACTIVE');
      expect(subscription?.plan).toBe('TRIAL');

      // Complete journey validation
      const finalUser = await prismaService.user.findUnique({
        where: { id: user.id },
        include: {
          workspaceMemberships: {
            include: { workspace: { include: { invitations: true } } },
          },
          onboardingState: true,
          subscription: true,
        },
      });

      expect(finalUser?.workspaceMemberships).toHaveLength(1);
      expect(finalUser?.workspaceMemberships[0].workspace.invitations).toHaveLength(2);
      expect(finalUser?.onboardingState?.completedSteps).toContain('profile');
      expect(finalUser?.subscription?.plan).toBe('TRIAL');
    });
  });
});
