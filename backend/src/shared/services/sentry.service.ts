import { Injectable } from '@nestjs/common';

/**
 * Sentry Service Stub
 * TODO: Install @sentry/node and @sentry/profiling-node to enable error tracking
 */
@Injectable()
export class SentryService {
  captureException(error: Error): void {
    console.error('[Sentry stub] Exception:', error.message);
  }

  captureMessage(message: string): void {
    console.log('[Sentry stub] Message:', message);
  }

  setUser(_user: { id: string; email?: string }): void {
    // No-op stub
  }

  setTag(_key: string, _value: string): void {
    // No-op stub
  }
}
