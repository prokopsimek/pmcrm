import { Global, Module } from '@nestjs/common';
import { LoggerService } from './services/logger.service';
import { SentryService } from './services/sentry.service';

/**
 * Shared Module
 * Contains globally available services like logging and monitoring
 */
@Global()
@Module({
  providers: [LoggerService, SentryService],
  exports: [LoggerService, SentryService],
})
export class SharedModule {}
