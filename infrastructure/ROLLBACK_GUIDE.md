# Rollback Guide

Complete guide for rolling back deployments in case of issues.

## Overview

Rollback strategies for different deployment scenarios:
- **Docker Compose**: Container version rollback
- **Railway**: Deployment rollback
- **Vercel**: Deployment promotion
- **AWS ECS**: Task definition revision rollback
- **Database**: Migration rollback

## Quick Rollback

### Emergency Rollback (< 5 minutes)

```bash
# 1. Stop current deployment
docker-compose -f docker-compose.prod.yml stop

# 2. Pull previous stable version
git checkout v1.2.3  # Previous stable tag

# 3. Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Verify
curl https://api.your-domain.com/health
```

## Docker Compose Rollback

### Rollback to Previous Image

```bash
# List all image versions
docker images pmcrm-backend --format "table {{.Tag}}\t{{.CreatedAt}}"

# Pull specific version
docker pull ghcr.io/your-org/pmcrm/backend:v1.2.3

# Update docker-compose to use specific version
# Edit docker-compose.prod.yml:
# image: ghcr.io/your-org/pmcrm/backend:v1.2.3

# Restart with new image
docker-compose -f docker-compose.prod.yml up -d backend
```

### Rollback Using Git Tags

```bash
# List available versions
git tag --sort=-v:refname | head -10

# Checkout specific version
git checkout tags/v1.2.3

# Rebuild and redeploy
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# Return to main
git checkout main
```

## Railway Rollback

### Via Dashboard

1. Go to Railway Dashboard
2. Select your service (backend or frontend)
3. Click on "Deployments" tab
4. Find previous successful deployment
5. Click "Redeploy" button

### Via CLI

```bash
# List deployments
railway status

# Rollback to previous deployment
railway rollback

# Or rollback to specific deployment
railway rollback --deployment <deployment-id>
```

### Via API

```bash
# Get deployments
curl -X GET 'https://backboard.railway.app/graphql/v2' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "query { deployments(projectId: \"YOUR_PROJECT_ID\") { id status } }"
  }'

# Rollback to specific deployment
curl -X POST 'https://backboard.railway.app/graphql/v2' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "mutation { deploymentRollback(deploymentId: \"DEPLOYMENT_ID\") { id } }"
  }'
```

## Vercel Rollback

### Via Dashboard

1. Go to Vercel Dashboard
2. Select project
3. Click "Deployments"
4. Find previous successful deployment
5. Click three dots → "Promote to Production"

### Via CLI

```bash
# List deployments
vercel ls

# Promote specific deployment to production
vercel promote <deployment-url>

# Example
vercel promote pmcrm-frontend-abc123.vercel.app
```

### Instant Rollback

Vercel keeps previous deployments active:
```bash
# Get deployment URL from previous version
vercel ls --meta version=1.2.3

# Promote to production
vercel promote <url>
```

## AWS ECS Rollback

### Via Console

1. Go to ECS Console
2. Select cluster
3. Select service
4. Click "Update Service"
5. Select previous task definition revision
6. Update service

### Via CLI

```bash
# List task definition revisions
aws ecs list-task-definitions --family-prefix pmcrm-backend

# Update service to previous revision
aws ecs update-service \
  --cluster pmcrm-cluster \
  --service pmcrm-backend-service \
  --task-definition pmcrm-backend:42  # Previous revision

# Wait for service to stabilize
aws ecs wait services-stable \
  --cluster pmcrm-cluster \
  --services pmcrm-backend-service
```

### Blue-Green Deployment Rollback

If using Application Load Balancer with target groups:

```bash
# Switch traffic back to blue environment
aws elbv2 modify-listener \
  --listener-arn arn:aws:elasticloadbalancing:region:account:listener/app/my-load-balancer/xxx \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:region:account:targetgroup/blue/xxx
```

## Database Migration Rollback

### Prisma Migration Rollback

**Option 1: Undo Last Migration**

```bash
# Mark migration as rolled back (doesn't modify DB)
npx prisma migrate resolve --rolled-back <migration-name>

# Manually run down migration SQL
psql -U pmcrm_app -d pmcrm -f prisma/migrations/<migration-name>/down.sql
```

**Option 2: Reset to Specific Migration**

```bash
# Reset database to specific migration
npx prisma migrate resolve --applied <migration-name>

# Then run migrations
npx prisma migrate deploy
```

**Option 3: Full Database Restore**

If migrations can't be rolled back, restore from backup:

```bash
# Stop application
docker-compose -f docker-compose.prod.yml stop backend

# Restore database
./scripts/restore-db.sh /backups/postgres/backup_before_migration.dump.gz

# Restart application
docker-compose -f docker-compose.prod.yml start backend
```

### Custom Rollback Scripts

Create rollback SQL for each migration:

```sql
-- prisma/migrations/20240101_add_user_role/down.sql
ALTER TABLE users DROP COLUMN role;
DROP TYPE user_role;
```

## Application State Rollback

### Redis State Rollback

```bash
# Flush Redis to clear cached state
docker exec pmcrm-redis-prod redis-cli -a $REDIS_PASSWORD FLUSHDB

# Or restore from backup
./scripts/restore-redis.sh /backups/redis/dump_before_deploy.rdb.gz
```

### Session Cleanup

If rollback requires invalidating user sessions:

```bash
# Flush all sessions
docker exec pmcrm-redis-prod redis-cli -a $REDIS_PASSWORD FLUSHDB

# Or delete session keys only
docker exec pmcrm-redis-prod redis-cli -a $REDIS_PASSWORD --scan --pattern 'session:*' | \
  xargs docker exec pmcrm-redis-prod redis-cli -a $REDIS_PASSWORD DEL
```

## GitHub Actions Rollback

### Revert Failed Deployment

```bash
# Find commit before bad deployment
git log --oneline -10

# Revert to specific commit
git revert <bad-commit-hash>

# Push revert
git push origin main

# This triggers new deployment with reverted code
```

### Redeploy Previous Version

```bash
# Create tag for previous working version
git tag -a v1.2.3-rollback -m "Rollback to working version"

# Push tag to trigger deployment
git push origin v1.2.3-rollback
```

## Rollback Verification

### Health Check Script

Create `scripts/verify-rollback.sh`:

```bash
#!/bin/bash
set -e

echo "=== Verifying Rollback ==="

# 1. Check backend health
echo "1. Checking backend health..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.your-domain.com/health)
if [ $BACKEND_STATUS -eq 200 ]; then
  echo "✓ Backend healthy"
else
  echo "✗ Backend unhealthy (HTTP $BACKEND_STATUS)"
  exit 1
fi

# 2. Check frontend
echo "2. Checking frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.com)
if [ $FRONTEND_STATUS -eq 200 ]; then
  echo "✓ Frontend healthy"
else
  echo "✗ Frontend unhealthy (HTTP $FRONTEND_STATUS)"
  exit 1
fi

# 3. Check database connectivity
echo "3. Checking database..."
DB_CHECK=$(docker exec pmcrm-backend-prod npx prisma db execute --stdin <<< "SELECT 1" 2>&1)
if echo "$DB_CHECK" | grep -q "1"; then
  echo "✓ Database connected"
else
  echo "✗ Database not connected"
  exit 1
fi

# 4. Check key functionality
echo "4. Testing key endpoints..."
AUTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://api.your-domain.com/api/auth/status)
if [ $AUTH_STATUS -eq 200 ] || [ $AUTH_STATUS -eq 401 ]; then
  echo "✓ Auth endpoint working"
else
  echo "✗ Auth endpoint failed (HTTP $AUTH_STATUS)"
  exit 1
fi

echo "=== Rollback verification completed successfully ==="
```

Run after rollback:
```bash
./scripts/verify-rollback.sh
```

## Rollback Decision Matrix

### When to Rollback

| Issue | Severity | Action |
|-------|----------|--------|
| Critical bug affecting all users | Critical | Immediate rollback |
| Security vulnerability | Critical | Immediate rollback |
| Performance degradation > 50% | High | Rollback within 15 min |
| Database corruption | Critical | Rollback + restore DB |
| Feature not working | Medium | Rollback within 1 hour |
| Minor UI bug | Low | Fix forward, don't rollback |
| Failed migration | High | Rollback + restore DB |

### Rollback vs Fix Forward

**Rollback when**:
- Issue is critical and affects many users
- Root cause is unknown
- Fix will take > 30 minutes
- Data integrity is at risk

**Fix forward when**:
- Issue is minor and affects few users
- Root cause is known
- Fix is quick (< 15 minutes)
- Rollback is complex

## Post-Rollback Actions

### Incident Report

Create incident report template:

```markdown
# Incident Report: [Date] Rollback

## Summary
Brief description of issue and rollback.

## Timeline
- [Time] Issue detected
- [Time] Rollback initiated
- [Time] Rollback completed
- [Time] Service restored

## Impact
- Users affected: X
- Downtime: X minutes
- Data loss: Yes/No

## Root Cause
Detailed explanation of what went wrong.

## Resolution
How the issue was resolved (rollback details).

## Prevention
Steps to prevent similar issues:
1. Action 1
2. Action 2

## Action Items
- [ ] Fix underlying issue
- [ ] Add monitoring
- [ ] Update tests
- [ ] Document learnings
```

### Communication Template

**Internal notification**:
```
Subject: [RESOLVED] Production Rollback - [Date]

We experienced an issue with today's deployment and have rolled back to the previous stable version.

Impact: [Brief description]
Duration: [X minutes]
Resolution: Rolled back to v1.2.3

Root cause investigation in progress.

Current status: All systems operational.
```

**User notification** (if applicable):
```
Subject: Service Update

We briefly experienced technical difficulties today between [time] and [time].

The issue has been resolved and all services are now operating normally.

We apologize for any inconvenience.
```

## Rollback Checklist

### Pre-Rollback
- [ ] Identify stable version to rollback to
- [ ] Notify team of rollback decision
- [ ] Create database backup
- [ ] Document current state

### During Rollback
- [ ] Execute rollback procedure
- [ ] Monitor error logs
- [ ] Watch performance metrics
- [ ] Test critical paths

### Post-Rollback
- [ ] Verify all services healthy
- [ ] Run smoke tests
- [ ] Check database integrity
- [ ] Monitor for 30 minutes
- [ ] Update status page
- [ ] Document incident
- [ ] Schedule postmortem

## Best Practices

1. **Always Have a Rollback Plan**: Before deploying
2. **Tag Every Release**: Use semantic versioning
3. **Keep Previous Versions**: Don't delete old images
4. **Test Rollback Procedures**: Quarterly rollback drills
5. **Monitor After Rollback**: Watch for issues
6. **Document Everything**: Incident reports
7. **Communicate Clearly**: Internal and external
8. **Learn from Incidents**: Postmortems
9. **Automate When Possible**: Rollback scripts
10. **Practice Regularly**: Chaos engineering

## Testing Rollback Procedures

### Quarterly Rollback Drill

```bash
#!/bin/bash
# scripts/rollback-drill.sh

echo "=== Starting Rollback Drill ==="

# 1. Deploy to staging
echo "1. Deploying current version to staging..."
# [deployment commands]

# 2. Simulate issue
echo "2. Simulating deployment issue..."
# [break something intentionally]

# 3. Execute rollback
echo "3. Executing rollback procedure..."
# [rollback commands]

# 4. Verify rollback
echo "4. Verifying rollback..."
./scripts/verify-rollback.sh

# 5. Document results
echo "5. Documenting drill results..."
# [log results]

echo "=== Rollback drill completed ==="
```

## Additional Resources

- Docker Rollback: https://docs.docker.com/engine/swarm/swarm-tutorial/rolling-update/
- Kubernetes Rollback: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment
- Vercel Rollback: https://vercel.com/docs/deployments/rollback
- AWS ECS Rollback: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/deployment-types.html
