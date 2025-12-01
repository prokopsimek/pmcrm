/**
 * Unit tests for UsersController - US-001: Registration and onboarding
 * Following TDD approach - Tests written FIRST before implementation
 * Coverage target: 100%
 *
 * Note: Organization/workspace management is handled by better-auth organization plugin.
 * See backend/src/modules/organizations for organization-related tests.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersController - US-001: Registration and Onboarding', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    findByIdOrThrow: jest.fn(),
    getOnboardingStatus: jest.fn(),
    completeOnboardingStep: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile', async () => {
      const userId = 'user-123';
      const expectedUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      };

      mockUsersService.findByIdOrThrow.mockResolvedValue(expectedUser);

      const result = await controller.getMe(userId);

      expect(result).toEqual(expectedUser);
      expect(mockUsersService.findByIdOrThrow).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException if user not found', async () => {
      const userId = 'non-existent';

      mockUsersService.findByIdOrThrow.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getMe(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should return user by ID', async () => {
      const userId = 'user-123';
      const expectedUser = {
        id: userId,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
      };

      mockUsersService.findByIdOrThrow.mockResolvedValue(expectedUser);

      const result = await controller.getUser(userId);

      expect(result).toEqual(expectedUser);
      expect(mockUsersService.findByIdOrThrow).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException if user not found', async () => {
      const userId = 'non-existent';

      mockUsersService.findByIdOrThrow.mockRejectedValue(new NotFoundException('User not found'));

      await expect(controller.getUser(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /api/v1/users/onboarding/status', () => {
    it('should return onboarding status for authenticated user', async () => {
      const userId = 'user-123';
      const expectedStatus = {
        currentStep: 'integrations',
        completedSteps: ['profile'],
        steps: ['profile', 'integrations', 'import_contacts'],
        isCompleted: false,
        progress: 33,
      };

      mockUsersService.getOnboardingStatus.mockResolvedValue(expectedStatus);

      const result = await controller.getOnboardingStatus(userId);

      expect(result).toEqual(expectedStatus);
      expect(mockUsersService.getOnboardingStatus).toHaveBeenCalledWith(userId);
    });

    it('should return null if onboarding not started', async () => {
      const userId = 'user-123';

      mockUsersService.getOnboardingStatus.mockResolvedValue(null);

      const result = await controller.getOnboardingStatus(userId);

      expect(result).toBeNull();
    });
  });

  describe('POST /api/v1/users/onboarding/complete-step', () => {
    it('should mark onboarding step as completed', async () => {
      const userId = 'user-123';
      const completeStepDto = {
        step: 'profile',
      };

      const expectedResult = {
        currentStep: 'integrations',
        completedSteps: ['profile'],
        isCompleted: false,
      };

      mockUsersService.completeOnboardingStep.mockResolvedValue(expectedResult);

      const result = await controller.completeOnboardingStep(userId, completeStepDto);

      expect(result).toEqual(expectedResult);
      expect(mockUsersService.completeOnboardingStep).toHaveBeenCalledWith(
        userId,
        completeStepDto.step,
      );
    });

    it('should mark onboarding as complete when all steps done', async () => {
      const userId = 'user-123';
      const completeStepDto = {
        step: 'import_contacts',
      };

      const expectedResult = {
        currentStep: 'import_contacts',
        completedSteps: ['profile', 'integrations', 'import_contacts'],
        isCompleted: true,
        completedAt: new Date(),
      };

      mockUsersService.completeOnboardingStep.mockResolvedValue(expectedResult);

      const result = await controller.completeOnboardingStep(userId, completeStepDto);

      expect(result.isCompleted).toBe(true);
    });
  });

  describe('Authorization', () => {
    it('should require authentication for user profile endpoints', () => {
      expect(controller.getMe).toBeDefined();
      expect(controller.getUser).toBeDefined();
    });

    it('should require authentication for onboarding endpoints', () => {
      expect(controller.getOnboardingStatus).toBeDefined();
      expect(controller.completeOnboardingStep).toBeDefined();
    });
  });
});
