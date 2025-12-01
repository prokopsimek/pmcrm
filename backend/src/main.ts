import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    // Note: CORS is configured via app.enableCors() below with credentials: true
    // Disable body parser for better-auth to handle raw requests
    bodyParser: false,
  });

  const configService = app.get(ConfigService);

  // Body parsers - disabled globally for better-auth, re-enabled selectively
  // Better-auth handles its own body parsing at /api/auth/* routes
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Security middleware
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  // CORS configuration
  const allowedOrigins = configService
    .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
    .split(',');

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API prefix - exclude health and auth routes
  // Note: Using named parameter syntax for path-to-regexp v8+
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/liveness', 'health/readiness', 'api/auth/*path'],
  });

  // Swagger documentation
  if (configService.get<boolean>('ENABLE_SWAGGER', true)) {
    const config = new DocumentBuilder()
      .setTitle('Personal Network CRM API')
      .setDescription(
        'AI-powered relationship management system for maintaining and nurturing personal and professional networks',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Health', 'Health check endpoints')
      .addTag('Auth', 'Authentication (better-auth)')
      .addTag('Users', 'User management')
      .addTag('Contacts', 'Contact management')
      .addTag('AI', 'AI insights and recommendations')
      .addTag('Integrations', 'Third-party integrations')
      .addTag('Notifications', 'Notification system')
      .addTag('Search', 'Search functionality')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Personal Network CRM API',
      customCss: '.swagger-ui .topbar { display: none }',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
      },
    });

    logger.log('Swagger documentation available at /api/docs');
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Environment: ${configService.get<string>('NODE_ENV', 'development')}`);
  logger.log(`API available at: http://localhost:${port}/api/v1`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
