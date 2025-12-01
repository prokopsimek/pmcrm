# Infrastructure Documentation

Complete infrastructure and deployment documentation for Personal Network CRM.

## Quick Links

### Essential Guides
- 📘 **[Main Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Start here for deployment
- 🐳 **[Docker Guide](./DOCKER_GUIDE.md)** - Docker deployment instructions
- 📊 **[Monitoring Setup](./MONITORING_SETUP.md)** - Monitoring and logging
- 💾 **[Backup & Recovery](./BACKUP_RECOVERY.md)** - Backup procedures
- ↩️ **[Rollback Guide](./ROLLBACK_GUIDE.md)** - Rollback procedures

### Platform-Specific Guides
- 🚂 **[Railway Setup](./RAILWAY_SETUP.md)** - Railway.app deployment
- ▲ **[Vercel Setup](./VERCEL_SETUP.md)** - Vercel frontend deployment
- ☁️ **[AWS Setup](./AWS_SETUP.md)** - AWS enterprise deployment

## Project Structure

```
infrastructure/
├── README.md                    # This file
├── DEPLOYMENT_GUIDE.md          # Main deployment guide
├── RAILWAY_SETUP.md             # Railway platform guide
├── VERCEL_SETUP.md              # Vercel frontend guide
├── AWS_SETUP.md                 # AWS deployment guide
├── DOCKER_GUIDE.md              # Docker operations guide
├── MONITORING_SETUP.md          # Monitoring configuration
├── BACKUP_RECOVERY.md           # Backup procedures
├── ROLLBACK_GUIDE.md            # Rollback procedures
├── terraform/                   # Terraform IaC
│   ├── main.tf                 # Main infrastructure
│   ├── variables.tf            # Variable definitions
│   └── terraform.tfvars.example # Example variables
├── nginx/                       # Nginx configuration
│   └── nginx.conf              # Reverse proxy config
├── monitoring/                  # Monitoring configs
│   ├── prometheus.yml          # Prometheus config
│   └── grafana-dashboard.json  # Grafana dashboard
└── postgres/                    # PostgreSQL configs
    └── Dockerfile.pgbouncer    # PgBouncer config
```

## Infrastructure Components

### Docker Images
- **Backend**: `/backend/Dockerfile.prod` - NestJS API (Node.js 20 Alpine)
- **Frontend**: `/frontend/Dockerfile.prod` - Next.js app (Node.js 20 Alpine)

### Docker Compose Files
- **Development**: `/docker-compose.yml` - Full dev stack with monitoring
- **Production**: `/docker-compose.prod.yml` - Optimized production stack

### CI/CD Pipelines
- **CI Pipeline**: `/.github/workflows/ci.yml` - Lint, test, build, security
- **CD Pipeline**: `/.github/workflows/cd.yml` - Deploy to staging/production

### Helper Scripts
- **Deploy**: `/scripts/deploy.sh` - Automated deployment
- **Backup**: `/scripts/backup-db.sh` - Database backup
- **Restore**: `/scripts/restore-db.sh` - Database restore

### Configuration Files
- **Environment**: `/.env.production.example` - Production environment template

## Deployment Options Comparison

| Platform | Complexity | Cost/Month | Setup Time | Best For |
|----------|-----------|------------|------------|----------|
| **Docker Compose** | Medium | $20-50 | 30 min | VPS, self-hosted |
| **Railway** | Low | $20-40 | 15 min | Staging, quick deploy |
| **Vercel + Railway** | Low-Medium | $40-80 | 30 min | Production with CDN |
| **AWS (Full)** | High | $88+ | 2-4 hours | Enterprise, full control |

## Quick Start

### 1. Choose Your Platform

**For Quick Start / Staging**:
```bash
# Railway - fastest deployment
# See: RAILWAY_SETUP.md
railway up
```

**For Production with CDN**:
```bash
# Frontend on Vercel, Backend on Railway
# See: VERCEL_SETUP.md + RAILWAY_SETUP.md
vercel --prod
railway up --environment production
```

**For Self-Hosted / VPS**:
```bash
# Docker Compose - full control
# See: DOCKER_GUIDE.md
./scripts/deploy.sh production
```

**For Enterprise / AWS**:
```bash
# Terraform - infrastructure as code
# See: AWS_SETUP.md
cd infrastructure/terraform
terraform init
terraform apply
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.production.example .env.production

# Edit with your values
nano .env.production
```

**Required variables**:
- `POSTGRES_PASSWORD` - Database password
- `REDIS_PASSWORD` - Redis password
- `JWT_SECRET` - JWT signing secret
- `SENTRY_DSN` - Sentry error tracking (optional)
- `CORS_ORIGIN` - Frontend URL

### 3. Deploy

```bash
# Using helper script
./scripts/deploy.sh production

# Or manually
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verify

```bash
# Check health
curl http://localhost:3001/health
curl http://localhost:3000

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Architecture Diagram

```
┌────────────────────────────────────────────────────┐
│                  Internet / Users                   │
└────────────────┬───────────────────────────────────┘
                 │
         ┌───────▼────────┐
         │  Load Balancer │
         │  (Nginx / ALB) │
         └───┬────────┬───┘
             │        │
     ┌───────▼──┐  ┌─▼────────┐
     │ Frontend │  │ Backend  │
     │ Next.js  │  │ NestJS   │
     │ :3000    │  │ :3001    │
     └──────────┘  └─┬────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
    ┌─────▼──────┐      ┌──────▼──────┐
    │ PostgreSQL │      │    Redis    │
    │   :5432    │      │    :6379    │
    └────────────┘      └─────────────┘
```

## Monitoring Stack

```
┌──────────────┐
│ Application  │
└──────┬───────┘
       │
       ├─────► Sentry (Error Tracking)
       ├─────► Winston (Logging)
       ├─────► Prometheus (Metrics)
       │
       ▼
┌──────────────┐
│   Grafana    │ ◄── Visualize metrics
└──────────────┘
```

## Security Checklist

Before deploying to production:

- [ ] All environment variables set and secure
- [ ] Strong passwords generated (use `openssl rand -base64 32`)
- [ ] JWT secret is random and secure (32+ characters)
- [ ] CORS origin set to actual domain
- [ ] HTTPS/SSL certificates configured
- [ ] Database backups enabled
- [ ] Monitoring configured (Sentry)
- [ ] Security headers enabled (Helmet.js)
- [ ] Rate limiting configured
- [ ] Non-root users in containers

## Backup Strategy

### Automated Backups
- **Database**: Daily at 2 AM (30-day retention)
- **Redis**: Every 6 hours (7-day retention)
- **Off-site**: Daily sync to S3 or equivalent

### Manual Backup
```bash
# Create backup
./scripts/backup-db.sh

# Restore from backup
./scripts/restore-db.sh /path/to/backup.dump.gz
```

## Monitoring & Alerts

### Health Checks
- Backend: `GET /health`
- Frontend: `GET /api/health`
- Database: Prisma connection check

### Key Metrics
- HTTP request rate and duration
- Error rate by endpoint
- Database query performance
- Cache hit/miss rates
- Memory and CPU usage

### Alerts
- Error rate > 10/min
- Response time > 1s (p95)
- Database connection failures
- Memory usage > 80%
- CPU usage > 80%

## Troubleshooting

### Common Issues

**Container won't start**:
```bash
docker logs pmcrm-backend-prod
docker-compose -f docker-compose.prod.yml ps
```

**Database connection failed**:
```bash
docker exec pmcrm-backend-prod npx prisma db execute --stdin <<< "SELECT 1"
```

**High memory usage**:
```bash
docker stats
# Adjust resource limits in docker-compose.prod.yml
```

**Logs not appearing**:
```bash
# Check log directory permissions
ls -la backend/logs/
```

## CI/CD Workflows

### Continuous Integration
**Triggered on**: Pull requests, pushes to main/develop

**Jobs**:
1. Lint code
2. Run tests (unit, integration, e2e)
3. Build Docker images
4. Security scanning

### Continuous Deployment
**Triggered on**: Version tags (v*.*.*)

**Jobs**:
1. Build and push Docker images
2. Deploy to staging (main branch)
3. Deploy to production (version tags)
4. Run smoke tests
5. Notify team

### Create Release
```bash
# Tag new version
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Automatic deployment starts
# Monitor at: https://github.com/your-org/pmcrm/actions
```

## Cost Optimization

### Development
- Use Docker Compose locally (free)
- Railway Hobby plan for staging ($0)

### Production

**Budget Option (~$25/month)**:
- VPS (DigitalOcean, Hetzner)
- Docker Compose deployment
- Backblaze B2 for backups

**Recommended Option (~$60/month)**:
- Railway for backend + database
- Vercel for frontend
- S3 for backups

**Enterprise Option (~$88/month)**:
- AWS full stack
- Auto-scaling
- Multi-region

## Support & Resources

### Documentation
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Docker Guide](./DOCKER_GUIDE.md)
- [Monitoring Setup](./MONITORING_SETUP.md)
- [Backup & Recovery](./BACKUP_RECOVERY.md)
- [Rollback Guide](./ROLLBACK_GUIDE.md)

### Platform Guides
- [Railway Setup](./RAILWAY_SETUP.md)
- [Vercel Setup](./VERCEL_SETUP.md)
- [AWS Setup](./AWS_SETUP.md)

### External Resources
- Docker: https://docs.docker.com
- Railway: https://docs.railway.app
- Vercel: https://vercel.com/docs
- AWS: https://docs.aws.amazon.com
- Sentry: https://docs.sentry.io

### Getting Help
- GitHub Issues: https://github.com/your-org/pmcrm/issues
- Documentation: This folder
- Team: DevOps team

## License

See main project LICENSE file.

## Contributing

See main project CONTRIBUTING.md file.

---

**Last Updated**: 2025-11-30
**Maintained by**: DevOps Team
