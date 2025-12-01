# Railway Deployment Setup

Complete guide for deploying Personal Network CRM to Railway.app

## Overview

Railway provides an easy-to-use platform for deploying applications with:
- Automatic HTTPS
- Built-in PostgreSQL and Redis
- GitHub integration
- Environment variable management
- Automatic deployments

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository
- Railway CLI (optional but recommended)

## Installation

### Install Railway CLI

```bash
npm install -g @railway/cli

# Login to Railway
railway login
```

## Deployment Steps

### 1. Create New Project

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Railway will detect your application automatically

### 2. Add Services

#### Add PostgreSQL Database

1. Click "New" → "Database" → "Add PostgreSQL"
2. Railway will provision a PostgreSQL instance
3. Note the connection details (automatically set as `DATABASE_URL`)

#### Add Redis

1. Click "New" → "Database" → "Add Redis"
2. Railway will provision a Redis instance
3. Note the connection details (automatically set as `REDIS_URL`)

### 3. Configure Backend Service

1. Select the backend service
2. Go to "Variables" tab
3. Add the following environment variables:

```bash
# Application
NODE_ENV=production
PORT=3001

# Database (Automatically set by Railway)
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Redis (Automatically set by Railway)
REDIS_URL=${{Redis.REDIS_URL}}

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://your-frontend-domain.vercel.app

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
LOG_LEVEL=info

# Rate Limiting
THROTTLE_TTL=60
THROTTLE_LIMIT=10
```

4. Go to "Settings" → "Build"
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npx prisma migrate deploy && npm run start:prod`
   - Root Directory: Leave empty or set to `/`

5. Go to "Settings" → "Networking"
   - Enable "Public Networking"
   - Note your backend URL (e.g., `https://your-app.railway.app`)

### 4. Configure Frontend Service (Optional)

If deploying frontend to Railway (recommended to use Vercel instead):

1. Create a new service for frontend
2. Add environment variables:

```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

3. Configure build settings:
   - Build Command: `cd frontend && npm install && npm run build`
   - Start Command: `cd frontend && npm start`

### 5. Run Database Migrations

#### Option A: Using Railway CLI

```bash
# Link to your project
railway link

# Run migrations
railway run npx prisma migrate deploy
```

#### Option B: Via Start Command

The start command in the backend service already includes migration:
```bash
npx prisma migrate deploy && npm run start:prod
```

### 6. Configure Custom Domain (Optional)

1. Go to backend service → "Settings" → "Networking"
2. Click "Custom Domain"
3. Add your domain (e.g., `api.your-domain.com`)
4. Configure DNS:
   - Add CNAME record pointing to Railway's domain

## Environment-Specific Configurations

### Staging Environment

Create a separate Railway project for staging:

```bash
# Using Railway CLI
railway environment staging
railway up
```

Add staging-specific variables:
```bash
SENTRY_ENVIRONMENT=staging
CORS_ORIGIN=https://staging.your-domain.com
```

### Production Environment

Use the main Railway project with production variables:

```bash
railway environment production
railway up
```

## Monitoring and Logs

### View Logs

```bash
# Using Railway CLI
railway logs

# Via Dashboard
# Go to service → "Deployments" → Click on deployment → "Logs"
```

### Metrics

1. Go to service dashboard
2. View "Metrics" tab for:
   - CPU usage
   - Memory usage
   - Network traffic
   - Response times

## Automatic Deployments

Railway automatically deploys when you push to your connected branch:

1. Go to "Settings" → "Service"
2. Configure deployment settings:
   - Branch: `main` (for production) or `develop` (for staging)
   - Auto-deploy: Enabled
   - Deploy on PR: Optional

## Scaling

### Vertical Scaling (Increase Resources)

1. Go to "Settings" → "Resources"
2. Adjust:
   - vCPU
   - RAM
   - Replicas

### Horizontal Scaling

Railway supports multiple replicas:
1. Go to "Settings" → "Resources"
2. Set number of replicas (requires paid plan)

## Backup and Restore

### Database Backups

Railway automatically backs up PostgreSQL databases.

#### Manual Backup

```bash
# Using Railway CLI
railway connect Postgres

# In PostgreSQL shell
pg_dump -U postgres -d railway > backup.sql
```

#### Restore Backup

```bash
railway connect Postgres

# In PostgreSQL shell
psql -U postgres -d railway < backup.sql
```

## Troubleshooting

### Build Failures

```bash
# Check build logs
railway logs --deployment <deployment-id>

# Rebuild
railway up --detach
```

### Database Connection Issues

```bash
# Test database connection
railway run npx prisma db execute --stdin <<< "SELECT 1"

# Regenerate DATABASE_URL
# Go to Postgres service → "Variables" → Click refresh
```

### Application Crashes

```bash
# Check application logs
railway logs

# Check environment variables
railway variables

# Restart service
railway restart
```

## Cost Optimization

Railway offers:
- **Starter Plan**: $5/month per user
- **Pro Plan**: $20/month per user
- Usage-based pricing for resources

Tips to reduce costs:
1. Use appropriate resource limits
2. Enable sleep mode for staging environments
3. Monitor usage in dashboard
4. Use Redis for caching to reduce database queries

## CI/CD Integration

Railway integrates with GitHub Actions. The `.github/workflows/cd.yml` includes Railway deployment:

```yaml
- name: Deploy to Railway
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
  run: |
    npm install -g @railway/cli
    railway up --service backend --environment production
```

### Get Railway Token

```bash
# Login via CLI
railway login

# Create token
railway token create
```

Add token to GitHub Secrets as `RAILWAY_TOKEN`.

## Additional Resources

- Railway Documentation: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- Railway Status: https://status.railway.app
- Pricing: https://railway.app/pricing
