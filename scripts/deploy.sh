#!/bin/bash
# Production Deployment Script
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Personal Network CRM Deployment ===${NC}"
echo -e "Environment: ${YELLOW}$ENVIRONMENT${NC}"
echo ""

# Check if environment file exists
if [ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]; then
  echo -e "${RED}Error: .env.$ENVIRONMENT file not found${NC}"
  echo "Please create .env.$ENVIRONMENT from .env.production.example"
  exit 1
fi

# Confirmation prompt
read -p "Deploy to $ENVIRONMENT? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled"
  exit 0
fi

# Stop existing services
echo -e "${YELLOW}Stopping existing services...${NC}"
docker-compose -f docker-compose.prod.yml down

# Pull latest changes (if deploying from git)
if [ "$ENVIRONMENT" = "production" ]; then
  echo -e "${YELLOW}Pulling latest changes...${NC}"
  git pull origin main
fi

# Build images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
sleep 10

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
docker exec pmcrm-backend-prod npx prisma migrate deploy

# Verify deployment
echo -e "${YELLOW}Verifying deployment...${NC}"

# Check backend health
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$BACKEND_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ Backend is healthy${NC}"
else
  echo -e "${RED}✗ Backend health check failed (HTTP $BACKEND_STATUS)${NC}"
  exit 1
fi

# Check frontend
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" -eq 200 ]; then
  echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
  echo -e "${RED}✗ Frontend health check failed (HTTP $FRONTEND_STATUS)${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== Deployment completed successfully! ===${NC}"
echo ""
echo "Services:"
echo "  - Frontend: http://localhost:3000"
echo "  - Backend:  http://localhost:3001"
echo "  - Backend Health: http://localhost:3001/health"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
