#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Running Comprehensive Test Suite${NC}"
echo "========================================"

# Function to print section headers
print_section() {
    echo -e "\n${YELLOW}$1${NC}"
    echo "----------------------------------------"
}

# Function to check if command succeeded
check_result() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1 passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 failed${NC}"
        return 1
    fi
}

# Track overall test results
BACKEND_TESTS_PASSED=0
FRONTEND_TESTS_PASSED=0
INTEGRATION_TESTS_PASSED=0

# Backend Tests
print_section "Backend Unit Tests"
cd backend
npm test
BACKEND_TESTS_PASSED=$?
check_result "Backend unit tests"

print_section "Backend Test Coverage"
npm run test:coverage
check_result "Backend test coverage"

# Frontend Tests
print_section "Frontend Unit Tests"
cd ../frontend
npm test -- --coverage --watchAll=false
FRONTEND_TESTS_PASSED=$?
check_result "Frontend unit tests"

# Integration Tests (Docker-based)
print_section "Integration Tests with Docker"
cd ..

# Start services in background
echo "Starting Docker services..."
docker-compose up -d --build

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 30

# Test backend health
echo "Testing backend health..."
curl -f http://localhost:3001/api/system/state > /dev/null 2>&1
if [ $? -eq 0 ] || [ $? -eq 1 ]; then  # 401 is expected without auth
    echo -e "${GREEN}✅ Backend is responding${NC}"
    BACKEND_HEALTH=0
else
    echo -e "${RED}❌ Backend is not responding${NC}"
    BACKEND_HEALTH=1
fi

# Test frontend health
echo "Testing frontend health..."
curl -f http://localhost:3002 > /dev/null 2>&1
FRONTEND_HEALTH=$?
check_result "Frontend health check"

# Test authentication flow
echo "Testing authentication flow..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}')

if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Authentication flow working${NC}"
    AUTH_TEST=0
    
    # Extract token for further tests
    TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    
    # Test command processing
    echo "Testing command processing..."
    COMMAND_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"command":"status"}')
    
    if echo "$COMMAND_RESPONSE" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Command processing working${NC}"
        COMMAND_TEST=0
    else
        echo -e "${RED}❌ Command processing failed${NC}"
        COMMAND_TEST=1
    fi
    
    # Test sesame patterns
    echo "Testing sesame patterns..."
    SESAME_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"command":"sesame close"}')
    
    if echo "$SESAME_RESPONSE" | grep -q '"intent":"ARM_SYSTEM"'; then
        echo -e "${GREEN}✅ Sesame patterns working${NC}"
        SESAME_TEST=0
    else
        echo -e "${RED}❌ Sesame patterns failed${NC}"
        SESAME_TEST=1
    fi
else
    echo -e "${RED}❌ Authentication flow failed${NC}"
    AUTH_TEST=1
    COMMAND_TEST=1
    SESAME_TEST=1
fi

# Calculate integration test result
if [ $BACKEND_HEALTH -eq 0 ] && [ $FRONTEND_HEALTH -eq 0 ] && [ $AUTH_TEST -eq 0 ] && [ $COMMAND_TEST -eq 0 ] && [ $SESAME_TEST -eq 0 ]; then
    INTEGRATION_TESTS_PASSED=0
else
    INTEGRATION_TESTS_PASSED=1
fi

# Cleanup
echo "Cleaning up Docker services..."
docker-compose down

# Final Results
print_section "Test Results Summary"

if [ $BACKEND_TESTS_PASSED -eq 0 ]; then
    echo -e "${GREEN}✅ Backend Tests: PASSED${NC}"
else
    echo -e "${RED}❌ Backend Tests: FAILED${NC}"
fi

if [ $FRONTEND_TESTS_PASSED -eq 0 ]; then
    echo -e "${GREEN}✅ Frontend Tests: PASSED${NC}"
else
    echo -e "${RED}❌ Frontend Tests: FAILED${NC}"
fi

if [ $INTEGRATION_TESTS_PASSED -eq 0 ]; then
    echo -e "${GREEN}✅ Integration Tests: PASSED${NC}"
else
    echo -e "${RED}❌ Integration Tests: FAILED${NC}"
fi

# Overall result
if [ $BACKEND_TESTS_PASSED -eq 0 ] && [ $FRONTEND_TESTS_PASSED -eq 0 ] && [ $INTEGRATION_TESTS_PASSED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    exit 0
else
    echo -e "\n${RED}💥 SOME TESTS FAILED 💥${NC}"
    exit 1
fi
