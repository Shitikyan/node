#!/bin/bash

# Smart Contracts Database Migration Script
# This script starts the test database, runs the migration, and stops it cleanly

PG_PORT=5332
export PG_PORT=$PG_PORT
PG_FOLDER="postgres_${PG_PORT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting Smart Contracts Database Migration${NC}"
echo "======================================================"

# Function to handle cleanup on exit
function cleanup() {
    echo -e "\n${YELLOW}🧹 Cleaning up...${NC}"
    cd "${PG_FOLDER}" 2>/dev/null && docker compose down
    cd ..
    exit 1
}

# Trap ctrl-c and call cleanup()
trap cleanup INT

# Check if postgres folder exists
if [ ! -d "$PG_FOLDER" ]; then
    echo -e "${RED}❌ Error: $PG_FOLDER directory not found${NC}"
    echo "Make sure you're running this from the node repository root"
    exit 1
fi

# Step 1: Start the database
echo -e "${BLUE}📊 Step 1: Starting PostgreSQL database...${NC}"
cd "$PG_FOLDER"

# Stop any existing instance
docker compose down > /dev/null 2>&1

# Start the database
echo "Starting docker container..."
if ! docker compose up -d; then
    echo -e "${RED}❌ Failed to start database${NC}"
    exit 1
fi

cd ..

# Step 2: Wait for database to be ready
echo -e "${BLUE}⏳ Step 2: Waiting for database to be available...${NC}"
echo -n "Checking connection"
COUNT=0
while ! nc -z localhost $PG_PORT; do
    echo -n "."
    COUNT=$((COUNT+1))
    if [ $COUNT -gt 30 ]; then
        echo -e "\n${RED}❌ Timeout waiting for database to be available${NC}"
        cleanup
    fi
    sleep 1
done
echo -e "\n${GREEN}✅ Database is ready!${NC}"

# Step 3: Check current database schema (before migration)
echo -e "${BLUE}🔍 Step 3: Checking current database schema...${NC}"
BEFORE_CHECK=$(docker exec postgres_${PG_PORT} psql -U demosuser -d demos -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'gcr_main' AND column_name = 'contracts';" 2>/dev/null | xargs)

if [ -z "$BEFORE_CHECK" ]; then
    echo -e "${YELLOW}📋 'contracts' column not found - migration needed${NC}"
else
    echo -e "${GREEN}📋 'contracts' column already exists${NC}"
fi

# Step 4: Run the migration
echo -e "${BLUE}🔄 Step 4: Running database migration...${NC}"

echo "Adding 'contracts' column to gcr_main table..."
docker exec postgres_${PG_PORT} psql -U demosuser -d demos -c "ALTER TABLE gcr_main ADD COLUMN contracts jsonb DEFAULT '{}'::jsonb;"
ADD_RESULT=$?

echo "Creating index for contracts column..."
docker exec postgres_${PG_PORT} psql -U demosuser -d demos -c "CREATE INDEX idx_gcr_main_contracts ON gcr_main USING GIN (contracts);"
INDEX_RESULT=$?

if [ $ADD_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Column added successfully${NC}"
else
    echo -e "${RED}❌ Failed to add column${NC}"
fi

if [ $INDEX_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Index created successfully${NC}"
else
    echo -e "${RED}❌ Failed to create index${NC}"
fi

# Step 5: Verify migration results
echo -e "${BLUE}🔍 Step 5: Verifying migration results...${NC}"

# Check if contracts column exists
echo "Checking for 'contracts' column..."
AFTER_CHECK=$(docker exec postgres_${PG_PORT} psql -U demosuser -d demos -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'gcr_main' AND column_name = 'contracts';" 2>/dev/null | xargs)

# Check if index exists
echo "Checking for 'contracts' index..."
INDEX_CHECK=$(docker exec postgres_${PG_PORT} psql -U demosuser -d demos -t -c "SELECT indexname FROM pg_indexes WHERE tablename = 'gcr_main' AND indexname LIKE '%contracts%';" 2>/dev/null | xargs)

# Check column properties
echo "Checking column properties..."
COLUMN_DETAILS=$(docker exec postgres_${PG_PORT} psql -U demosuser -d demos -t -c "SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'gcr_main' AND column_name = 'contracts';" 2>/dev/null)

# Count total records
echo "Counting total records..."
RECORD_COUNT=$(docker exec postgres_${PG_PORT} psql -U demosuser -d demos -t -c "SELECT COUNT(*) FROM gcr_main;" 2>/dev/null | xargs)

# Step 6: Stop the database
echo -e "${BLUE}🛑 Step 6: Stopping database...${NC}"
cd "$PG_FOLDER"
docker compose down
cd ..

# Step 7: Display results
echo ""
echo "======================================================"
echo -e "${BLUE}📊 MIGRATION RESULTS${NC}"
echo "======================================================"

if [ -n "$AFTER_CHECK" ]; then
    echo -e "${GREEN}✅ SUCCESS: 'contracts' column exists${NC}"
    echo -e "   Column details: ${COLUMN_DETAILS}"
else
    echo -e "${RED}❌ FAILED: 'contracts' column not found${NC}"
fi

if [ -n "$INDEX_CHECK" ]; then
    echo -e "${GREEN}✅ SUCCESS: Index created${NC}"
    echo -e "   Index name: ${INDEX_CHECK}"
else
    echo -e "${RED}❌ FAILED: No contracts index found${NC}"
fi

echo -e "${BLUE}📊 Database info:${NC}"
echo -e "   Total records in gcr_main: ${RECORD_COUNT:-'N/A'}"

echo ""
if [ -n "$AFTER_CHECK" ] && [ -n "$INDEX_CHECK" ]; then
    echo -e "${GREEN}🎉 MIGRATION COMPLETED SUCCESSFULLY!${NC}"
    echo -e "${GREEN}✅ Smart contracts database schema is ready${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo -e "   1. Add GCREditSmartContract to SDK types"
    echo -e "   2. Update handleGCR.ts to handle 'smartContract' case"
    echo -e "   3. Add smart contract NodeCall endpoints"
else
    echo -e "${RED}❌ MIGRATION INCOMPLETE OR FAILED${NC}"
    echo -e "${YELLOW}Please check the errors above and try again${NC}"
fi

echo "======================================================"