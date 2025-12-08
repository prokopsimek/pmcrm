import { InjectQueue } from '@nestjs/bull';
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import type { Queue } from 'bull';
import { QueueName } from '../../../shared/config/bull.config';
import { PrismaService } from '../../../shared/database/prisma.service';
import type { GmailSyncJobData } from '../email-sync/jobs/gmail-sync.job';
import { EmailMatcherService } from '../email-sync/services/email-matcher.service';
import { GmailClientService } from '../email-sync/services/gmail-client.service';
import { OAuthService } from '../shared/oauth.service';
import {
    EmailSyncResultDto,
    GmailConfigResponseDto,
    GmailDisconnectResponseDto,
    GmailOAuthCallbackResponseDto,
    GmailOAuthInitiateResponseDto,
    GmailStatusResponseDto,
    GmailSyncJobResponseDto,
    GmailSyncJobStatusDto,
    QueueGmailSyncDto,
    TriggerSyncDto,
    UpdateGmailConfigDto,
} from './dto';

/**
 * Gmail Integration Service
 * Implements OAuth 2.0 flow, email sync configuration, and email synchronization
 */
interface GmailStateData {
  userId: string;
  timestamp: number;
  orgSlug?: string;
  redirectUrl?: string;
}

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private readonly GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
  private readonly stateStore = new Map<string, GmailStateData>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauthService: OAuthService,
    private readonly gmailClient: GmailClientService,
    private readonly emailMatcher: EmailMatcherService,
    @InjectQueue(QueueName.INTEGRATION_SYNC)
    private readonly syncQueue: Queue,
  ) {}

  /**
   * Initiate OAuth flow for Gmail
   */
  async initiateOAuthFlow(
    userId: string,
    orgSlug?: string,
  ): Promise<GmailOAuthInitiateResponseDto> {
    this.logger.log(`Initiating Gmail OAuth flow for user ${userId}`);

    // Check if OAuth is properly configured
    if (!this.oauthService.isConfigured('google')) {
      throw new BadRequestException(
        'Google OAuth is not configured. Please set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and OAUTH_ENCRYPTION_KEY environment variables.',
      );
    }

    try {
      const authUrl = this.oauthService.generateAuthUrl({
        scopes: this.GMAIL_SCOPES,
        userId,
        provider: 'google',
        usePKCE: false,
        integration: 'gmail', // Use /gmail/callback instead of /google/callback
      });

      // Extract state from URL
      const url = new URL(authUrl);
      const state = url.searchParams.get('state') || '';

      // Store state for validation (including orgSlug for redirect)
      this.stateStore.set(state, { userId, timestamp: Date.now(), orgSlug });

      return {
        authUrl,
        state,
      };
    } catch (error) {
      this.logger.error(
        `Failed to initiate Gmail OAuth flow: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new BadRequestException(
        `Failed to initiate Gmail OAuth: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Handle OAuth callback and store tokens
   */
  async handleOAuthCallback(
    code: string,
    state: string,
  ): Promise<GmailOAuthCallbackResponseDto & { orgSlug?: string }> {
    // Extract and validate state data
    const stateData = this.extractStateData(state);
    if (!stateData) {
      throw new BadRequestException('Invalid or expired state parameter');
    }

    const { userId, orgSlug } = stateData;
    this.logger.log(`Handling Gmail OAuth callback for user ${userId}`);

    try {
      // Exchange code for tokens
      const tokens = await this.oauthService.exchangeCodeForTokens({
        code,
        provider: 'google',
        integration: 'gmail', // Must match the redirect_uri used in generateAuthUrl
      });

      // Encrypt tokens
      const encryptedAccessToken = this.oauthService.encryptToken(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token
        ? this.oauthService.encryptToken(tokens.refresh_token)
        : null;

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      // Create or update GMAIL integration record
      const integration = await this.prisma.integration.upsert({
        where: {
          userId_type: {
            userId,
            type: 'GMAIL',
          },
        },
        update: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          type: 'GMAIL',
          name: 'Gmail',
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          isActive: true,
          metadata: {},
        },
      });

      // Create or update EmailSyncConfig
      await this.prisma.emailSyncConfig.upsert({
        where: { userId },
        update: {
          gmailEnabled: true,
          updatedAt: new Date(),
        },
        create: {
          userId,
          gmailEnabled: true,
          outlookEnabled: false,
          privacyMode: true, // Default to privacy mode (metadata only)
          syncEnabled: true,
          excludedEmails: [],
          excludedDomains: [],
        },
      });

      this.logger.log(`Gmail integration created: ${integration.id}`);

      return {
        success: true,
        integrationId: integration.id,
        message: 'Gmail connected successfully',
        orgSlug,
      };
    } catch (error) {
      this.logger.error(
        `Gmail OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new UnauthorizedException('Failed to exchange authorization code');
    }
  }

  /**
   * Get Gmail integration status
   */
  async getStatus(userId: string): Promise<GmailStatusResponseDto> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: 'GMAIL',
        },
      },
    });

    const config = await this.prisma.emailSyncConfig.findUnique({
      where: { userId },
    });

    if (!integration) {
      return {
        isConnected: false,
        totalEmailsSynced: 0,
        syncEnabled: false,
        privacyMode: true,
      };
    }

    // Count synced emails
    const emailCount = await this.prisma.emailThread.count({
      where: {
        source: 'gmail',
        contact: {
          userId,
        },
      },
    });

    return {
      isConnected: true,
      integrationId: integration.id,
      connectedAt: integration.createdAt,
      lastSyncAt: config?.lastGmailSync || undefined,
      totalEmailsSynced: emailCount,
      syncEnabled: config?.syncEnabled ?? true,
      privacyMode: config?.privacyMode ?? true,
      isActive: integration.isActive,
    };
  }

  /**
   * Get Gmail sync configuration
   */
  async getConfig(userId: string): Promise<GmailConfigResponseDto | null> {
    const config = await this.prisma.emailSyncConfig.findUnique({
      where: { userId },
    });

    if (!config) {
      return null;
    }

    return {
      id: config.id,
      userId: config.userId,
      gmailEnabled: config.gmailEnabled,
      syncEnabled: config.syncEnabled,
      privacyMode: config.privacyMode,
      syncHistoryDays: config.syncHistoryDays,
      excludedEmails: config.excludedEmails,
      excludedDomains: config.excludedDomains,
      lastGmailSync: config.lastGmailSync,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Update Gmail sync configuration
   */
  async updateConfig(userId: string, dto: UpdateGmailConfigDto): Promise<GmailConfigResponseDto> {
    const config = await this.prisma.emailSyncConfig.upsert({
      where: { userId },
      update: {
        syncEnabled: dto.syncEnabled,
        privacyMode: dto.privacyMode,
        syncHistoryDays: dto.syncHistoryDays,
        excludedEmails: dto.excludedEmails,
        excludedDomains: dto.excludedDomains,
        updatedAt: new Date(),
      },
      create: {
        userId,
        gmailEnabled: true,
        outlookEnabled: false,
        syncEnabled: dto.syncEnabled ?? true,
        privacyMode: dto.privacyMode ?? true,
        syncHistoryDays: dto.syncHistoryDays ?? 365,
        excludedEmails: dto.excludedEmails ?? [],
        excludedDomains: dto.excludedDomains ?? [],
      },
    });

    return {
      id: config.id,
      userId: config.userId,
      gmailEnabled: config.gmailEnabled,
      syncEnabled: config.syncEnabled,
      privacyMode: config.privacyMode,
      syncHistoryDays: config.syncHistoryDays,
      excludedEmails: config.excludedEmails,
      excludedDomains: config.excludedDomains,
      lastGmailSync: config.lastGmailSync,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Trigger email sync for a user
   */
  async syncEmails(userId: string, options?: TriggerSyncDto): Promise<EmailSyncResultDto> {
    const startTime = Date.now();
    this.logger.log(`Syncing Gmail emails for user ${userId}`);

    // Get integration and config
    const integration = await this.getActiveIntegration(userId);
    const config = await this.prisma.emailSyncConfig.findUnique({
      where: { userId },
    });

    if (!config?.gmailEnabled) {
      throw new BadRequestException('Gmail is not enabled for this user');
    }

    if (!config.syncEnabled) {
      throw new BadRequestException('Email sync is disabled');
    }

    // Get valid access token
    const accessToken = await this.getValidAccessToken(integration);

    // Get user email for direction detection
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user?.email) {
      throw new BadRequestException('User email not found');
    }

    try {
      let emailsProcessed = 0;
      let emailsStored = 0;
      let contactsMatched = 0;
      const errors: Array<{
        emailId?: string;
        contactId?: string;
        error: string;
        timestamp: Date;
      }> = [];

      // Determine sync strategy
      const metadata = integration.metadata as Record<string, unknown> | null;
      const historyId = metadata?.historyId as string | undefined;

      let messages;
      let newHistoryId: string | undefined;

      if (historyId && !options?.fullSync) {
        // Incremental sync
        const result = await this.gmailClient.fetchIncrementalMessages(accessToken, historyId);
        messages = result.messages;
        newHistoryId = result.newHistoryId;
      } else {
        // Full sync - fetch recent messages
        messages = await this.gmailClient.fetchMessages(accessToken, {
          maxResults: 100,
          query: 'newer_than:30d', // Last 30 days
        });
      }

      emailsProcessed = messages.length;

      // Process each message
      for (const message of messages) {
        try {
          // Match email participants to contacts
          const matchedContacts = await this.emailMatcher.matchEmailToContacts(
            userId,
            message,
            user.email,
          );

          if (matchedContacts.length === 0) {
            continue; // Skip emails that don't match any contacts
          }

          contactsMatched += matchedContacts.length;

          // Store email for each matched contact
          for (const contact of matchedContacts) {
            // Check if email is excluded
            if (contact.email && this.isEmailExcluded(contact.email, config)) {
              continue;
            }

            // Determine email direction
            const fromEmail = message.from.email.toLowerCase();
            const direction = fromEmail === user.email.toLowerCase() ? 'OUTBOUND' : 'INBOUND';

            // Store email (respecting privacy mode)
            await this.prisma.emailThread.upsert({
              where: {
                contactId_externalId: {
                  contactId: contact.id,
                  externalId: message.id,
                },
              },
              create: {
                contactId: contact.id,
                threadId: message.threadId,
                subject: message.subject,
                snippet: message.snippet,
                body: config.privacyMode ? null : message.body?.slice(0, 10000),
                direction,
                occurredAt: message.receivedAt,
                externalId: message.id,
                source: 'gmail',
                metadata: JSON.parse(
                  JSON.stringify({
                    from: message.from,
                    to: message.to,
                    cc: message.cc,
                  }),
                ),
              },
              update: {
                subject: message.subject,
                snippet: message.snippet,
                body: config.privacyMode ? null : message.body?.slice(0, 10000),
                occurredAt: message.receivedAt,
              },
            });

            emailsStored++;

            // Update contact's lastContact date
            await this.prisma.contact.update({
              where: { id: contact.id },
              data: { lastContact: message.receivedAt },
            });
          }
        } catch (error) {
          errors.push({
            emailId: message.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
          });
        }
      }

      // Update last sync time and history ID
      await this.prisma.emailSyncConfig.update({
        where: { userId },
        data: {
          lastGmailSync: new Date(),
        },
      });

      if (newHistoryId) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            metadata: {
              ...(integration.metadata as object),
              historyId: newHistoryId,
            },
          },
        });
      }

      const duration = Date.now() - startTime;

      return {
        success: true,
        provider: 'gmail',
        emailsProcessed,
        emailsStored,
        contactsMatched,
        errors,
        duration,
        syncedAt: new Date(),
        newHistoryId,
      };
    } catch (error) {
      this.logger.error(
        `Gmail sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Queue background email sync job
   * Returns immediately with job ID for status tracking
   */
  async queueEmailSync(
    userId: string,
    options?: QueueGmailSyncDto,
  ): Promise<GmailSyncJobResponseDto> {
    this.logger.log(`Queueing Gmail background sync for user ${userId}`);

    // Validate integration exists
    const integration = await this.getActiveIntegration(userId);

    const config = await this.prisma.emailSyncConfig.findUnique({
      where: { userId },
    });

    if (!config?.gmailEnabled) {
      throw new BadRequestException('Gmail is not enabled for this user');
    }

    if (!config.syncEnabled) {
      throw new BadRequestException('Email sync is disabled');
    }

    // Check if there's already an active sync job
    const existingJob = await this.prisma.importJob.findFirst({
      where: {
        userId,
        type: 'gmail_email_sync',
        status: { in: ['queued', 'processing'] },
      },
    });

    if (existingJob) {
      return {
        jobId: existingJob.id,
        status: existingJob.status as 'queued' | 'processing',
        message: 'A Gmail sync is already in progress',
      };
    }

    // Use historyDays from options, or fall back to user's configured value
    const historyDays = options?.historyDays ?? config.syncHistoryDays;

    // Create ImportJob record
    const importJob = await this.prisma.importJob.create({
      data: {
        userId,
        type: 'gmail_email_sync',
        status: 'queued',
        totalCount: 0,
        processedCount: 0,
        importedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        errors: [],
        metadata: {
          fullSync: options?.fullSync ?? false,
          historyDays,
        },
      },
    });

    // Queue the background job
    const jobData: GmailSyncJobData = {
      jobId: importJob.id,
      userId,
      fullSync: options?.fullSync,
      historyDays,
    };

    await this.syncQueue.add('sync-gmail-background', jobData, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 30000, // 30 seconds base delay
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
    });

    this.logger.log(`Gmail sync job ${importJob.id} queued for user ${userId}`);

    return {
      jobId: importJob.id,
      status: 'queued',
      message: 'Gmail sync job queued successfully. Check status using the job ID.',
    };
  }

  /**
   * Get Gmail sync job status
   */
  async getSyncJobStatus(userId: string, jobId: string): Promise<GmailSyncJobStatusDto> {
    const job = await this.prisma.importJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Sync job not found');
    }

    if (job.userId !== userId) {
      throw new ForbiddenException('You do not have access to this job');
    }

    if (job.type !== 'gmail_email_sync') {
      throw new BadRequestException('Invalid job type');
    }

    const progress =
      job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 0;

    return {
      jobId: job.id,
      status: job.status as 'queued' | 'processing' | 'completed' | 'failed',
      totalCount: job.totalCount,
      processedCount: job.processedCount,
      importedCount: job.importedCount,
      skippedCount: job.skippedCount,
      failedCount: job.failedCount,
      progress,
      errors: (job.errors as Array<{ emailId?: string; error: string }>) || [],
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
      createdAt: job.createdAt,
      metadata: job.metadata as Record<string, unknown> | undefined,
    };
  }

  /**
   * Disconnect Gmail integration
   */
  async disconnect(userId: string): Promise<GmailDisconnectResponseDto> {
    this.logger.log(`Disconnecting Gmail for user ${userId}`);

    const integration = await this.getActiveIntegration(userId);

    // Try to revoke token (best effort)
    let tokensRevoked = false;
    try {
      if (integration.accessToken) {
        const accessToken = this.oauthService.decryptToken(integration.accessToken);
        tokensRevoked = await this.oauthService.revokeToken(accessToken, 'google');
      }
    } catch (error) {
      this.logger.warn(
        `Token revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Delete integration
    await this.prisma.integration.delete({
      where: {
        userId_type: {
          userId,
          type: 'GMAIL',
        },
      },
    });

    // Update EmailSyncConfig
    await this.prisma.emailSyncConfig.update({
      where: { userId },
      data: {
        gmailEnabled: false,
        lastGmailSync: null,
      },
    });

    return {
      success: true,
      tokensRevoked,
      emailsPreserved: true,
      message: 'Gmail disconnected successfully. Your synced emails remain in your account.',
    };
  }

  // Private helper methods

  /**
   * Extract state data from state parameter
   */
  private extractStateData(state: string): GmailStateData | null {
    if (!state) {
      return null;
    }

    const stored = this.stateStore.get(state);
    if (!stored) {
      this.logger.warn(`State not found in store: ${state}`);
      return null;
    }

    // State expires after 10 minutes
    if (Date.now() - stored.timestamp > 10 * 60 * 1000) {
      this.stateStore.delete(state);
      this.logger.warn(`State expired: ${state}`);
      return null;
    }

    // Clean up used state
    this.stateStore.delete(state);

    return stored;
  }

  /**
   * Get active Gmail integration or throw error
   */
  private async getActiveIntegration(userId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        userId_type: {
          userId,
          type: 'GMAIL',
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('No active Gmail integration');
    }

    if (!integration.isActive) {
      throw new BadRequestException('Gmail integration is deactivated');
    }

    return integration;
  }

  /**
   * Get valid access token (refresh if expired)
   */
  private async getValidAccessToken(integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
  }): Promise<string> {
    if (!integration.accessToken) {
      throw new BadRequestException('Gmail access token not available');
    }

    // Check if token is expired or about to expire (5 min buffer)
    if (
      integration.expiresAt &&
      new Date() >= new Date(integration.expiresAt.getTime() - 5 * 60 * 1000)
    ) {
      if (!integration.refreshToken) {
        throw new BadRequestException('Gmail refresh token not available. Please reconnect.');
      }

      this.logger.log('Access token expired, refreshing...');

      const refreshToken = this.oauthService.decryptToken(integration.refreshToken);
      const newTokens = await this.oauthService.refreshAccessToken(refreshToken, 'google');

      const encryptedAccessToken = this.oauthService.encryptToken(newTokens.access_token);

      // Update integration with new token
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          accessToken: encryptedAccessToken,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
        },
      });

      return newTokens.access_token;
    }

    return this.oauthService.decryptToken(integration.accessToken);
  }

  /**
   * Check if email should be excluded from sync
   */
  private isEmailExcluded(
    email: string,
    config: { excludedEmails: string[]; excludedDomains: string[] },
  ): boolean {
    const emailLower = email.toLowerCase();

    // Check excluded emails
    if (config.excludedEmails.some((e) => e.toLowerCase() === emailLower)) {
      return true;
    }

    // Check excluded domains
    const domain = emailLower.split('@')[1];
    if (domain && config.excludedDomains.some((d) => d.toLowerCase() === domain)) {
      return true;
    }

    return false;
  }
}
