#!/bin/bash

# Verify Docker Fix Script
# This script verifies that the frontend can successfully connect to the backend

set -e

echo "🔧 Verifying Docker Fix..."
echo "=========================="

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

# Test 1: Check containers are running
print_info "Checking Docker containers status..."
BACKEND_STATUS=$(docker-compose ps | grep backend | grep -o "Up")
FRONTEND_STATUS=$(docker-compose ps | grep frontend | grep -o "Up")

if [ "$BACKEND_STATUS" = "Up" ] && [ "$FRONTEND_STATUS" = "Up" ]; then
    print_status 0 "Both containers are running"
else
    print_status 1 "Containers not running properly"
fi

# Test 2: Check frontend environment variable
print_info "Checking frontend API URL configuration..."
API_URL=$(docker exec textsecurity-control-app-frontend-1 printenv | grep REACT_APP_API_URL | cut -d'=' -f2)
if [ "$API_URL" = "http://localhost:3001/api" ]; then
    print_status 0 "Frontend API URL correctly configured: $API_URL"
else
    print_status 1 "Frontend API URL misconfigured: $API_URL"
fi

# Test 3: Test backend health endpoint
print_info "Testing backend health endpoint..."
curl -s -f http://localhost:3001/api/healthz | grep -q "OK"
print_status $? "Backend health endpoint responding"

# Test 4: Test backend login endpoint
print_info "Testing backend login endpoint..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}')

echo "$LOGIN_RESPONSE" | jq -e '.success == true' > /dev/null
print_status $? "Backend login endpoint working"

# Test 5: Test frontend accessibility
print_info "Testing frontend accessibility..."
curl -s -I http://localhost:3000 | grep -q "200 OK"
print_status $? "Frontend is accessible on port 3000"

# Test 6: Test command functionality
print_info "Testing command processing..."
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')
COMMAND_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"status"}')

echo "$COMMAND_RESPONSE" | jq -e '.success == true and .intent == "GET_STATUS"' > /dev/null
print_status $? "Command processing working"

# Test 7: Verify CORS is working
print_info "Testing CORS configuration..."
curl -s -I http://localhost:3001/api/healthz | grep -q "Access-Control-Allow-Origin"
print_status $? "CORS headers present"

echo ""
echo "🎉 All verification tests passed!"
echo ""
echo "📋 Summary:"
echo "  • Frontend: http://localhost:3000 ✅"
echo "  • Backend: http://localhost:3001/api ✅"
echo "  • API URL: $API_URL ✅"
echo "  • Authentication: Working ✅"
echo "  • Commands: Working ✅"
echo "  • CORS: Configured ✅"
echo ""
echo "🚀 The Docker deployment is fully functional!"
echo "   You can now access the UI at http://localhost:3000"
echo "   and login with PIN: 0000"
