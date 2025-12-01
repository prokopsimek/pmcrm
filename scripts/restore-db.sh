#!/bin/bash
# Database Restore Script
# Usage: ./scripts/restore-db.sh <backup_file>

set -e

# Configuration
BACKUP_FILE=$1
CONTAINER="pmcrm-backend-prod"
DB_NAME="pmcrm"
DB_USER="pmcrm_app"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file not specified${NC}"
  echo "Usage: $0 <backup_file>"
  echo ""
  echo "Available backups:"
  ls -lht backups/postgres/backup_*.dump.gz 2>/dev/null | head -10
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
  exit 1
fi

echo -e "${RED}=== WARNING: Database Restore ===${NC}"
echo -e "${YELLOW}This will REPLACE the current database with the backup!${NC}"
echo -e "Backup file: ${YELLOW}$BACKUP_FILE${NC}"
echo ""
read -p "Are you sure you want to continue? (yes/no) " -r
echo
if [[ ! $REPLY = "yes" ]]; then
  echo "Restore cancelled"
  exit 0
fi

# Create safety backup
echo -e "${YELLOW}Creating safety backup of current database...${NC}"
SAFETY_BACKUP="backups/postgres/safety_backup_$(date +%Y%m%d_%H%M%S).dump"
mkdir -p backups/postgres
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$SAFETY_BACKUP"
gzip "$SAFETY_BACKUP"
echo -e "${GREEN}✓ Safety backup created: ${SAFETY_BACKUP}.gz${NC}"

# Decompress if needed
if [[ $BACKUP_FILE == *.gz ]]; then
  echo -e "${YELLOW}Decompressing backup...${NC}"
  gunzip -c "$BACKUP_FILE" > /tmp/restore.dump
  RESTORE_FILE="/tmp/restore.dump"
else
  RESTORE_FILE="$BACKUP_FILE"
fi

# Stop backend
echo -e "${YELLOW}Stopping backend service...${NC}"
docker-compose -f docker-compose.prod.yml stop backend

# Drop and recreate database
echo -e "${YELLOW}Recreating database...${NC}"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
docker exec -i "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE $DB_NAME;"

# Restore from backup
echo -e "${YELLOW}Restoring database...${NC}"
cat "$RESTORE_FILE" | docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" -v

# Cleanup temp file
if [ -f "/tmp/restore.dump" ]; then
  rm /tmp/restore.dump
fi

# Restart backend
echo -e "${YELLOW}Starting backend service...${NC}"
docker-compose -f docker-compose.prod.yml start backend

# Wait for backend to be healthy
sleep 5
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$BACKEND_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ Backend is healthy${NC}"
else
  echo -e "${RED}✗ Backend health check failed${NC}"
  echo -e "${YELLOW}You may need to restore the safety backup${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== Database restored successfully! ===${NC}"
echo -e "Safety backup available at: ${YELLOW}${SAFETY_BACKUP}.gz${NC}"
