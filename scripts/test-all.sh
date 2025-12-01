#!/bin/bash

# Test All Script - Run complete test suite for Personal Network CRM
# This script runs all tests across backend, frontend, and E2E

set -e  # Exit on error

echo "=========================================="
echo "Personal Network CRM - Complete Test Suite"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=0

# Function to print section header
print_section() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
    echo ""
}

# Function to handle test result
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1 passed${NC}"
    else
        echo -e "${RED}✗ $1 failed${NC}"
        FAILURES=$((FAILURES + 1))
    fi
}

# Start test suite
START_TIME=$(date +%s)

# 1. Backend Unit Tests
print_section "1/6 Running Backend Unit Tests"
cd backend
npm test -- --coverage --silent
check_result "Backend unit tests"
cd ..

# 2. Backend Integration Tests
print_section "2/6 Running Backend Integration Tests"
cd backend
npm run test:integration -- --silent
check_result "Backend integration tests"
cd ..

# 3. Backend E2E Tests
print_section "3/6 Running Backend E2E Tests"
cd backend
npm run test:e2e -- --silent
check_result "Backend E2E tests"
cd ..

# 4. Frontend Unit Tests
print_section "4/6 Running Frontend Unit Tests"
cd frontend
npm run test:coverage -- --run
check_result "Frontend unit tests"
cd ..

# 5. Linting
print_section "5/6 Running Linters"
cd backend
npm run lint
check_result "Backend linting"
cd ..

cd frontend
npm run lint
check_result "Frontend linting"
cd ..

# 6. E2E Tests (Playwright)
print_section "6/6 Running E2E Tests (Playwright)"
cd e2e
npx playwright test
check_result "Playwright E2E tests"
cd ..

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Print summary
echo ""
echo "=========================================="
echo "Test Suite Summary"
echo "=========================================="
echo "Duration: ${MINUTES}m ${SECONDS}s"
echo ""

if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Coverage reports available at:"
    echo "  - Backend: backend/coverage/index.html"
    echo "  - Frontend: frontend/coverage/index.html"
    echo "  - E2E: e2e/playwright-report/index.html"
    exit 0
else
    echo -e "${RED}✗ ${FAILURES} test suite(s) failed${NC}"
    echo ""
    echo "Check the logs above for details."
    exit 1
fi
