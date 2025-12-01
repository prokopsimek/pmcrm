/**
 * E2E tests for Search API
 * US-060: Fulltext search in contacts
 * Tests complete request/response cycle
 *
 * Performance Requirements:
 * - Search response time < 100ms (p95)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/shared/prisma/prisma.service';
import { TestDbHelper, AuthHelper } from '@test/helpers';
import { ContactFactory } from '@test/factories';

describe('Search API (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let userId: string;

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

    // Create test user and get token
    const authResponse = await AuthHelper.createAuthenticatedUser(app);
    accessToken = authResponse.accessToken;
    userId = authResponse.user.id;
  });

  afterAll(async () => {
    await app.close();
    await TestDbHelper.cleanup();
  });

  describe('GET /api/v1/search/contacts', () => {
    beforeEach(async () => {
      // Seed test contacts
      await ContactFactory.createMany(prisma, userId, [
        { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com', company: 'Acme Corp' },
        { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@techco.com', company: 'TechCo' },
        { firstName: 'Bob', lastName: 'Johnson', email: 'bob@example.com', company: 'Acme Corp' },
        {
          firstName: 'Alice',
          lastName: 'Williams',
          email: 'alice@startup.io',
          company: 'Startup Inc',
          tags: ['important', 'client'],
        },
        {
          firstName: 'Charlie',
          lastName: 'Brown',
          email: 'charlie@acme.com',
          company: 'Acme Corp',
          notes: 'Met at conference last year',
        },
      ]);

      // Ensure search indexes are updated
      await prisma.$executeRaw`
        UPDATE contacts
        SET search_vector = to_tsvector('english',
          COALESCE(first_name, '') || ' ' ||
          COALESCE(last_name, '') || ' ' ||
          COALESCE(email, '') || ' ' ||
          COALESCE(company, '') || ' ' ||
          COALESCE(notes, '')
        )
        WHERE user_id = ${userId}::uuid
      `;
    });

    it('should search contacts by first name', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results).toBeDefined();
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results.some((c: any) => c.firstName === 'John')).toBe(true);
          expect(res.body.total).toBeGreaterThan(0);
          expect(res.body.query).toBe('john');
        });
    });

    it('should search contacts by last name', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'smith' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results[0].lastName).toBe('Smith');
        });
    });

    it('should search contacts by email', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'jane.smith' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results[0].email).toContain('jane.smith');
        });
    });

    it('should search contacts by company', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'acme' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThanOrEqual(3);
          expect(
            res.body.results.every((c: any) => c.company?.toLowerCase().includes('acme')),
          ).toBe(true);
        });
    });

    it('should search contacts by tags', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'important' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results.some((c: any) => c.tags.includes('important'))).toBe(true);
        });
    });

    it('should search contacts by notes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'conference' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results[0].notes).toContain('conference');
        });
    });

    it('should filter by specific fields', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'acme', fields: 'company' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(
            res.body.results.every((c: any) => c.company?.toLowerCase().includes('acme')),
          ).toBe(true);
        });
    });

    it('should support multiple search fields', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john', fields: 'name,email' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
        });
    });

    it('should highlight matched terms when requested', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john', highlight: 'true' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results[0].highlighted).toBeDefined();
          expect(res.body.results[0].highlighted.firstName).toContain('<mark>');
        });
    });

    it('should limit results when specified', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'acme', limit: 2 })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeLessThanOrEqual(2);
          expect(res.body.total).toBeGreaterThanOrEqual(res.body.results.length);
        });
    });

    it('should support fuzzy search for typos', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'jhon', fuzzy: 'true' }) // Typo for 'john'
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results.length).toBeGreaterThan(0);
          expect(res.body.results.some((c: any) => c.firstName === 'John')).toBe(true);
        });
    });

    it('should rank exact matches higher', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Exact match should be first
      expect(response.body.results[0].firstName).toBe('John');
    });

    it('should return empty results for no matches', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'nonexistent' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.results).toEqual([]);
          expect(res.body.total).toBe(0);
        });
    });

    it('should require authentication', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .expect(401);
    });

    it('should require query parameter', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should reject empty query', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: '' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should reject query shorter than 2 characters', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'a' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should only return contacts owned by user', async () => {
      // Create another user with contacts
      const otherAuth = await AuthHelper.createAuthenticatedUser(app, {
        email: 'other@example.com',
      });

      await ContactFactory.create(prisma, otherAuth.user.id, {
        firstName: 'Other',
        lastName: 'User',
        email: 'other@test.com',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'user' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should not return the other user's contact
      expect(response.body.results.every((c: any) => c.userId === userId)).toBe(true);
    });

    it('should complete search in < 100ms (performance)', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should include performance metrics in response', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.duration).toBeDefined();
          expect(res.body.duration).toBeLessThan(100);
        });
    });
  });

  describe('GET /api/v1/search/recent', () => {
    beforeEach(async () => {
      // Perform some searches to populate history
      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'acme' })
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'developer' })
        .set('Authorization', `Bearer ${accessToken}`);
    });

    it('should return recent searches', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toBeInstanceOf(Array);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('query');
          expect(res.body[0]).toHaveProperty('resultCount');
          expect(res.body[0]).toHaveProperty('createdAt');
        });
    });

    it('should return searches in reverse chronological order', () => {
      return request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          const searches = res.body;
          expect(searches.length).toBeGreaterThanOrEqual(2);

          // Most recent should be first
          expect(searches[0].query).toBe('developer');
          expect(new Date(searches[0].createdAt).getTime()).toBeGreaterThanOrEqual(
            new Date(searches[1].createdAt).getTime(),
          );
        });
    });

    it('should limit results to 10 most recent', async () => {
      // Perform many searches
      for (let i = 0; i < 15; i++) {
        await request(app.getHttpServer())
          .get('/api/v1/search/contacts')
          .query({ q: `query${i}` })
          .set('Authorization', `Bearer ${accessToken}`);
      }

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('should only return searches for authenticated user', async () => {
      // Create another user and perform searches
      const otherAuth = await AuthHelper.createAuthenticatedUser(app, {
        email: 'other@example.com',
      });

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'secret' })
        .set('Authorization', `Bearer ${otherAuth.accessToken}`);

      const response = await request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Should not include other user's searches
      expect(response.body.every((s: any) => s.query !== 'secret')).toBe(true);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).get('/api/v1/search/recent').expect(401);
    });
  });

  describe('DELETE /api/v1/search/recent/:id', () => {
    let searchId: string;

    beforeEach(async () => {
      // Perform a search
      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`);

      // Get the search ID
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`);

      searchId = response.body[0].id;
    });

    it('should delete specific search from history', async () => {
      await request(app.getHttpServer())
        .delete(`/api/v1/search/recent/${searchId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify deletion
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.find((s: any) => s.id === searchId)).toBeUndefined();
    });

    it('should only allow deleting own searches', async () => {
      // Create another user
      const otherAuth = await AuthHelper.createAuthenticatedUser(app, {
        email: 'other@example.com',
      });

      // Try to delete first user's search as second user
      await request(app.getHttpServer())
        .delete(`/api/v1/search/recent/${searchId}`)
        .set('Authorization', `Bearer ${otherAuth.accessToken}`)
        .expect(404); // Not found because it doesn't belong to this user
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).delete(`/api/v1/search/recent/${searchId}`).expect(401);
    });
  });

  describe('DELETE /api/v1/search/recent', () => {
    beforeEach(async () => {
      // Perform multiple searches
      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'john' })
        .set('Authorization', `Bearer ${accessToken}`);

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'jane' })
        .set('Authorization', `Bearer ${accessToken}`);
    });

    it('should clear all search history', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify all searches deleted
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should only clear searches for authenticated user', async () => {
      // Create another user with searches
      const otherAuth = await AuthHelper.createAuthenticatedUser(app, {
        email: 'other@example.com',
      });

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'test' })
        .set('Authorization', `Bearer ${otherAuth.accessToken}`);

      // Clear first user's searches
      await request(app.getHttpServer())
        .delete('/api/v1/search/recent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Other user's searches should still exist
      const response = await request(app.getHttpServer())
        .get('/api/v1/search/recent')
        .set('Authorization', `Bearer ${otherAuth.accessToken}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should require authentication', () => {
      return request(app.getHttpServer()).delete('/api/v1/search/recent').expect(401);
    });
  });

  describe('performance benchmarks', () => {
    beforeEach(async () => {
      // Create a larger dataset
      const contacts = Array.from({ length: 100 }, (_, i) => ({
        firstName: `Contact${i}`,
        lastName: `User${i}`,
        email: `contact${i}@example.com`,
        company: i % 2 === 0 ? 'Acme Corp' : 'TechCo',
      }));

      await ContactFactory.createMany(prisma, userId, contacts);

      // Update search vectors
      await prisma.$executeRaw`
        UPDATE contacts
        SET search_vector = to_tsvector('english',
          COALESCE(first_name, '') || ' ' ||
          COALESCE(last_name, '') || ' ' ||
          COALESCE(email, '') || ' ' ||
          COALESCE(company, '')
        )
        WHERE user_id = ${userId}::uuid
      `;
    });

    it('should maintain < 100ms response time with 100 contacts', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'contact' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });

    it('should maintain performance with highlighting enabled', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer())
        .get('/api/v1/search/contacts')
        .query({ q: 'acme', highlight: 'true' })
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });
});
