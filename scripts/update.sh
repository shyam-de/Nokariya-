#!/bin/bash

# KaamKart Update Script
# Updates both backend and frontend from git repository
# Usage: ./update.sh

set -e

echo "🔄 Updating KaamKart application..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get latest code
echo -e "${YELLOW}📥 Pulling latest code from git...${NC}"
git pull origin main

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Git pull failed!${NC}"
    exit 1
fi

# Update backend
echo -e "${YELLOW}🔧 Updating backend...${NC}"
cd kaamkartApi
./deploy.sh
cd ..

# Update frontend
echo -e "${YELLOW}🎨 Updating frontend...${NC}"
cd kaamkartUI
./deploy.sh
cd ..

echo -e "${GREEN}✅ Update complete!${NC}"

