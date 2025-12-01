# Monitoring and Logging Setup

Complete guide for setting up monitoring, logging, and alerting for Personal Network CRM.

## Overview

Monitoring stack includes:
- **Sentry**: Error tracking and performance monitoring
- **Winston**: Application logging
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **CloudWatch**: AWS monitoring (if using AWS)
- **Vercel Analytics**: Frontend performance (if using Vercel)

## Sentry Setup

### 1. Create Sentry Account

1. Go to https://sentry.io
2. Create account or login
3. Create new project:
   - Platform: Node.js
   - Project name: personal-network-crm-backend

4. Create frontend project:
   - Platform: Next.js
   - Project name: personal-network-crm-frontend

### 2. Install Sentry SDKs

#### Backend

Already included in dependencies. Install additional packages:

```bash
cd backend
npm install @sentry/node @sentry/profiling-node
```

#### Frontend

```bash
cd frontend
npm install @sentry/nextjs
```

### 3. Configure Sentry

#### Backend Configuration

Create `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import { AppModule } from './app.module';

async function bootstrap() {
  // Initialize Sentry
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      release: process.env.npm_package_version,

      // Performance Monitoring
      tracesSampleRate: 0.1, // 10% of transactions
      profilesSampleRate: 0.1, // 10% profiling

      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new ProfilingIntegration(),
      ],

      beforeSend(event, hint) {
        // Filter sensitive data
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        return event;
      },
    });
  }

  const app = await NestFactory.create(AppModule);

  // ... rest of app configuration

  await app.listen(3001);
}

bootstrap();
```

#### Frontend Configuration

Run Sentry wizard:

```bash
cd frontend
npx @sentry/wizard@latest -i nextjs
```

Or manually create `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    new Sentry.Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
});
```

### 4. Environment Variables

Add to `.env.production`:

```bash
# Backend
SENTRY_DSN=https://your-backend-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# Frontend
NEXT_PUBLIC_SENTRY_DSN=https://your-frontend-dsn@sentry.io/project-id
```

### 5. Test Sentry Integration

#### Backend

```typescript
// controllers/test.controller.ts
@Get('/sentry-test')
testSentry() {
  throw new Error('Test Sentry error');
}
```

#### Frontend

```typescript
// app/test-sentry/page.tsx
export default function TestSentry() {
  return (
    <button onClick={() => {
      throw new Error('Test Sentry error from frontend');
    }}>
      Trigger Error
    </button>
  );
}
```

## Winston Logger Setup

### 1. Configuration

The logger service is already created at `backend/src/shared/services/logger.service.ts`.

### 2. Usage in Application

```typescript
import { LoggerService } from './shared/services/logger.service';

@Controller()
export class AppController {
  private readonly logger = new LoggerService('AppController');

  @Get()
  getHello(): string {
    this.logger.log('Hello endpoint called');
    return 'Hello World!';
  }

  @Post()
  create(@Body() data: any) {
    this.logger.logWithMeta('info', 'Creating resource', {
      userId: data.userId,
      resourceType: data.type,
    });

    try {
      // Create resource
    } catch (error) {
      this.logger.error('Failed to create resource', error.stack);
      throw error;
    }
  }
}
```

### 3. Log Levels

- `error`: Error messages
- `warn`: Warning messages
- `info`: Informational messages
- `debug`: Debug messages
- `verbose`: Verbose messages

### 4. Log Rotation

Configure log rotation in production:

```bash
cd backend
npm install winston-daily-rotate-file
```

Update logger service:

```typescript
import DailyRotateFile from 'winston-daily-rotate-file';

const transports = [
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
  }),
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
  }),
];
```

## Prometheus & Grafana

### 1. Already Configured

Prometheus and Grafana are included in `docker-compose.yml`.

### 2. Access Dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3030 (admin/admin)

### 3. Add Custom Metrics

Install Prometheus client:

```bash
cd backend
npm install prom-client
```

Create metrics service:

```typescript
// backend/src/shared/services/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  private readonly httpRequestCounter: Counter;
  private readonly httpRequestDuration: Histogram;
  private readonly databaseQueryDuration: Histogram;

  constructor() {
    this.registry = new Registry();

    this.httpRequestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.databaseQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query duration',
      labelNames: ['operation'],
      registers: [this.registry],
    });
  }

  incrementHttpRequest(method: string, route: string, status: number) {
    this.httpRequestCounter.inc({ method, route, status });
  }

  observeHttpDuration(method: string, route: string, status: number, duration: number) {
    this.httpRequestDuration.observe({ method, route, status }, duration);
  }

  observeDbQueryDuration(operation: string, duration: number) {
    this.databaseQueryDuration.observe({ operation }, duration);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
```

### 4. Expose Metrics Endpoint

```typescript
// backend/src/app.controller.ts
@Get('/metrics')
async getMetrics() {
  return this.metricsService.getMetrics();
}
```

### 5. Create Grafana Dashboard

1. Login to Grafana (http://localhost:3030)
2. Add Prometheus data source:
   - URL: http://prometheus:9090
3. Import dashboard:
   - Use `infrastructure/monitoring/grafana-dashboard.json`
4. Or create custom dashboard with panels:
   - HTTP request rate
   - Response time percentiles
   - Error rate
   - Database query duration
   - Cache hit rate
   - Memory usage
   - CPU usage

## Application Performance Monitoring (APM)

### 1. Performance Tracking

#### Backend

```typescript
// Middleware to track request duration
@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;

      this.logger.logRequest(
        req.method,
        req.path,
        res.statusCode,
        duration,
      );

      this.metrics.observeHttpDuration(
        req.method,
        req.path,
        res.statusCode,
        duration / 1000,
      );
    });

    next();
  }
}
```

#### Frontend

Use Vercel Analytics:

```bash
npm install @vercel/analytics
```

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

## Alerting

### 1. Sentry Alerts

Configure in Sentry dashboard:
- Error rate > 10 per minute
- New issue detected
- Issue regression
- Performance degradation

### 2. Grafana Alerts

Create alert rules:

```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: High error rate detected

# High response time
- alert: HighResponseTime
  expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: High response time detected
```

### 3. Email/Slack Notifications

Configure notification channels in Grafana:
1. Go to Alerting → Notification channels
2. Add channel (Email, Slack, PagerDuty, etc.)
3. Test notification

## Health Checks

### 1. Backend Health Endpoint

```typescript
// backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
```

### 2. Frontend Health Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
```

### 3. Uptime Monitoring

Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake
- Better Uptime

Configure to check:
- https://your-domain.com/health (every 5 minutes)
- https://api.your-domain.com/health (every 5 minutes)

## Log Aggregation

### Option 1: ELK Stack (Self-Hosted)

```yaml
# docker-compose.monitoring.yml
services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node

  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
```

### Option 2: Cloud Solutions

- **Datadog**: https://www.datadoghq.com
- **Loggly**: https://www.loggly.com
- **Papertrail**: https://www.papertrail.com
- **LogDNA**: https://www.logdna.com

## Best Practices

1. **Log Sampling**: Don't log every request in production
2. **Structured Logging**: Use JSON format
3. **Correlation IDs**: Track requests across services
4. **Error Context**: Include relevant data with errors
5. **PII Protection**: Never log sensitive data
6. **Log Rotation**: Prevent disk space issues
7. **Alerting Threshold**: Set appropriate thresholds
8. **Dashboard Organization**: Group related metrics

## Troubleshooting

### Sentry Not Receiving Errors

```bash
# Check DSN is set
echo $SENTRY_DSN

# Test manually
curl -X POST 'https://sentry.io/api/YOUR_PROJECT_ID/store/' \
  -H 'X-Sentry-Auth: Sentry sentry_key=YOUR_KEY' \
  -d '{"message":"Test"}'
```

### Logs Not Appearing

```bash
# Check log directory permissions
ls -la backend/logs/

# Check logger configuration
docker exec pmcrm-backend-prod cat dist/shared/services/logger.service.js
```

### Metrics Not Showing in Grafana

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Check metrics endpoint
curl http://localhost:3001/metrics
```

## Additional Resources

- Sentry Documentation: https://docs.sentry.io
- Winston Documentation: https://github.com/winstonjs/winston
- Prometheus Documentation: https://prometheus.io/docs/
- Grafana Documentation: https://grafana.com/docs/
