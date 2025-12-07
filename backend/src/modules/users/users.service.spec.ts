/**
 * Unit tests for UsersService - US-001: Registration and onboarding
 * Following TDD approach - Tests written FIRST before implementation
 * Coverage target: 100%
 *
 * Note: Organization/workspace management is handled by better-auth organization plugin.
 * See backend/src/modules/organizations for organization-related tests.
 */
import { PrismaService } from '@/shared/database/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';

describe('UsersService - US-001: Registration and Onboarding', () => {
  let service: UsersService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    onboardingState: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: '1h',
        TRIAL_PERIOD_DAYS: '14',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser() - Email/Password Registration', () => {
    it('should successfully register a new user with email and password', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      const createdUser = {
        id: 'user-123',
        email: registerDto.email,
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);
      mockJwtService.sign.mockReturnValue('jwt-access-token');

      const result = await service.registerUser(registerDto);

      expect(result).toHaveProperty('accessToken', 'jwt-access-token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(registerDto.email);
      expect(result.user.role).toBe('USER');
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: registerDto.email,
      });

      await expect(service.registerUser(registerDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });

    it('should validate email format', async () => {
      const registerDto = {
        email: 'invalid-email',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      await expect(service.registerUser(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('should validate password strength (minimum 8 characters)', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'short',
        firstName: 'Test',
        lastName: 'User',
      };

      await expect(service.registerUser(registerDto)).rejects.toThrow(BadRequestException);
    });

    it('should set default role to USER', async () => {
      const registerDto = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-123',
        ...registerDto,
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockJwtService.sign.mockReturnValue('jwt-token');

      const result = await service.registerUser(registerDto);

      expect(result.user.role).toBe('USER');
    });
  });

  describe('registerUserWithSSO() - Google/Microsoft OAuth', () => {
    it('should successfully register a new user with Google OAuth', async () => {
      const ssoDto = {
        provider: 'google' as const,
        providerId: 'google-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        image: 'https://example.com/image.jpg',
      };

      mockPrismaService.account.findFirst.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-123',
        email: ssoDto.email,
        firstName: ssoDto.firstName,
        lastName: ssoDto.lastName,
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockJwtService.sign.mockReturnValue('jwt-sso-token');

      const result = await service.registerUserWithSSO(ssoDto);

      expect(result).toHaveProperty('accessToken', 'jwt-sso-token');
      expect(result.user.email).toBe(ssoDto.email);
    });

    it('should login existing SSO user instead of registering', async () => {
      const ssoDto = {
        provider: 'google' as const,
        providerId: 'google-existing',
        email: 'existing@example.com',
        firstName: 'Existing',
        lastName: 'User',
      };

      const existingUser = {
        id: 'existing-user-123',
        email: ssoDto.email,
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.account.findFirst.mockResolvedValue({
        id: 'account-123',
        userId: existingUser.id,
        user: existingUser,
      });
      mockJwtService.sign.mockReturnValue('jwt-existing-token');

      const result = await service.registerUserWithSSO(ssoDto);

      expect(result).toHaveProperty('accessToken', 'jwt-existing-token');
      expect(result.user.id).toBe(existingUser.id);
      expect(mockPrismaService.user.create).not.toHaveBeenCalled();
    });
  });

  describe('initializeOnboarding() - Onboarding Wizard', () => {
    it('should initialize onboarding state with default steps', async () => {
      const userId = 'user-123';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue(null);
      mockPrismaService.onboardingState.create.mockResolvedValue({
        id: 'onboarding-123',
        userId,
        currentStep: 'profile',
        completedSteps: [],
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.initializeOnboarding(userId);

      expect(result.currentStep).toBe('profile');
      expect(result.completedSteps).toEqual([]);
      expect(result.isCompleted).toBe(false);
    });

    it('should not reinitialize if onboarding already exists', async () => {
      const userId = 'user-123';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue({
        id: 'existing-onboarding',
        userId,
        currentStep: 'integrations',
        completedSteps: ['profile'],
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.initializeOnboarding(userId);

      expect(result.id).toBe('existing-onboarding');
      expect(result.currentStep).toBe('integrations');
      expect(mockPrismaService.onboardingState.create).not.toHaveBeenCalled();
    });
  });

  describe('completeOnboardingStep() - Step Progression', () => {
    it('should mark step as completed and move to next step', async () => {
      const userId = 'user-123';
      const stepToComplete = 'profile';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue({
        id: 'onboarding-123',
        userId,
        currentStep: 'profile',
        completedSteps: [],
        isCompleted: false,
      });
      mockPrismaService.onboardingState.update.mockResolvedValue({
        id: 'onboarding-123',
        userId,
        currentStep: 'integrations',
        completedSteps: ['profile'],
        isCompleted: false,
        updatedAt: new Date(),
      });

      const result = await service.completeOnboardingStep(userId, stepToComplete);

      expect(result.completedSteps).toContain('profile');
      expect(result.currentStep).toBe('integrations');
      expect(result.isCompleted).toBe(false);
    });

    it('should mark onboarding as completed when all steps are done', async () => {
      const userId = 'user-123';
      const stepToComplete = 'import_contacts';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue({
        id: 'onboarding-123',
        userId,
        currentStep: 'import_contacts',
        completedSteps: ['profile', 'integrations'],
        isCompleted: false,
      });
      mockPrismaService.onboardingState.update.mockResolvedValue({
        id: 'onboarding-123',
        userId,
        currentStep: 'import_contacts',
        completedSteps: ['profile', 'integrations', 'import_contacts'],
        isCompleted: true,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.completeOnboardingStep(userId, stepToComplete);

      expect(result.isCompleted).toBe(true);
      expect(result.completedAt).toBeDefined();
    });

    it('should throw NotFoundException if onboarding not found', async () => {
      const userId = 'user-123';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue(null);

      await expect(service.completeOnboardingStep(userId, 'profile')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('startTrialPeriod() - 14-day Trial', () => {
    it('should create trial subscription for 14 days', async () => {
      const userId = 'user-123';

      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      mockPrismaService.subscription.findUnique.mockResolvedValue(null);
      mockPrismaService.subscription.create.mockResolvedValue({
        id: 'subscription-123',
        userId,
        plan: 'TRIAL',
        status: 'ACTIVE',
        trialEndsAt: trialEnd,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.startTrialPeriod(userId);

      expect(result.plan).toBe('TRIAL');
      expect(result.status).toBe('ACTIVE');
      expect(result.trialEndsAt).toBeDefined();

      const diffDays = Math.round(
        (new Date(result.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(14);
    });

    it('should throw ConflictException if user already has active subscription', async () => {
      const userId = 'user-123';

      mockPrismaService.subscription.findUnique.mockResolvedValue({
        id: 'existing-subscription',
        userId,
        status: 'ACTIVE',
      });

      await expect(service.startTrialPeriod(userId)).rejects.toThrow(ConflictException);
    });
  });

  describe('getOnboardingStatus() - Status Retrieval', () => {
    it('should return current onboarding status', async () => {
      const userId = 'user-123';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue({
        id: 'onboarding-123',
        userId,
        currentStep: 'integrations',
        completedSteps: ['profile'],
        isCompleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.getOnboardingStatus(userId);

      expect(result?.currentStep).toBe('integrations');
      expect(result?.completedSteps).toEqual(['profile']);
      expect(result?.progress).toBe(33); // 1 out of 3 steps completed
    });

    it('should return null if onboarding not started', async () => {
      const userId = 'user-123';

      mockPrismaService.onboardingState.findUnique.mockResolvedValue(null);

      const result = await service.getOnboardingStatus(userId);

      expect(result).toBeNull();
    });
  });

  describe('findById() - User Retrieval', () => {
    it('should find user by ID', async () => {
      const userId = 'user-123';
      const user = {
        id: userId,
        email: 'test@example.com',
        role: 'USER',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(user);

      const result = await service.findById(userId);

      expect(result).toEqual(user);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
    });

    it('should return null if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow() - User Retrieval with Error', () => {
    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findByIdOrThrow('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
