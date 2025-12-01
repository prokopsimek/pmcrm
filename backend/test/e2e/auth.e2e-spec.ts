/**
 * E2E tests for Authentication API
 * Tests complete request/response cycle
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { TestDbHelper } from '@test/helpers';

describe('Auth API (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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
  });

  afterAll(async () => {
    await app.close();
    await TestDbHelper.cleanup();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
          fullName: 'New User',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe('newuser@example.com');
          expect(res.body.user).not.toHaveProperty('passwordHash');
        });
    });

    it('should reject invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePassword123!',
          fullName: 'Test User',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('email');
        });
    });

    it('should reject weak passwords', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
          fullName: 'Test User',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('password');
        });
    });

    it('should reject duplicate email registration', async () => {
      const userData = {
        email: 'duplicate@example.com',
        password: 'SecurePassword123!',
        fullName: 'Test User',
      };

      // First registration
      await request(app.getHttpServer()).post('/auth/register').send(userData).expect(201);

      // Duplicate registration
      return request(app.getHttpServer())
        .post('/auth/register')
        .send(userData)
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('already exists');
        });
    });

    it('should require all mandatory fields', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          // Missing password and fullName
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const validCredentials = {
      email: 'loginuser@example.com',
      password: 'SecurePassword123!',
    };

    beforeEach(async () => {
      // Register user first
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          ...validCredentials,
          fullName: 'Login User',
        });
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(validCredentials)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(validCredentials.email);
        });
    });

    it('should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: validCredentials.email,
          password: 'WrongPassword123!',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toContain('Invalid credentials');
        });
    });

    it('should reject non-existent email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!',
        })
        .expect(401);
    });

    it('should include refresh token in response', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send(validCredentials)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('refreshToken');
        });
    });
  });

  describe('GET /auth/me', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: 'meuser@example.com',
        password: 'SecurePassword123!',
        fullName: 'Me User',
      });

      accessToken = response.body.accessToken;
    });

    it('should return current user profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', 'meuser@example.com');
          expect(res.body).toHaveProperty('fullName', 'Me User');
          expect(res.body).not.toHaveProperty('passwordHash');
        });
    });

    it('should reject request without token', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('should reject request with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with expired token', async () => {
      // This would require a token that's already expired
      // Implementation depends on your JWT configuration
      const expiredToken = 'expired.jwt.token';

      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: 'refreshuser@example.com',
        password: 'SecurePassword123!',
        fullName: 'Refresh User',
      });

      refreshToken = response.body.refreshToken;
    });

    it('should issue new access token with valid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
        });
    });

    it('should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-refresh-token' })
        .expect(401);
    });
  });

  describe('POST /auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      const response = await request(app.getHttpServer()).post('/auth/register').send({
        email: 'logoutuser@example.com',
        password: 'SecurePassword123!',
        fullName: 'Logout User',
      });

      accessToken = response.body.accessToken;
    });

    it('should logout successfully with valid token', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('should invalidate refresh token after logout', async () => {
      const loginResponse = await request(app.getHttpServer()).post('/auth/login').send({
        email: 'logoutuser@example.com',
        password: 'SecurePassword123!',
      });

      const { refreshToken } = loginResponse.body;

      // Logout
      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to use refresh token after logout
      return request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken }).expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const credentials = {
        email: 'ratelimit@example.com',
        password: 'WrongPassword123!',
      };

      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer()).post('/auth/login').send(credentials);
      }

      // 6th attempt should be rate limited
      return request(app.getHttpServer()).post('/auth/login').send(credentials).expect(429);
    });
  });
});
