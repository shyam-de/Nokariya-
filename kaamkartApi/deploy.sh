#!/bin/bash

# KaamKart API Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting KaamKart API Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
   echo -e "${RED}❌ Please do not run as root${NC}"
   exit 1
fi

# Build application
echo -e "${YELLOW}📦 Building application...${NC}"
mvn clean package -DskipTests

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

# Stop service
echo -e "${YELLOW}⏸️  Stopping service...${NC}"
sudo systemctl stop kaamkart-api || true

# Backup existing JAR
if [ -f "/opt/kaamkart-api/kaamkart-api-1.0.0.jar" ]; then
    echo -e "${YELLOW}💾 Creating backup...${NC}"
    sudo cp /opt/kaamkart-api/kaamkart-api-1.0.0.jar /opt/kaamkart-api/kaamkart-api-1.0.0.jar.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy new JAR
echo -e "${YELLOW}📋 Installing new version...${NC}"
sudo mkdir -p /opt/kaamkart-api
sudo cp target/kaamkart-api-1.0.0.jar /opt/kaamkart-api/
sudo chown www-data:www-data /opt/kaamkart-api/kaamkart-api-1.0.0.jar

# Start service
echo -e "${YELLOW}▶️  Starting service...${NC}"
sudo systemctl start kaamkart-api

# Wait for service to start
sleep 5

# Check service status
if sudo systemctl is-active --quiet kaamkart-api; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo -e "${GREEN}📊 Service status:${NC}"
    sudo systemctl status kaamkart-api --no-pager -l
else
    echo -e "${RED}❌ Service failed to start!${NC}"
    echo -e "${RED}📋 Checking logs:${NC}"
    sudo journalctl -u kaamkart-api -n 50 --no-pager
    exit 1
fi

# Health check
echo -e "${YELLOW}🏥 Running health check...${NC}"
sleep 3
if curl -f http://localhost:8585/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed, but service is running${NC}"
fi

echo -e "${GREEN}🎉 Deployment complete!${NC}"

