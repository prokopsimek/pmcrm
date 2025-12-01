import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

// Shared modules
import { ConfigModule } from './shared/config/config.module';
import { DatabaseModule } from './shared/database/database.module';
import { bullConfig } from './shared/config/bull.config';
import { RedisService } from './shared/config/redis.config';

// Middleware, filters, interceptors
import { LoggerMiddleware } from './shared/middleware/logger.middleware';
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';

// Guards
import { RolesGuard } from './shared/guards/roles.guard';

// Feature modules
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { AIModule } from './modules/ai/ai.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SearchModule } from './modules/search/search.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotesModule } from './modules/notes/notes.module';

@Module({
  imports: [
    // Core configuration
    ConfigModule,
    DatabaseModule,

    // Rate limiting
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('RATE_LIMIT_TTL') || 60000,
          limit: config.get<number>('RATE_LIMIT_MAX') || 100,
        },
      ],
    }),

    // Background jobs
    bullConfig,

    // Feature modules
    HealthModule,
    AuthModule, // Better-auth authentication
    UsersModule,
    ContactsModule,
    RemindersModule,
    AIModule,
    IntegrationsModule,
    NotificationsModule,
    SearchModule,
    DashboardModule,
    OrganizationsModule,
    AdminModule,
    NotesModule,
  ],
  providers: [
    // Global services
    RedisService,

    // Global guards
    {
      provide: APP_GUARD,
      useClass: AuthGuard, // Better-auth guard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },

    // Global filters
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
