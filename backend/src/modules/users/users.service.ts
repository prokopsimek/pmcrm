/**
 * UsersService - US-001: Registration and onboarding
 * Implements user registration and onboarding
 * Note: Organization/workspace management is handled by better-auth organization plugin
 */
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@/shared/database/prisma.service';
import { User, OnboardingState, Subscription } from '@prisma/client';
import { RegisterUserDto, RegisterSSODto } from './dto';

const ONBOARDING_STEPS = ['profile', 'integrations', 'import_contacts'] as const;
const TRIAL_PERIOD_DAYS = 14;

interface AuthResponse {
  accessToken: string;
  user: Partial<User>;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user with email and password
   * Validates email uniqueness and password strength
   */
  async registerUser(dto: RegisterUserDto): Promise<AuthResponse> {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate password strength
    if (dto.password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create user (password is managed by better-auth Account model)
    // This method is deprecated - use better-auth sign-up endpoints instead
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'USER',
      },
    });

    // Start trial period
    await this.startTrialPeriod(user.id);

    // Initialize onboarding
    await this.initializeOnboarding(user.id);

    // Generate JWT token
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Register or login user with SSO (Google, Microsoft)
   * @deprecated Use better-auth OAuth flow instead. SSO is now handled via Account model.
   */
  async registerUserWithSSO(dto: RegisterSSODto): Promise<AuthResponse> {
    // Check if user already exists with this SSO provider via Account model
    const existingAccount = await this.prisma.account.findFirst({
      where: {
        providerId: dto.provider,
        accountId: dto.providerId,
      },
      include: {
        user: true,
      },
    });

    let user: User;

    if (existingAccount) {
      // Login existing user
      user = existingAccount.user;
    } else {
      // Register new user and link account
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firstName: dto.firstName,
          lastName: dto.lastName,
          avatar: dto.avatar,
          role: 'USER',
          accounts: {
            create: {
              accountId: dto.providerId,
              providerId: dto.provider,
            },
          },
        },
      });

      // Start trial period for new users
      await this.startTrialPeriod(user.id);

      // Initialize onboarding for new users
      await this.initializeOnboarding(user.id);
    }

    // Generate JWT token
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Initialize onboarding state for a new user
   */
  async initializeOnboarding(userId: string): Promise<OnboardingState> {
    // Check if onboarding already exists
    const existing = await this.prisma.onboardingState.findUnique({
      where: { userId },
    });

    if (existing) {
      return existing;
    }

    // Create new onboarding state
    return this.prisma.onboardingState.create({
      data: {
        userId,
        currentStep: ONBOARDING_STEPS[0],
        completedSteps: [],
        isCompleted: false,
        metadata: JSON.stringify({ steps: ONBOARDING_STEPS }),
      },
    });
  }

  /**
   * Complete an onboarding step and move to the next
   */
  async completeOnboardingStep(
    userId: string,
    step: string,
  ): Promise<OnboardingState & { steps?: string[]; progress?: number }> {
    const onboarding = await this.prisma.onboardingState.findUnique({
      where: { userId },
    });

    if (!onboarding) {
      throw new NotFoundException('Onboarding state not found');
    }

    // Add step to completed steps
    const completedSteps = [...onboarding.completedSteps];
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    // Determine next step
    const currentIndex = ONBOARDING_STEPS.indexOf(step as any);
    const nextStep =
      currentIndex >= 0 && currentIndex < ONBOARDING_STEPS.length - 1
        ? ONBOARDING_STEPS[currentIndex + 1]
        : onboarding.currentStep;

    // Check if all steps are completed
    const allStepsCompleted = ONBOARDING_STEPS.every((s) => completedSteps.includes(s));

    // Update onboarding state
    return this.prisma.onboardingState.update({
      where: { userId },
      data: {
        currentStep: allStepsCompleted ? onboarding.currentStep : nextStep,
        completedSteps,
        isCompleted: allStepsCompleted,
        completedAt: allStepsCompleted ? new Date() : null,
      },
    });
  }

  /**
   * Start 14-day trial period for a new user
   */
  async startTrialPeriod(userId: string): Promise<Subscription> {
    // Check if subscription already exists
    const existing = await this.prisma.subscription.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException('User already has an active subscription');
    }

    // Create trial subscription
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_PERIOD_DAYS);

    return this.prisma.subscription.create({
      data: {
        userId,
        plan: 'TRIAL',
        status: 'ACTIVE',
        trialEndsAt,
        metadata: JSON.stringify({ requiresPayment: false }),
      },
    });
  }

  /**
   * Get onboarding status for a user
   */
  async getOnboardingStatus(
    userId: string,
  ): Promise<(OnboardingState & { steps?: string[]; progress?: number }) | null> {
    const onboarding = await this.prisma.onboardingState.findUnique({
      where: { userId },
    });

    if (!onboarding) {
      return null;
    }

    const progress = Math.round((onboarding.completedSteps.length / ONBOARDING_STEPS.length) * 100);

    return {
      ...onboarding,
      steps: [...ONBOARDING_STEPS],
      progress,
    };
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Find user by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  /**
   * Remove sensitive data from user object
   * Note: better-auth handles passwords separately, so this may not have password field
   */
  private sanitizeUser(user: Partial<User>): Partial<User> {
    const { ...sanitized } = user;
    return sanitized;
  }
}
