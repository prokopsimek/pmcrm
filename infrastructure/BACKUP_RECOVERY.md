# Backup and Recovery Guide

Complete guide for backing up and recovering Personal Network CRM data.

## Overview

Backup strategy includes:
- **Database backups**: PostgreSQL full and incremental
- **Application state**: Redis snapshots
- **File storage**: User uploads and assets
- **Configuration**: Environment variables and secrets
- **Infrastructure**: Terraform state

## Backup Frequency

| Component | Frequency | Retention |
|-----------|-----------|-----------|
| Database (Full) | Daily | 30 days |
| Database (Incremental) | Hourly | 7 days |
| Redis Snapshots | Every 6 hours | 7 days |
| File Storage | Daily | 90 days |
| Configuration | On change | Forever |
| Terraform State | On apply | Forever |

## Database Backups

### PostgreSQL Automated Backups

#### Using Docker

**Create backup script** (`scripts/backup-db.sh`):

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="pmcrm-postgres-prod"
DB_NAME="pmcrm"
DB_USER="pmcrm_app"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Full backup
echo "Starting database backup..."
docker exec $CONTAINER pg_dump -U $DB_USER -d $DB_NAME -Fc -f /tmp/backup_${DATE}.dump

# Copy backup from container
docker cp $CONTAINER:/tmp/backup_${DATE}.dump $BACKUP_DIR/

# Compress backup
gzip $BACKUP_DIR/backup_${DATE}.dump

# Remove old backups
find $BACKUP_DIR -name "backup_*.dump.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/backup_${DATE}.dump.gz"
```

**Make script executable**:
```bash
chmod +x scripts/backup-db.sh
```

**Schedule with cron**:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /path/to/pmcrm/scripts/backup-db.sh >> /var/log/pmcrm-backup.log 2>&1
```

#### Using Railway

Railway automatically backs up PostgreSQL:
- Frequency: Daily
- Retention: 7 days (Pro plan)
- Location: Railway infrastructure

**Manual backup**:
```bash
railway run pg_dump > backup_$(date +%Y%m%d).sql
```

#### Using AWS RDS

RDS automated backups:
- Configured in Terraform: `backup_retention_period = 7`
- Point-in-time recovery enabled
- Daily snapshots at maintenance window

**Manual snapshot**:
```bash
aws rds create-db-snapshot \
  --db-instance-identifier pmcrm-db-production \
  --db-snapshot-identifier pmcrm-manual-$(date +%Y%m%d-%H%M%S)
```

### Incremental Backups

**Create incremental backup script** (`scripts/backup-db-incremental.sh`):

```bash
#!/bin/bash
set -e

# Configuration
BACKUP_DIR="/backups/postgres/incremental"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="pmcrm-postgres-prod"
WAL_DIR="/var/lib/postgresql/data/pg_wal"

# Archive WAL files
docker exec $CONTAINER pg_basebackup \
  -U pmcrm_app \
  -D /tmp/incremental_${DATE} \
  -Ft -z -P

# Copy to backup directory
docker cp $CONTAINER:/tmp/incremental_${DATE}.tar.gz $BACKUP_DIR/

echo "Incremental backup completed: $BACKUP_DIR/incremental_${DATE}.tar.gz"
```

## Redis Backups

### Automatic RDB Snapshots

Redis is configured to save snapshots:
```bash
# In redis.conf or docker-compose
save 60 1000     # Save after 60s if at least 1000 keys changed
save 900 1       # Save after 900s if at least 1 key changed
```

### Manual Redis Backup

```bash
# Trigger manual save
docker exec pmcrm-redis-prod redis-cli -a $REDIS_PASSWORD SAVE

# Copy RDB file
docker cp pmcrm-redis-prod:/data/dump.rdb /backups/redis/dump_$(date +%Y%m%d_%H%M%S).rdb
```

### Redis Backup Script

**Create script** (`scripts/backup-redis.sh`):

```bash
#!/bin/bash
set -e

BACKUP_DIR="/backups/redis"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="pmcrm-redis-prod"

mkdir -p $BACKUP_DIR

# Trigger save
docker exec $CONTAINER redis-cli -a $REDIS_PASSWORD SAVE

# Copy dump file
docker cp $CONTAINER:/data/dump.rdb $BACKUP_DIR/dump_${DATE}.rdb

# Compress
gzip $BACKUP_DIR/dump_${DATE}.rdb

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "dump_*.rdb.gz" -mtime +7 -delete

echo "Redis backup completed: $BACKUP_DIR/dump_${DATE}.rdb.gz"
```

## File Storage Backups

### S3 Bucket Backups (if using S3)

S3 has versioning enabled via Terraform. Additional backup to separate bucket:

```bash
#!/bin/bash
# scripts/backup-s3.sh

aws s3 sync s3://pmcrm-uploads-production s3://pmcrm-backups-production/uploads/$(date +%Y%m%d) \
  --storage-class GLACIER \
  --exclude "*.tmp"
```

### Volume Backups (Docker)

```bash
#!/bin/bash
# scripts/backup-volumes.sh

BACKUP_DIR="/backups/volumes"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup specific volumes
for volume in pmcrm_postgres_data pmcrm_redis_data; do
  docker run --rm \
    -v $volume:/data \
    -v $BACKUP_DIR:/backup \
    alpine \
    tar czf /backup/${volume}_${DATE}.tar.gz -C /data .
done

echo "Volume backups completed in $BACKUP_DIR"
```

## Configuration Backups

### Environment Variables

```bash
#!/bin/bash
# scripts/backup-config.sh

BACKUP_DIR="/backups/config"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup environment files (without secrets)
cp .env.example $BACKUP_DIR/.env.example_${DATE}

# Backup secrets to encrypted file
tar czf - .env.production | \
  openssl enc -aes-256-cbc -salt -pbkdf2 -out $BACKUP_DIR/secrets_${DATE}.tar.gz.enc

echo "Configuration backed up to $BACKUP_DIR"
```

### Infrastructure State (Terraform)

Terraform state is backed up to S3 (configured in `infrastructure/terraform/main.tf`):

```hcl
backend "s3" {
  bucket         = "pmcrm-terraform-state"
  key            = "production/terraform.tfstate"
  region         = "us-east-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

**Manual state backup**:
```bash
cd infrastructure/terraform
terraform state pull > backup_tfstate_$(date +%Y%m%d_%H%M%S).json
```

## Off-Site Backups

### Upload to S3

```bash
#!/bin/bash
# scripts/upload-backups-s3.sh

BACKUP_DIR="/backups"
S3_BUCKET="s3://pmcrm-backups-production"

# Upload all backups to S3
aws s3 sync $BACKUP_DIR $S3_BUCKET \
  --storage-class STANDARD_IA \
  --exclude "*.tmp" \
  --delete

echo "Backups uploaded to $S3_BUCKET"
```

### Alternative Off-Site Storage

- **Backblaze B2**: Cost-effective alternative to S3
- **Google Cloud Storage**: Multi-region redundancy
- **rsync to remote server**: Traditional approach

```bash
# rsync to remote server
rsync -avz --delete \
  /backups/ \
  backup-user@backup-server.com:/backups/pmcrm/
```

## Recovery Procedures

### Database Recovery

#### Full Database Restore

```bash
#!/bin/bash
# scripts/restore-db.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE > /tmp/restore.dump
  RESTORE_FILE="/tmp/restore.dump"
else
  RESTORE_FILE=$BACKUP_FILE
fi

# Stop backend to prevent writes
docker-compose -f docker-compose.prod.yml stop backend

# Drop and recreate database
docker exec -i pmcrm-postgres-prod psql -U pmcrm_app -d postgres -c "DROP DATABASE IF EXISTS pmcrm;"
docker exec -i pmcrm-postgres-prod psql -U pmcrm_app -d postgres -c "CREATE DATABASE pmcrm;"

# Restore from backup
docker exec -i pmcrm-postgres-prod pg_restore -U pmcrm_app -d pmcrm -v < $RESTORE_FILE

# Restart backend
docker-compose -f docker-compose.prod.yml start backend

echo "Database restored from $BACKUP_FILE"
```

**Usage**:
```bash
./scripts/restore-db.sh /backups/postgres/backup_20240101_020000.dump.gz
```

#### Point-in-Time Recovery (AWS RDS)

```bash
# Restore to specific time
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier pmcrm-db-production \
  --target-db-instance-identifier pmcrm-db-restored \
  --restore-time 2024-01-01T12:00:00Z

# Or restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier pmcrm-db-restored \
  --db-snapshot-identifier pmcrm-manual-20240101-120000
```

### Redis Recovery

```bash
#!/bin/bash
# scripts/restore-redis.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  exit 1
fi

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  gunzip -c $BACKUP_FILE > /tmp/dump.rdb
  RESTORE_FILE="/tmp/dump.rdb"
else
  RESTORE_FILE=$BACKUP_FILE
fi

# Stop Redis
docker-compose -f docker-compose.prod.yml stop redis

# Replace dump file
docker cp $RESTORE_FILE pmcrm-redis-prod:/data/dump.rdb

# Start Redis
docker-compose -f docker-compose.prod.yml start redis

echo "Redis restored from $BACKUP_FILE"
```

### Volume Recovery

```bash
#!/bin/bash
# scripts/restore-volume.sh

VOLUME_NAME=$1
BACKUP_FILE=$2

if [ -z "$VOLUME_NAME" ] || [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <volume_name> <backup_file>"
  exit 1
fi

# Extract backup to volume
docker run --rm \
  -v $VOLUME_NAME:/data \
  -v $(dirname $BACKUP_FILE):/backup \
  alpine \
  sh -c "cd /data && tar xzf /backup/$(basename $BACKUP_FILE)"

echo "Volume $VOLUME_NAME restored from $BACKUP_FILE"
```

## Disaster Recovery Plan

### Complete System Recovery

**Scenario**: Total system failure, all data lost

**Recovery Steps**:

1. **Provision Infrastructure** (if using Terraform):
   ```bash
   cd infrastructure/terraform
   terraform init
   terraform apply
   ```

2. **Deploy Application**:
   ```bash
   git clone https://github.com/your-org/pmcrm.git
   cd pmcrm
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Restore Database**:
   ```bash
   # Get latest backup from S3
   aws s3 cp s3://pmcrm-backups-production/postgres/latest.dump.gz .

   # Restore
   ./scripts/restore-db.sh latest.dump.gz
   ```

4. **Restore Redis**:
   ```bash
   aws s3 cp s3://pmcrm-backups-production/redis/latest.rdb.gz .
   ./scripts/restore-redis.sh latest.rdb.gz
   ```

5. **Restore Files** (if applicable):
   ```bash
   aws s3 sync s3://pmcrm-backups-production/uploads /path/to/uploads
   ```

6. **Verify System**:
   ```bash
   curl https://api.your-domain.com/health
   curl https://your-domain.com/
   ```

**Expected Recovery Time**: 30-60 minutes

### Partial Recovery

**Scenario**: Corrupted data, need to restore specific table

```sql
-- Restore specific table from backup
psql -U pmcrm_app -d pmcrm_temp < backup.dump

-- Copy data from backup to production
INSERT INTO pmcrm.contacts
SELECT * FROM pmcrm_temp.contacts
WHERE id NOT IN (SELECT id FROM pmcrm.contacts);
```

## Testing Backups

### Monthly Backup Testing

Create test script (`scripts/test-backup-restore.sh`):

```bash
#!/bin/bash
set -e

echo "=== Testing Backup and Restore ==="

# 1. Create test backup
echo "1. Creating test backup..."
./scripts/backup-db.sh

# 2. Create test database
echo "2. Creating test database..."
docker exec pmcrm-postgres-prod psql -U pmcrm_app -d postgres -c "DROP DATABASE IF EXISTS pmcrm_test;"
docker exec pmcrm-postgres-prod psql -U pmcrm_app -d postgres -c "CREATE DATABASE pmcrm_test;"

# 3. Restore to test database
echo "3. Restoring to test database..."
LATEST_BACKUP=$(ls -t /backups/postgres/backup_*.dump.gz | head -1)
gunzip -c $LATEST_BACKUP | docker exec -i pmcrm-postgres-prod pg_restore -U pmcrm_app -d pmcrm_test -v

# 4. Verify data
echo "4. Verifying data..."
ROW_COUNT=$(docker exec pmcrm-postgres-prod psql -U pmcrm_app -d pmcrm_test -t -c "SELECT COUNT(*) FROM contacts;")
echo "Contacts count: $ROW_COUNT"

# 5. Cleanup
echo "5. Cleaning up..."
docker exec pmcrm-postgres-prod psql -U pmcrm_app -d postgres -c "DROP DATABASE pmcrm_test;"

echo "=== Backup test completed successfully ==="
```

Schedule monthly:
```bash
# First day of month at 3 AM
0 3 1 * * /path/to/pmcrm/scripts/test-backup-restore.sh >> /var/log/pmcrm-backup-test.log 2>&1
```

## Backup Monitoring

### Backup Status Check

```bash
#!/bin/bash
# scripts/check-backups.sh

BACKUP_DIR="/backups"
ALERT_EMAIL="admin@your-domain.com"

# Check if backup exists from today
if [ ! -f "$BACKUP_DIR/postgres/backup_$(date +%Y%m%d)_*.dump.gz" ]; then
  echo "WARNING: No database backup found for today" | \
    mail -s "Backup Alert: Missing Database Backup" $ALERT_EMAIL
fi

# Check backup age
LATEST_BACKUP=$(ls -t $BACKUP_DIR/postgres/backup_*.dump.gz | head -1)
BACKUP_AGE=$(( ($(date +%s) - $(stat -f %m "$LATEST_BACKUP")) / 3600 ))

if [ $BACKUP_AGE -gt 48 ]; then
  echo "WARNING: Latest backup is $BACKUP_AGE hours old" | \
    mail -s "Backup Alert: Stale Backup" $ALERT_EMAIL
fi

# Check backup size
BACKUP_SIZE=$(du -h "$LATEST_BACKUP" | cut -f1)
echo "Latest backup size: $BACKUP_SIZE"
```

## Best Practices

1. **3-2-1 Rule**: 3 copies, 2 different media, 1 off-site
2. **Automated Backups**: Never rely on manual backups
3. **Test Regularly**: Test restore procedures monthly
4. **Monitor Backups**: Alert on failures
5. **Encrypt Backups**: Especially off-site backups
6. **Document Recovery**: Keep procedures up to date
7. **Version Control**: Backup configuration files
8. **Retention Policy**: Balance cost and compliance
9. **Access Control**: Limit backup access
10. **Audit Trail**: Log backup operations

## Backup Checklist

- [ ] Automated daily database backups configured
- [ ] Hourly incremental backups configured
- [ ] Redis snapshots configured
- [ ] Off-site backup replication working
- [ ] Backup encryption enabled
- [ ] Backup monitoring and alerting set up
- [ ] Recovery procedures documented
- [ ] Monthly backup tests scheduled
- [ ] Backup retention policies implemented
- [ ] Disaster recovery plan documented

## Additional Resources

- PostgreSQL Backup Guide: https://www.postgresql.org/docs/current/backup.html
- Redis Persistence: https://redis.io/docs/management/persistence/
- AWS Backup: https://aws.amazon.com/backup/
- Disaster Recovery Best Practices: https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/
