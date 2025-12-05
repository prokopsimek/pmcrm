import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthGuard } from '@thallesp/nestjs-better-auth';

// Shared modules
import { bullConfig } from './shared/config/bull.config';
import { ConfigModule } from './shared/config/config.module';
import { RedisService } from './shared/config/redis.config';
import { DatabaseModule } from './shared/database/database.module';

// Middleware, filters, interceptors
import { AllExceptionsFilter } from './shared/filters/http-exception.filter';
import { TransformInterceptor } from './shared/interceptors/transform.interceptor';
import { LoggerMiddleware } from './shared/middleware/logger.middleware';

// Guards
import { RolesGuard } from './shared/guards/roles.guard';

// Feature modules
import { AdminModule } from './modules/admin/admin.module';
import { AIModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { NotesModule } from './modules/notes/notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { SavedViewsModule } from './modules/saved-views/saved-views.module';
import { SearchModule } from './modules/search/search.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { UsersModule } from './modules/users/users.module';

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
    SavedViewsModule,
    TimelineModule,
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
