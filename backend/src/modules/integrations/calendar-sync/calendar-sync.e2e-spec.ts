/**
 * E2E tests for Calendar Sync (US-031)
 * Test-Driven Development (RED phase)
 * Tests complete user workflows end-to-end
 */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';
import { PrismaService } from '../../../shared/database/prisma.service';

describe('Calendar Sync (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();

    // Create test user and get auth token
    const userResponse = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'calendar-test@example.com',
      password: 'Test1234!',
      firstName: 'Calendar',
      lastName: 'Tester',
    });

    authToken = userResponse.body.accessToken;
    userId = userResponse.body.user.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.interaction.deleteMany({ where: { userId } });
    await prisma.calendarSyncConfig.deleteMany({ where: { userId } });
    await prisma.integration.deleteMany({ where: { userId } });
    await prisma.contact.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });

    await app.close();
  });

  describe('Google Calendar Connection Flow', () => {
    it('should complete Google Calendar OAuth flow', async () => {
      // Step 1: Initiate OAuth
      const connectResponse = await request(app.getHttpServer())
        .post('/api/v1/integrations/google-calendar/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(connectResponse.body).toHaveProperty('authUrl');
      expect(connectResponse.body).toHaveProperty('state');
      expect(connectResponse.body.authUrl).toContain('accounts.google.com');

      // Step 2: Simulate OAuth callback (would normally come from Google)
      // In E2E test, we mock the callback
      const mockCode = 'mock-auth-code-google';
      const state = connectResponse.body.state;

      // Mock the OAuth service to return test tokens
      const callbackResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/google-calendar/callback')
        .query({ code: mockCode, state })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
      expect(callbackResponse.body).toHaveProperty('integrationId');

      // Step 3: Verify integration was created
      const integration = await prisma.integration.findUnique({
        where: {
          userId_type: {
            userId,
            type: 'GOOGLE_CALENDAR',
          },
        },
      });

      expect(integration).toBeDefined();
      expect(integration.isActive).toBe(true);

      // Step 4: Verify CalendarSyncConfig was created
      const syncConfig = await prisma.calendarSyncConfig.findUnique({
        where: { userId },
      });

      expect(syncConfig).toBeDefined();
      expect(syncConfig.syncEnabled).toBe(true);
    });

    it('should reject invalid state parameter', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/integrations/google-calendar/callback')
        .query({ code: 'test-code', state: 'invalid-state' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('Outlook Calendar Connection Flow', () => {
    it('should complete Outlook Calendar OAuth flow', async () => {
      // Step 1: Initiate OAuth
      const connectResponse = await request(app.getHttpServer())
        .post('/api/v1/integrations/outlook-calendar/connect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(connectResponse.body).toHaveProperty('authUrl');
      expect(connectResponse.body.authUrl).toContain('login.microsoftonline.com');

      // Step 2: Simulate callback
      const mockCode = 'mock-auth-code-outlook';
      const state = connectResponse.body.state;

      const callbackResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/outlook-calendar/callback')
        .query({ code: mockCode, state })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(callbackResponse.body.success).toBe(true);
    });
  });

  describe('Participant Recognition and Contact Linking', () => {
    let integrationId: string;

    beforeAll(async () => {
      // Setup: Create test integration
      const integration = await prisma.integration.create({
        data: {
          userId,
          type: 'GOOGLE_CALENDAR',
          name: 'Test Google Calendar',
          accessToken: 'encrypted-test-token',
          refreshToken: 'encrypted-refresh-token',
          isActive: true,
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      integrationId = integration.id;

      // Create test contacts
      await prisma.contact.createMany({
        data: [
          {
            userId,
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
          },
          {
            userId,
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@example.com',
          },
        ],
      });
    });

    it('should recognize meeting participants and link to contacts', async () => {
      // Mock calendar event with known attendees
      const mockEvent = {
        id: 'event-e2e-1',
        summary: 'Team Standup',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
        attendees: [
          { email: 'john.doe@example.com', displayName: 'John Doe' },
          { email: 'jane.smith@example.com', displayName: 'Jane Smith' },
        ],
      };

      // Trigger sync (in real scenario, this would fetch from Google Calendar API)
      const syncResponse = await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify interaction was created
      const interactions = await prisma.interaction.findMany({
        where: {
          userId,
          externalSource: 'google_calendar',
        },
        include: {
          participants: {
            include: {
              contact: true,
            },
          },
        },
      });

      expect(interactions.length).toBeGreaterThan(0);

      const interaction = interactions.find((i) => i.externalId === 'event-e2e-1');
      if (interaction) {
        expect(interaction.participants.length).toBe(2);
        expect(interaction.participants[0].contact.email).toBe('john.doe@example.com');
      }
    });

    it('should auto-create contacts for unknown attendees', async () => {
      const initialContactCount = await prisma.contact.count({ where: { userId } });

      // Mock event with unknown attendee
      const mockEvent = {
        id: 'event-e2e-2',
        summary: 'Client Meeting',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
        attendees: [{ email: 'newclient@example.com', displayName: 'New Client' }],
      };

      await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const finalContactCount = await prisma.contact.count({ where: { userId } });

      expect(finalContactCount).toBeGreaterThan(initialContactCount);

      const newContact = await prisma.contact.findFirst({
        where: {
          userId,
          email: 'newclient@example.com',
        },
      });

      expect(newContact).toBeDefined();
      expect(newContact.firstName).toBe('New');
      expect(newContact.lastName).toBe('Client');
    });
  });

  describe('Upcoming Meetings Display', () => {
    it('should fetch and display upcoming meetings', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/events')
        .query({ type: 'upcoming' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body).toHaveProperty('total');

      // Verify events are in the future
      response.body.events.forEach((event: any) => {
        expect(new Date(event.startTime).getTime()).toBeGreaterThan(Date.now());
      });
    });

    it('should include attendee information in events', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/events')
        .query({ type: 'upcoming' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.events.length > 0) {
        const event = response.body.events[0];
        expect(event).toHaveProperty('attendees');
        expect(Array.isArray(event.attendees)).toBe(true);
      }
    });
  });

  describe('Past Meetings Display with Notes', () => {
    let interactionId: string;

    beforeAll(async () => {
      // Create past meeting interaction
      const interaction = await prisma.interaction.create({
        data: {
          userId,
          interactionType: 'meeting',
          subject: 'Past Team Meeting',
          occurredAt: new Date('2025-11-15T10:00:00Z'),
          externalId: 'past-event-1',
          externalSource: 'google_calendar',
        },
      });
      interactionId = interaction.id;
    });

    it('should fetch past meetings', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/events')
        .query({
          type: 'past',
          startDate: '2025-11-01',
          endDate: '2025-11-30',
        })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.events).toBeDefined();
      expect(response.body.events.length).toBeGreaterThan(0);

      // Verify events are in the past
      response.body.events.forEach((event: any) => {
        expect(new Date(event.startTime).getTime()).toBeLessThan(Date.now());
      });
    });

    it('should add notes to past meeting', async () => {
      const notesDto = {
        notes: 'Discussed Q4 roadmap. Action items: 1) Finalize specs, 2) Review timeline',
      };

      const response = await request(app.getHttpServer())
        .post(`/api/v1/calendar/events/${interactionId}/notes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(notesDto)
        .expect(200);

      expect(response.body.summary).toBe(notesDto.notes);

      // Verify notes were saved
      const interaction = await prisma.interaction.findUnique({
        where: { id: interactionId },
      });

      expect(interaction.summary).toBe(notesDto.notes);
    });

    it('should retrieve meeting with notes', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/events')
        .query({ type: 'past', startDate: '2025-11-01', endDate: '2025-11-30' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const meetingWithNotes = response.body.events.find(
        (e: any) => e.externalId === 'past-event-1',
      );

      expect(meetingWithNotes).toBeDefined();
      expect(meetingWithNotes.notes).toBeDefined();
    });
  });

  describe('Automatic Last Contact Date Update', () => {
    let contactId: string;

    beforeAll(async () => {
      // Create test contact
      const contact = await prisma.contact.create({
        data: {
          userId,
          firstName: 'Test',
          lastName: 'Contact',
          email: 'test.contact@example.com',
          lastContact: null,
        },
      });
      contactId = contact.id;
    });

    it('should automatically update lastContact after meeting', async () => {
      const meetingDate = new Date('2025-11-20T14:00:00Z');

      // Create meeting interaction with this contact
      await prisma.interaction.create({
        data: {
          userId,
          interactionType: 'meeting',
          subject: 'Test Meeting',
          occurredAt: meetingDate,
          externalId: 'meeting-lastcontact-test',
          externalSource: 'google_calendar',
          participants: {
            create: [
              {
                contactId,
                role: 'attendee',
              },
            ],
          },
        },
      });

      // Trigger sync (this should update lastContact)
      await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify lastContact was updated
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      expect(contact.lastContact).toBeDefined();
      expect(new Date(contact.lastContact).toISOString()).toBe(meetingDate.toISOString());
    });

    it('should update lastContact to most recent meeting', async () => {
      const olderMeetingDate = new Date('2025-10-15T10:00:00Z');
      const newerMeetingDate = new Date('2025-11-25T10:00:00Z');

      // Create older meeting
      await prisma.interaction.create({
        data: {
          userId,
          interactionType: 'meeting',
          subject: 'Older Meeting',
          occurredAt: olderMeetingDate,
          externalId: 'meeting-older',
          externalSource: 'google_calendar',
          participants: {
            create: [{ contactId, role: 'attendee' }],
          },
        },
      });

      // Create newer meeting
      await prisma.interaction.create({
        data: {
          userId,
          interactionType: 'meeting',
          subject: 'Newer Meeting',
          occurredAt: newerMeetingDate,
          externalId: 'meeting-newer',
          externalSource: 'google_calendar',
          participants: {
            create: [{ contactId, role: 'attendee' }],
          },
        },
      });

      await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
      });

      // Should be the newer date
      expect(new Date(contact.lastContact).toISOString()).toBe(newerMeetingDate.toISOString());
    });
  });

  describe('Incremental Sync with Sync Token', () => {
    it('should use sync token for incremental sync', async () => {
      // First sync
      const firstSyncResponse = await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify sync token was stored
      const syncConfig = await prisma.calendarSyncConfig.findUnique({
        where: { userId },
      });

      expect(syncConfig.syncToken).toBeDefined();
      expect(syncConfig.lastSyncAt).toBeDefined();

      // Second sync (should use sync token)
      const secondSyncResponse = await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(secondSyncResponse.body).toHaveProperty('synced');
    });

    it('should perform full sync if sync token invalid', async () => {
      // Corrupt sync token
      await prisma.calendarSyncConfig.update({
        where: { userId },
        data: { syncToken: 'invalid-token' },
      });

      const syncResponse = await request(app.getHttpServer())
        .post('/api/v1/calendar/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Should succeed with full sync
      expect(syncResponse.body.synced).toBeGreaterThanOrEqual(0);

      // Verify new sync token was generated
      const syncConfig = await prisma.calendarSyncConfig.findUnique({
        where: { userId },
      });

      expect(syncConfig.syncToken).not.toBe('invalid-token');
    });
  });

  describe('Calendar Integration Status', () => {
    it('should return calendar integration status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/calendar/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        isConnected: expect.any(Boolean),
        provider: expect.any(String),
        totalMeetings: expect.any(Number),
        syncEnabled: expect.any(Boolean),
      });
    });
  });

  describe('Calendar Disconnection', () => {
    it('should disconnect calendar and preserve meeting data', async () => {
      // Get initial meeting count
      const initialMeetings = await prisma.interaction.count({
        where: {
          userId,
          interactionType: 'meeting',
        },
      });

      // Disconnect
      const response = await request(app.getHttpServer())
        .delete('/api/v1/integrations/calendar/disconnect')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify integration deleted
      const integration = await prisma.integration.findUnique({
        where: {
          userId_type: {
            userId,
            type: 'GOOGLE_CALENDAR',
          },
        },
      });

      expect(integration).toBeNull();

      // Verify meetings preserved
      const finalMeetings = await prisma.interaction.count({
        where: {
          userId,
          interactionType: 'meeting',
        },
      });

      expect(finalMeetings).toBe(initialMeetings);
    });
  });

  describe('Error Handling', () => {
    it('should handle unauthorized requests', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/calendar/events')
        .query({ type: 'upcoming' })
        .expect(401);
    });

    it('should handle invalid date formats', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/calendar/events')
        .query({ type: 'past', startDate: 'invalid', endDate: '2025-11-30' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should handle rate limiting', async () => {
      // Simulate rapid requests
      const requests = Array.from({ length: 100 }, () =>
        request(app.getHttpServer())
          .post('/api/v1/calendar/sync')
          .set('Authorization', `Bearer ${authToken}`),
      );

      const responses = await Promise.all(requests);

      // Some requests should be rate limited (429)
      const rateLimited = responses.filter((r) => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});
