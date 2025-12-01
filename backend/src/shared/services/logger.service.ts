import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';

/**
 * Logger Service Stub
 * TODO: Install winston to enable advanced logging
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  log(message: string, context?: string): void {
    console.log(`[${context || 'LOG'}] ${message}`);
  }

  error(message: string, trace?: string, context?: string): void {
    console.error(`[${context || 'ERROR'}] ${message}`, trace || '');
  }

  warn(message: string, context?: string): void {
    console.warn(`[${context || 'WARN'}] ${message}`);
  }

  debug(message: string, context?: string): void {
    console.debug(`[${context || 'DEBUG'}] ${message}`);
  }

  verbose(message: string, context?: string): void {
    console.log(`[${context || 'VERBOSE'}] ${message}`);
  }
}
