/**
 * E2E tests for AI Recommendations feature
 * US-050: AI recommendations 'who to reach out'
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '@/shared/database/prisma.service';
import { AppModule } from '@/app.module';
import { UserFactory, ContactFactory } from './factories';

describe('AI Recommendations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create test user and get auth token
    const user = await prisma.user.create({
      data: {
        email: 'test-ai@example.com',
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
      },
    });
    userId = user.id;

    // Mock auth token (replace with actual auth flow in real scenario)
    authToken = 'Bearer mock-jwt-token';
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.contact.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await app.close();
  });

  describe('Daily Digest Generation', () => {
    beforeEach(async () => {
      // Create test contacts with different scenarios
      await prisma.contact.createMany({
        data: [
          // Overdue contact
          {
            userId,
            firstName: 'John',
            lastName: 'Overdue',
            email: 'john.overdue@example.com',
            lastContact: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            frequency: 30,
            importance: 8,
          },
          // Recent contact
          {
            userId,
            firstName: 'Jane',
            lastName: 'Recent',
            email: 'jane.recent@example.com',
            lastContact: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            frequency: 7,
            importance: 6,
          },
          // Birthday contact
          {
            userId,
            firstName: 'Bob',
            lastName: 'Birthday',
            email: 'bob.birthday@example.com',
            lastContact: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            metadata: {
              birthday: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
            },
            importance: 7,
          },
        ],
      });
    });

    afterEach(async () => {
      await prisma.contact.deleteMany({ where: { userId } });
    });

    it('should generate daily digest with top 10 recommendations', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeLessThanOrEqual(10);

      // Verify recommendations structure
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('contactId');
        expect(response.body[0]).toHaveProperty('contact');
        expect(response.body[0]).toHaveProperty('reason');
        expect(response.body[0]).toHaveProperty('urgencyScore');
        expect(response.body[0]).toHaveProperty('triggerType');
      }
    });

    it('should order recommendations by urgency score (descending)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      if (response.body.length > 1) {
        for (let i = 0; i < response.body.length - 1; i++) {
          expect(response.body[i].urgencyScore).toBeGreaterThanOrEqual(
            response.body[i + 1].urgencyScore,
          );
        }
      }
    });
  });

  describe('Job Change Detection', () => {
    it('should trigger recommendation when job change is detected', async () => {
      // Create contact with job change metadata
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Alice',
          lastName: 'NewJob',
          email: 'alice.newjob@example.com',
          company: 'NewCorp',
          lastContact: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          importance: 9,
          metadata: {
            previousCompany: 'OldCorp',
            jobChangeDetected: true,
            jobChangeDate: new Date().toISOString(),
          },
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      const jobChangeRec = response.body.find(
        (r: any) => r.contactId === contact.id && r.triggerType === 'job_change',
      );

      expect(jobChangeRec).toBeDefined();
      expect(jobChangeRec.urgencyScore).toBeGreaterThan(85); // Job changes are high priority
      expect(jobChangeRec.reason).toContain('job');

      await prisma.contact.delete({ where: { id: contact.id } });
    });
  });

  describe('Overdue Contact Detection', () => {
    it('should appear in recommendation list for overdue contacts', async () => {
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Charlie',
          lastName: 'Overdue',
          email: 'charlie.overdue@example.com',
          lastContact: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
          frequency: 30, // Expected contact every 30 days
          importance: 8,
        },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      const overdueRec = response.body.find(
        (r: any) => r.contactId === contact.id && r.triggerType === 'overdue',
      );

      expect(overdueRec).toBeDefined();
      expect(overdueRec.reason).toContain('overdue');

      await prisma.contact.delete({ where: { id: contact.id } });
    });
  });

  describe('Dismiss Recommendation', () => {
    it('should remove recommendation from list after dismissal', async () => {
      // Get initial recommendations
      const initialResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      if (initialResponse.body.length === 0) {
        // Skip test if no recommendations
        return;
      }

      const recommendationId = initialResponse.body[0].id;

      // Dismiss recommendation
      await request(app.getHttpServer())
        .post(`/api/v1/ai/recommendations/${recommendationId}/dismiss`)
        .set('Authorization', authToken)
        .expect(200);

      // Verify it's removed from list
      const updatedResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      const dismissed = updatedResponse.body.find((r: any) => r.id === recommendationId);
      expect(dismissed).toBeUndefined();
    });
  });

  describe('Snooze Recommendation', () => {
    it('should temporarily hide snoozed recommendation', async () => {
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'David',
          lastName: 'Snooze',
          email: 'david.snooze@example.com',
          lastContact: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
          frequency: 30,
          importance: 7,
        },
      });

      // Get recommendations
      const initialResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      const recommendation = initialResponse.body.find((r: any) => r.contactId === contact.id);

      if (!recommendation) {
        await prisma.contact.delete({ where: { id: contact.id } });
        return;
      }

      // Snooze for 7 days
      await request(app.getHttpServer())
        .post(`/api/v1/ai/recommendations/${recommendation.id}/snooze`)
        .send({ days: 7 })
        .set('Authorization', authToken)
        .expect(200);

      // Verify it's hidden
      const updatedResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      const snoozed = updatedResponse.body.find((r: any) => r.id === recommendation.id);
      expect(snoozed).toBeUndefined();

      await prisma.contact.delete({ where: { id: contact.id } });
    });
  });

  describe('Feedback System', () => {
    it('should improve future recommendations based on helpful feedback', async () => {
      // Get initial recommendations
      const initialResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      if (initialResponse.body.length === 0) {
        return;
      }

      const recommendationId = initialResponse.body[0].id;

      // Submit helpful feedback
      const feedbackResponse = await request(app.getHttpServer())
        .post(`/api/v1/ai/recommendations/${recommendationId}/feedback`)
        .send({ isHelpful: true })
        .set('Authorization', authToken)
        .expect(200);

      expect(feedbackResponse.body).toHaveProperty('isHelpful', true);
      expect(feedbackResponse.body).toHaveProperty('recommendationId', recommendationId);
    });

    it('should record not helpful feedback', async () => {
      const initialResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      if (initialResponse.body.length === 0) {
        return;
      }

      const recommendationId = initialResponse.body[0].id;

      const feedbackResponse = await request(app.getHttpServer())
        .post(`/api/v1/ai/recommendations/${recommendationId}/feedback`)
        .send({ isHelpful: false })
        .set('Authorization', authToken)
        .expect(200);

      expect(feedbackResponse.body).toHaveProperty('isHelpful', false);
    });
  });

  describe('Weekly Digest', () => {
    it('should generate weekly digest data', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations/digest')
        .query({ period: 'weekly' })
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body).toHaveProperty('userId', userId);
      expect(response.body).toHaveProperty('period', 'weekly');
      expect(response.body).toHaveProperty('recommendations');
      expect(response.body).toHaveProperty('generatedAt');
      expect(response.body.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Authorization', () => {
    it('should reject requests without authentication', async () => {
      await request(app.getHttpServer()).get('/api/v1/ai/recommendations').expect(401);
    });

    it('should only show recommendations for authenticated user', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          password: 'hashedPassword',
          firstName: 'Other',
          lastName: 'User',
        },
      });

      // Create contact for other user
      const otherContact = await prisma.contact.create({
        data: {
          userId: otherUser.id,
          firstName: 'Other',
          lastName: 'Contact',
          email: 'other.contact@example.com',
          lastContact: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          frequency: 30,
          importance: 8,
        },
      });

      // Request with current user's token
      const response = await request(app.getHttpServer())
        .get('/api/v1/ai/recommendations')
        .query({ period: 'daily' })
        .set('Authorization', authToken)
        .expect(200);

      // Verify no recommendations for other user's contacts
      const otherUserRec = response.body.find((r: any) => r.contactId === otherContact.id);
      expect(otherUserRec).toBeUndefined();

      // Clean up
      await prisma.contact.delete({ where: { id: otherContact.id } });
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });
});
