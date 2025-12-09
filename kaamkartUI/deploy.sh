#!/bin/bash

# KaamKart UI Deployment Script
# Usage: ./deploy.sh

set -e

echo "🚀 Starting KaamKart UI Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  .env.production not found, using .env.production.example${NC}"
    if [ -f ".env.production.example" ]; then
        cp .env.production.example .env.production
        echo -e "${YELLOW}📝 Please update .env.production with your values${NC}"
    fi
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm ci

# Build application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    exit 1
fi

# Backup existing build
if [ -d "/var/www/kaamkart.in/.next" ]; then
    echo -e "${YELLOW}💾 Creating backup...${NC}"
    sudo cp -r /var/www/kaamkart.in/.next /var/www/kaamkart.in/.next.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy new build
echo -e "${YELLOW}📋 Installing new version...${NC}"
sudo mkdir -p /var/www/kaamkart.in
sudo cp -r .next /var/www/kaamkart.in/
sudo cp -r public /var/www/kaamkart.in/ 2>/dev/null || true
sudo cp package.json /var/www/kaamkart.in/
sudo chown -R www-data:www-data /var/www/kaamkart.in

# Reload Nginx
echo -e "${YELLOW}🔄 Reloading Nginx...${NC}"
sudo systemctl reload nginx

echo -e "${GREEN}✅ Deployment successful!${NC}"
echo -e "${GREEN}🎉 Frontend is now live!${NC}"

