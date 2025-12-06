import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const bullConfig = BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const redisUrl = new URL(configService.get<string>('REDIS_URL') || 'redis://localhost:6379');

    return {
      redis: {
        host: redisUrl.hostname,
        port: parseInt(redisUrl.port || '6379'),
        password: redisUrl.password || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    };
  },
});

// Queue names
export enum QueueName {
  EMAIL = 'email',
  NOTIFICATIONS = 'notifications',
  AI_PROCESSING = 'ai-processing',
  INTEGRATION_SYNC = 'integration-sync',
  CONTACT_SCORING = 'contact-scoring',
}
