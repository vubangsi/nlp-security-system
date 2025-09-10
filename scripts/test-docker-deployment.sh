#!/bin/bash

# Test Docker Deployment Script
# This script validates that the entire application works correctly in Docker

set -e

echo "🐳 Testing Docker Deployment..."
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        exit 1
    fi
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Test 1: Check if containers are running
print_info "Checking if Docker containers are running..."
docker-compose ps | grep -q "Up" && docker-compose ps | grep -q "backend" && docker-compose ps | grep -q "frontend"
print_status $? "Docker containers are running"

# Test 2: Check frontend accessibility
print_info "Testing frontend accessibility (port 3000)..."
curl -s -I http://localhost:3000 | grep -q "200 OK"
print_status $? "Frontend is accessible on port 3000"

# Test 3: Check backend health
print_info "Testing backend health (port 3001)..."
curl -s -I http://localhost:3001/api/system/state | grep -q "401 Unauthorized"
print_status $? "Backend is responding on port 3001"

# Test 4: Test authentication
print_info "Testing authentication with PIN 0000..."
TOKEN=$(curl -s -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}' | jq -r '.token')

if [ "$TOKEN" != "null" ] && [ "$TOKEN" != "" ]; then
    print_status 0 "Authentication successful"
else
    print_status 1 "Authentication failed"
fi

# Test 5: Test status command
print_info "Testing status command..."
STATUS_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"status"}')

echo "$STATUS_RESPONSE" | jq -e '.success == true and .intent == "GET_STATUS"' > /dev/null
print_status $? "Status command works correctly"

# Test 6: Test sesame close (arm system)
print_info "Testing 'sesame close' command..."
ARM_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"sesame close"}')

echo "$ARM_RESPONSE" | jq -e '.success == true and .intent == "ARM_SYSTEM"' > /dev/null
print_status $? "Sesame close (arm) command works correctly"

# Test 7: Test sesame open (disarm system)
print_info "Testing 'sesame open' command..."
DISARM_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"sesame open"}')

echo "$DISARM_RESPONSE" | jq -e '.success == true and .intent == "DISARM_SYSTEM"' > /dev/null
print_status $? "Sesame open (disarm) command works correctly"

# Test 8: Test invalid PIN
print_info "Testing invalid PIN rejection..."
INVALID_RESPONSE=$(curl -s -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"pin":"1234"}')

echo "$INVALID_RESPONSE" | jq -e '.success == false' > /dev/null
print_status $? "Invalid PIN is correctly rejected"

# Test 9: Test unauthorized access
print_info "Testing unauthorized access protection..."
curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -d '{"command":"status"}' | grep -q "Access denied"
print_status $? "Unauthorized access is correctly blocked"

# Test 10: Run backend unit tests
print_info "Running backend unit tests..."
cd backend && npm test > /dev/null 2>&1
print_status $? "All backend unit tests pass"
cd ..

echo ""
echo "🎉 All tests passed! The Docker deployment is working correctly."
echo ""
echo "📋 Summary:"
echo "  • Frontend: http://localhost:3000"
echo "  • Backend API: http://localhost:3001/api"
echo "  • Default PIN: 0000"
echo "  • Supported commands: status, sesame open, sesame close, lock, unlock, arm, disarm"
echo ""
echo "🚀 The application is ready for use!"
