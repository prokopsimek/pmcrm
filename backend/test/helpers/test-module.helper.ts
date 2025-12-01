/**
 * Helper for creating test modules with NestJS testing utilities
 */
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

export class TestModuleHelper {
  /**
   * Creates a testing module with common setup
   */
  static async createTestingModule(
    imports: any[] = [],
    providers: any[] = [],
    controllers: any[] = [],
  ): Promise<TestingModuleBuilder> {
    return Test.createTestingModule({
      imports,
      providers,
      controllers,
    });
  }

  /**
   * Creates a fully configured NestJS application for E2E tests
   */
  static async createTestApp(moduleBuilder: TestingModuleBuilder): Promise<INestApplication> {
    const moduleRef = await moduleBuilder.compile();

    const app = moduleRef.createNestApplication();

    // Apply global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Apply global filters, interceptors, etc.
    // app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();

    return app;
  }

  /**
   * Mock Prisma client for unit tests
   */
  static createMockPrismaClient(): Partial<PrismaClient> {
    return {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      contact: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      } as any,
      interaction: {
        create: jest.fn(),
        findMany: jest.fn(),
      } as any,
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
    };
  }

  /**
   * Creates a mock request object for testing
   */
  static createMockRequest(overrides: any = {}) {
    return {
      user: { id: 'test-user-id', email: 'test@example.com' },
      headers: {},
      query: {},
      params: {},
      body: {},
      ...overrides,
    };
  }

  /**
   * Creates a mock response object for testing
   */
  static createMockResponse() {
    const res: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
    };
    return res;
  }
}
