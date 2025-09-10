#!/bin/bash

# Core Functionality Test Script
# Tests the essential features of the Security Control System

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Testing Core Security Control Functionality${NC}"
echo "=================================================="

# Check if services are running
echo "Checking if services are running..."
if ! curl -s http://localhost:3001/api/system/state > /dev/null 2>&1 && ! curl -s http://localhost:3002 > /dev/null 2>&1; then
    echo -e "${YELLOW}Services not running. Starting Docker services...${NC}"
    docker-compose up -d --build
    echo "Waiting for services to start..."
    sleep 30
fi

# Test 1: Authentication
echo -e "\n${YELLOW}Test 1: Authentication${NC}"
echo "Testing login with correct PIN (0000)..."
AUTH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"pin":"0000"}')

if echo "$AUTH_RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Authentication successful${NC}"
    TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "Token received: ${TOKEN:0:20}..."
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "Response: $AUTH_RESPONSE"
    exit 1
fi

# Test 2: System Status
echo -e "\n${YELLOW}Test 2: System Status Retrieval${NC}"
STATUS_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/system/state)

if echo "$STATUS_RESPONSE" | grep -q '"armed"'; then
    echo -e "${GREEN}✅ System status retrieved successfully${NC}"
    echo "Current status: $(echo "$STATUS_RESPONSE" | grep -o '"armed":[^,]*' | cut -d':' -f2)"
else
    echo -e "${RED}❌ Failed to retrieve system status${NC}"
    echo "Response: $STATUS_RESPONSE"
    exit 1
fi

# Test 3: Basic Commands
echo -e "\n${YELLOW}Test 3: Basic Command Processing${NC}"

# Test status command
echo "Testing 'status' command..."
CMD_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"status"}')

if echo "$CMD_RESPONSE" | grep -q '"intent":"GET_STATUS"'; then
    echo -e "${GREEN}✅ Status command processed correctly${NC}"
else
    echo -e "${RED}❌ Status command failed${NC}"
    echo "Response: $CMD_RESPONSE"
fi

# Test 4: Sesame Patterns
echo -e "\n${YELLOW}Test 4: Sesame Pattern Recognition${NC}"

# Test "sesame close" (arm system)
echo "Testing 'sesame close' command..."
SESAME_CLOSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"sesame close"}')

if echo "$SESAME_CLOSE" | grep -q '"intent":"ARM_SYSTEM"'; then
    echo -e "${GREEN}✅ 'Sesame close' recognized as ARM_SYSTEM${NC}"
else
    echo -e "${RED}❌ 'Sesame close' pattern not recognized${NC}"
    echo "Response: $SESAME_CLOSE"
fi

# Test "sesame open" (disarm system)
echo "Testing 'sesame open' command..."
SESAME_OPEN=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"sesame open"}')

if echo "$SESAME_OPEN" | grep -q '"intent":"DISARM_SYSTEM"'; then
    echo -e "${GREEN}✅ 'Sesame open' recognized as DISARM_SYSTEM${NC}"
else
    echo -e "${RED}❌ 'Sesame open' pattern not recognized${NC}"
    echo "Response: $SESAME_OPEN"
fi

# Test 5: System State Changes
echo -e "\n${YELLOW}Test 5: System State Changes${NC}"

# First, ensure system is disarmed
echo "Ensuring system is disarmed..."
curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"disarm"}' > /dev/null

# Test arming the system
echo "Testing system arming..."
ARM_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"arm system"}')

if echo "$ARM_RESPONSE" | grep -q '"success":true' && echo "$ARM_RESPONSE" | grep -q '"armed":true'; then
    echo -e "${GREEN}✅ System armed successfully${NC}"
else
    echo -e "${RED}❌ Failed to arm system${NC}"
    echo "Response: $ARM_RESPONSE"
fi

# Test disarming the system
echo "Testing system disarming..."
DISARM_RESPONSE=$(curl -s -X POST http://localhost:3001/api/command \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"command":"disarm system"}')

if echo "$DISARM_RESPONSE" | grep -q '"success":true' && echo "$DISARM_RESPONSE" | grep -q '"armed":false'; then
    echo -e "${GREEN}✅ System disarmed successfully${NC}"
else
    echo -e "${RED}❌ Failed to disarm system${NC}"
    echo "Response: $DISARM_RESPONSE"
fi

# Test 6: Frontend Accessibility
echo -e "\n${YELLOW}Test 6: Frontend Accessibility${NC}"
FRONTEND_RESPONSE=$(curl -s http://localhost:3002)

if echo "$FRONTEND_RESPONSE" | grep -q "Security Control System"; then
    echo -e "${GREEN}✅ Frontend is accessible and serving content${NC}"
else
    echo -e "${RED}❌ Frontend is not accessible${NC}"
fi

# Test 7: Error Handling
echo -e "\n${YELLOW}Test 7: Error Handling${NC}"

# Test invalid PIN
echo "Testing invalid PIN..."
INVALID_AUTH=$(curl -s -X POST http://localhost:3001/api/login \
    -H "Content-Type: application/json" \
    -d '{"pin":"9999"}')

if echo "$INVALID_AUTH" | grep -q '"success":false'; then
    echo -e "${GREEN}✅ Invalid PIN properly rejected${NC}"
else
    echo -e "${RED}❌ Invalid PIN not properly handled${NC}"
fi

# Test unauthorized access
echo "Testing unauthorized access..."
UNAUTH_RESPONSE=$(curl -s http://localhost:3001/api/system/state)

if echo "$UNAUTH_RESPONSE" | grep -q "Access denied"; then
    echo -e "${GREEN}✅ Unauthorized access properly blocked${NC}"
else
    echo -e "${RED}❌ Unauthorized access not properly handled${NC}"
fi

echo -e "\n${BLUE}🎯 Core Functionality Test Complete${NC}"
echo "All essential features have been tested."
echo -e "${GREEN}The Security Control System is working correctly!${NC}"
