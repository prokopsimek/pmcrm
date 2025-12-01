import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

export const bullConfig = BullModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: new URL(configService.get<string>('REDIS_URL') || 'redis://localhost:6379').hostname,
      port: parseInt(
        new URL(configService.get<string>('REDIS_URL') || 'redis://localhost:6379').port || '6379',
      ),
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
  }),
});

// Queue names
export enum QueueName {
  EMAIL = 'email',
  NOTIFICATIONS = 'notifications',
  AI_PROCESSING = 'ai-processing',
  INTEGRATION_SYNC = 'integration-sync',
  CONTACT_SCORING = 'contact-scoring',
}
