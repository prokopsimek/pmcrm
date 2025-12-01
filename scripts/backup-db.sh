#!/bin/bash
# Database Backup Script
# Usage: ./scripts/backup-db.sh

set -e

# Configuration
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BACKUP_DIR="$PROJECT_ROOT/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER="pmcrm-backend-prod"
DB_NAME="pmcrm"
DB_USER="pmcrm_app"
RETENTION_DAYS=30

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Database Backup ===${NC}"
echo -e "Date: ${YELLOW}$(date)${NC}"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if container is running
if ! docker ps | grep -q "$CONTAINER"; then
  echo "Error: Container $CONTAINER is not running"
  exit 1
fi

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_DIR/backup_${DATE}.dump"

# Compress backup
echo -e "${YELLOW}Compressing backup...${NC}"
gzip "$BACKUP_DIR/backup_${DATE}.dump"

BACKUP_FILE="$BACKUP_DIR/backup_${DATE}.dump.gz"
BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)

echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
echo -e "  Size: ${YELLOW}$BACKUP_SIZE${NC}"

# Remove old backups
echo -e "${YELLOW}Removing backups older than $RETENTION_DAYS days...${NC}"
find "$BACKUP_DIR" -name "backup_*.dump.gz" -mtime +"$RETENTION_DAYS" -delete

# Count remaining backups
BACKUP_COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.dump.gz 2>/dev/null | wc -l)
echo -e "${GREEN}Total backups: $BACKUP_COUNT${NC}"

echo ""
echo -e "${GREEN}=== Backup completed successfully ===${NC}"
