#!/bin/bash

# Provider Integration Validation Test Runner
# Runs all provider tests and generates verification report

echo "🧪 PROCURO - PROVIDER INTEGRATION VALIDATION"
echo "=============================================="
echo ""
echo "Running comprehensive provider tests..."
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED=0
FAILED=0

# Function to run test and capture result
run_test() {
    local test_name=$1
    local test_file=$2
    
    echo "📋 Running: $test_name"
    echo "──────────────────────────────────"
    
    if npm run test $test_file -- --verbose; then
        echo -e "${GREEN}✅ PASSED${NC}: $test_name"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAILED${NC}: $test_name"
        ((FAILED++))
    fi
    
    echo ""
}

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npm run prisma:generate
echo ""

# Run individual provider integration tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  INDIVIDUAL PROVIDER TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_test "Individual Provider Integration Tests" "providers.integration"

# Run aggregation tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  AGGREGATION TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_test "Aggregation Provider Tests" "aggregateProvider"

# Run E2E API tests
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  END-TO-END API TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

run_test "API Check-Price E2E Tests" "api.checkprice.e2e"

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 TEST SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ ALL PROVIDER MODULES VERIFIED AND FULLY INTEGRATED${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "📄 See docs/PROVIDER-VERIFICATION-REPORT.md for details"
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}⚠️  SOME TESTS FAILED - REVIEW REQUIRED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "📄 Check test output above for details"
    exit 1
fi

