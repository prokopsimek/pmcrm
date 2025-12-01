# Docker Deployment Guide

Complete guide for deploying Personal Network CRM using Docker and Docker Compose.

## Overview

Docker deployment provides:
- Consistent environments across development, staging, and production
- Easy scaling and orchestration
- Isolated services
- Simple rollback capabilities

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM
- 20GB disk space

## Quick Start

### Development Environment

```bash
# Clone repository
git clone https://github.com/your-org/pmcrm.git
cd pmcrm

# Start development environment
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment

```bash
# Create production environment file
cp .env.example .env.production

# Edit environment variables
nano .env.production

# Build and start production services
docker-compose -f docker-compose.prod.yml up -d

# Run database migrations
docker exec pmcrm-backend-prod npx prisma migrate deploy

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Docker Images

### Backend Image

**File**: `backend/Dockerfile.prod`

**Features**:
- Multi-stage build for smaller image size
- Non-root user for security
- Health check endpoint
- Production-optimized Node.js settings

**Build**:
```bash
docker build -t pmcrm-backend:latest -f backend/Dockerfile.prod backend/
```

### Frontend Image

**File**: `frontend/Dockerfile.prod`

**Features**:
- Multi-stage build
- Next.js standalone output
- Static asset optimization
- Non-root user

**Build**:
```bash
docker build -t pmcrm-frontend:latest -f frontend/Dockerfile.prod frontend/
```

## Docker Compose Configurations

### Development (docker-compose.yml)

Includes:
- Hot reload
- Debug ports exposed
- Volume mounts for source code
- Development database with test data
- Monitoring tools (Prometheus, Grafana)

### Production (docker-compose.prod.yml)

Includes:
- Optimized builds
- Resource limits
- Health checks
- Auto-restart policies
- Logging configuration
- Nginx reverse proxy

## Environment Variables

### Required Variables

Create `.env.production`:

```bash
# PostgreSQL
POSTGRES_DB=pmcrm
POSTGRES_USER=pmcrm_app
POSTGRES_PASSWORD=STRONG_RANDOM_PASSWORD_HERE

# Redis
REDIS_PASSWORD=ANOTHER_STRONG_PASSWORD_HERE

# Backend
JWT_SECRET=YOUR_SUPER_SECRET_JWT_KEY_HERE
CORS_ORIGIN=https://your-domain.com

# Monitoring
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Ports
BACKEND_PORT=3001
FRONTEND_PORT=3000
```

### Generate Secure Passwords

```bash
# Generate random password
openssl rand -base64 32

# Or using Docker
docker run --rm alpine sh -c "cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1"
```

## Service Management

### Start Services

```bash
# All services
docker-compose -f docker-compose.prod.yml up -d

# Specific service
docker-compose -f docker-compose.prod.yml up -d backend

# With build
docker-compose -f docker-compose.prod.yml up -d --build
```

### Stop Services

```bash
# Stop all
docker-compose -f docker-compose.prod.yml stop

# Stop specific service
docker-compose -f docker-compose.prod.yml stop backend

# Stop and remove
docker-compose -f docker-compose.prod.yml down
```

### Restart Services

```bash
# Restart all
docker-compose -f docker-compose.prod.yml restart

# Restart specific service
docker-compose -f docker-compose.prod.yml restart backend
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Scale Services

```bash
# Scale backend to 3 instances
docker-compose -f docker-compose.prod.yml up -d --scale backend=3

# Note: Requires load balancer configuration
```

## Database Operations

### Run Migrations

```bash
# Using docker exec
docker exec pmcrm-backend-prod npx prisma migrate deploy

# Using docker-compose
docker-compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

### Database Backup

```bash
# Backup database
docker exec pmcrm-postgres-prod pg_dump -U pmcrm_app pmcrm > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup to volume
docker exec pmcrm-postgres-prod pg_dump -U pmcrm_app pmcrm | gzip > /backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Database Restore

```bash
# Restore from backup
cat backup_20240101_120000.sql | docker exec -i pmcrm-postgres-prod psql -U pmcrm_app -d pmcrm

# From compressed backup
gunzip -c backup.sql.gz | docker exec -i pmcrm-postgres-prod psql -U pmcrm_app -d pmcrm
```

### Access Database Shell

```bash
# PostgreSQL
docker exec -it pmcrm-postgres-prod psql -U pmcrm_app -d pmcrm

# Redis
docker exec -it pmcrm-redis-prod redis-cli -a YOUR_REDIS_PASSWORD
```

## Health Checks

### Check Service Health

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Check specific service health
docker inspect pmcrm-backend-prod --format='{{.State.Health.Status}}'

# Test health endpoint
curl http://localhost:3001/health
```

### Health Check Configuration

Services include health checks:
- **PostgreSQL**: `pg_isready` every 10s
- **Redis**: `redis-cli ping` every 10s
- **Backend**: HTTP GET `/health` every 30s
- **Frontend**: HTTP GET `/api/health` every 30s

## Monitoring

### Resource Usage

```bash
# Real-time stats
docker stats

# Specific container
docker stats pmcrm-backend-prod

# Format output
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

### Container Logs

```bash
# Stream logs
docker logs -f pmcrm-backend-prod

# Last 100 lines
docker logs --tail 100 pmcrm-backend-prod

# Logs since specific time
docker logs --since 1h pmcrm-backend-prod
```

### Inspect Containers

```bash
# Inspect container
docker inspect pmcrm-backend-prod

# Get IP address
docker inspect pmcrm-backend-prod --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'

# Get environment variables
docker inspect pmcrm-backend-prod --format='{{range .Config.Env}}{{println .}}{{end}}'
```

## Networking

### Network Configuration

Docker Compose creates a network: `app-network` (172.20.0.0/16)

### Service Discovery

Services communicate using service names:
- Backend connects to PostgreSQL: `postgres:5432`
- Backend connects to Redis: `redis:6379`
- Frontend connects to Backend: `backend:3001`

### Port Mapping

- Frontend: `3000:3000`
- Backend: `3001:3001`
- PostgreSQL: `5432:5432` (dev only)
- Redis: `6379:6379` (dev only)

## Volume Management

### List Volumes

```bash
docker volume ls
```

### Inspect Volume

```bash
docker volume inspect pmcrm_postgres_data
```

### Backup Volume

```bash
# Backup PostgreSQL data
docker run --rm -v pmcrm_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz /data

# Backup Redis data
docker run --rm -v pmcrm_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis_backup.tar.gz /data
```

### Restore Volume

```bash
# Restore PostgreSQL data
docker run --rm -v pmcrm_postgres_data:/data -v $(pwd):/backup alpine sh -c "cd / && tar xzf /backup/postgres_backup.tar.gz"
```

### Clean Up Volumes

```bash
# Remove all unused volumes
docker volume prune

# Remove specific volume
docker volume rm pmcrm_postgres_data
```

## Security Best Practices

### Image Security

1. **Use non-root users**:
   ```dockerfile
   USER nestjs
   ```

2. **Scan images for vulnerabilities**:
   ```bash
   docker scan pmcrm-backend:latest
   ```

3. **Use specific base image versions**:
   ```dockerfile
   FROM node:20-alpine
   # Not: FROM node:latest
   ```

### Environment Security

1. **Never commit .env files**
2. **Use Docker secrets** (for Swarm):
   ```bash
   echo "my_secret" | docker secret create db_password -
   ```

3. **Limit container capabilities**:
   ```yaml
   security_opt:
     - no-new-privileges:true
   cap_drop:
     - ALL
   cap_add:
     - NET_BIND_SERVICE
   ```

### Network Security

1. **Use internal networks**:
   ```yaml
   networks:
     app-network:
       internal: true
   ```

2. **Limit exposed ports**
3. **Use TLS for external connections**

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker logs pmcrm-backend-prod

# Check last exit code
docker inspect pmcrm-backend-prod --format='{{.State.ExitCode}}'

# Try interactive shell
docker run -it pmcrm-backend:latest /bin/sh
```

### Network Issues

```bash
# Check networks
docker network ls

# Inspect network
docker network inspect pmcrm_app-network

# Test connectivity
docker exec pmcrm-backend-prod ping postgres
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Increase resources in docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.prod.yml ps postgres

# Check database logs
docker logs pmcrm-postgres-prod

# Test connection
docker exec pmcrm-backend-prod npx prisma db execute --stdin <<< "SELECT 1"
```

## Upgrading

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Restart services
docker-compose -f docker-compose.prod.yml up -d

# Run migrations
docker exec pmcrm-backend-prod npx prisma migrate deploy
```

### Update Base Images

```bash
# Pull latest base images
docker pull node:20-alpine
docker pull postgres:16-alpine
docker pull redis:7-alpine

# Rebuild
docker-compose -f docker-compose.prod.yml build --no-cache
```

## Clean Up

### Remove Containers

```bash
# Stop and remove all containers
docker-compose -f docker-compose.prod.yml down

# Remove with volumes
docker-compose -f docker-compose.prod.yml down -v

# Remove with images
docker-compose -f docker-compose.prod.yml down --rmi all
```

### Clean Docker System

```bash
# Remove all stopped containers
docker container prune

# Remove all unused images
docker image prune -a

# Remove all unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

## Production Deployment Checklist

- [ ] Environment variables configured
- [ ] Strong passwords generated
- [ ] Database backup configured
- [ ] Health checks passing
- [ ] Logs properly configured
- [ ] Resource limits set
- [ ] Security best practices applied
- [ ] Monitoring configured
- [ ] SSL/TLS certificates configured
- [ ] Reverse proxy configured

## Additional Resources

- Docker Documentation: https://docs.docker.com
- Docker Compose Documentation: https://docs.docker.com/compose/
- Docker Security Best Practices: https://docs.docker.com/engine/security/
- PostgreSQL Docker: https://hub.docker.com/_/postgres
- Redis Docker: https://hub.docker.com/_/redis
