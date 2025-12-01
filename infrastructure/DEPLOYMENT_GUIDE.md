# Personal Network CRM - Deployment Guide

Complete guide for deploying the Personal Network CRM application to production.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Variables](#environment-variables)
4. [Deployment Options](#deployment-options)
5. [Production Checklist](#production-checklist)
6. [Monitoring and Logging](#monitoring-and-logging)
7. [Troubleshooting](#troubleshooting)

## Overview

The Personal Network CRM application consists of:
- **Backend**: NestJS API (Node.js 20)
- **Frontend**: Next.js application (React 19)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7

## Prerequisites

### Required Tools
- Node.js 20+
- Docker and Docker Compose
- Git
- AWS CLI (for AWS deployments)
- Terraform (optional, for infrastructure as code)

### Required Accounts
- GitHub account (for CI/CD)
- Cloud provider account (Railway, Vercel, AWS, etc.)
- Sentry account (for error tracking)
- Domain name (for production)

## Environment Variables

### Backend Environment Variables

Create a `.env.production` file in the project root:

```bash
# Application
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?schema=public&connection_limit=10&pool_timeout=20

# Redis
REDIS_URL=redis://:password@host:6379
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://your-frontend-domain.com

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
LOG_LEVEL=info

# Email (Optional)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASSWORD=your-email-password
EMAIL_FROM=noreply@example.com
```

### Frontend Environment Variables

Create a `.env.production` file in the frontend directory:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=https://api.your-domain.com

# Application
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

## Deployment Options

### Option 1: Docker Compose (Self-Hosted)

Best for: VPS, dedicated servers, or local production testing

```bash
# 1. Clone the repository
git clone https://github.com/your-org/pmcrm.git
cd pmcrm

# 2. Create environment files
cp .env.example .env.production
# Edit .env.production with your values

# 3. Build and start services
docker-compose -f docker-compose.prod.yml up -d

# 4. Run database migrations
docker exec pmcrm-backend-prod npx prisma migrate deploy

# 5. Check service health
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs
```

### Option 2: Railway (Recommended for Staging)

Best for: Quick deployment, staging environments

See [RAILWAY_SETUP.md](./RAILWAY_SETUP.md) for detailed instructions.

### Option 3: Vercel + Railway

Best for: Production deployments with global CDN

- **Frontend**: Deploy to Vercel (best Next.js hosting)
- **Backend**: Deploy to Railway

See [VERCEL_SETUP.md](./VERCEL_SETUP.md) for detailed instructions.

### Option 4: AWS (Full Control)

Best for: Enterprise deployments, full infrastructure control

See [AWS_SETUP.md](./AWS_SETUP.md) for detailed instructions.

## Production Checklist

### Security

- [ ] All environment variables are set correctly
- [ ] Database passwords are strong and unique
- [ ] JWT secret is randomly generated and secure
- [ ] CORS is configured properly
- [ ] Rate limiting is enabled
- [ ] HTTPS/SSL certificates are configured
- [ ] API keys are stored securely (not in code)
- [ ] Security headers are enabled (Helmet.js)

### Database

- [ ] Database migrations are applied
- [ ] Database backups are configured
- [ ] Connection pooling is configured
- [ ] Database performance is optimized
- [ ] Row-level security is enabled

### Performance

- [ ] Redis cache is configured
- [ ] CDN is configured for static assets
- [ ] Compression is enabled
- [ ] Database indexes are created
- [ ] Query optimization is done

### Monitoring

- [ ] Sentry error tracking is configured
- [ ] Application logging is set up
- [ ] Health check endpoints are working
- [ ] Performance monitoring is enabled
- [ ] Alerting is configured

### Reliability

- [ ] Database backups are automated
- [ ] Rollback procedure is tested
- [ ] Health checks are passing
- [ ] Auto-scaling is configured (if applicable)
- [ ] Load balancing is set up (if applicable)

## Monitoring and Logging

### Sentry Configuration

1. Create a Sentry project at https://sentry.io
2. Get your DSN from project settings
3. Add to environment variables:
   ```bash
   SENTRY_DSN=https://your-dsn@sentry.io/project-id
   SENTRY_ENVIRONMENT=production
   ```

### Log Locations

- **Docker Compose**: Logs are in `backend_logs` volume
- **Railway**: View logs in Railway dashboard
- **AWS**: CloudWatch Logs

### Health Check Endpoints

- Backend: `GET /health`
- Frontend: `GET /api/health`

## Troubleshooting

### Database Connection Issues

```bash
# Check database connectivity
docker exec pmcrm-backend-prod npx prisma db execute --stdin <<< "SELECT 1"

# Check connection pool
docker exec pmcrm-backend-prod node -e "require('./dist/main')"
```

### Redis Connection Issues

```bash
# Check Redis connectivity
docker exec pmcrm-redis-prod redis-cli ping

# Check Redis password
docker exec pmcrm-redis-prod redis-cli -a YOUR_PASSWORD ping
```

### Application Not Starting

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check database performance
docker exec pmcrm-postgres-prod psql -U pmcrm_app -d pmcrm -c "SELECT * FROM pg_stat_activity;"

# Check Redis memory
docker exec pmcrm-redis-prod redis-cli INFO memory
```

## Rollback Procedure

See [ROLLBACK_GUIDE.md](./ROLLBACK_GUIDE.md) for detailed rollback procedures.

## Backup and Recovery

See [BACKUP_RECOVERY.md](./BACKUP_RECOVERY.md) for backup and recovery procedures.

## Support

For issues and questions:
- GitHub Issues: https://github.com/your-org/pmcrm/issues
- Documentation: https://docs.your-domain.com
- Email: support@your-domain.com
