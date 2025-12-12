#!/bin/bash

# KaamKart Production Deployment Script for kaamkart.in
# Run this script on your production server

set -e

echo "=========================================="
echo "KaamKart Production Deployment"
echo "Domain: kaamkart.in"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

# Configuration
APP_DIR="/opt/kaamkart"
API_DIR="/opt/kaamkart-api"
UI_DIR="/opt/kaamkart-ui"
SERVICE_USER="www-data"

echo -e "${GREEN}Step 1: Checking prerequisites...${NC}"

# Check Java
if ! command -v java &> /dev/null; then
    echo -e "${RED}Java not found. Installing...${NC}"
    apt update
    apt install -y openjdk-17-jdk
fi

# Check Maven
if ! command -v mvn &> /dev/null; then
    echo -e "${RED}Maven not found. Installing...${NC}"
    apt install -y maven
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js not found. Installing...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Check PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing...${NC}"
    npm install -g pm2
fi

echo -e "${GREEN}✓ Prerequisites checked${NC}"
echo ""

echo -e "${GREEN}Step 2: Setting up directories...${NC}"
mkdir -p $API_DIR/logs
mkdir -p $UI_DIR
chown -R $SERVICE_USER:$SERVICE_USER $API_DIR
chown -R $SERVICE_USER:$SERVICE_USER $UI_DIR
echo -e "${GREEN}✓ Directories created${NC}"
echo ""

echo -e "${GREEN}Step 3: Building backend...${NC}"
cd $APP_DIR/kaamkartApi
mvn clean package -DskipTests

if [ ! -f target/kaamkart-*.jar ]; then
    echo -e "${RED}Build failed!${NC}"
    exit 1
fi

# Copy JAR
cp target/kaamkart-*.jar $API_DIR/kaamkart-api.jar
chown $SERVICE_USER:$SERVICE_USER $API_DIR/kaamkart-api.jar
echo -e "${GREEN}✓ Backend built${NC}"
echo ""

echo -e "${GREEN}Step 4: Building frontend...${NC}"
cd $APP_DIR/kaamkartUI

# Create production env file if doesn't exist
if [ ! -f .env.production ]; then
    echo "NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api" > .env.production
fi

npm install
npm run build

# Copy build files
cp -r .next $UI_DIR/
cp package.json $UI_DIR/
cp next.config.js $UI_DIR/
[ -d public ] && cp -r public $UI_DIR/ || true
chown -R $SERVICE_USER:$SERVICE_USER $UI_DIR
echo -e "${GREEN}✓ Frontend built${NC}"
echo ""

echo -e "${GREEN}Step 5: Setting up services...${NC}"

# Backend service
if [ -f $APP_DIR/kaamkartApi/kaamkart-api.service ]; then
    cp $APP_DIR/kaamkartApi/kaamkart-api.service /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable kaamkart-api
    echo -e "${YELLOW}⚠ Backend service configured. Please edit /etc/systemd/system/kaamkart-api.service with your environment variables${NC}"
fi

# Frontend PM2
cd $UI_DIR
if [ ! -f ecosystem.config.js ]; then
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'kaamkart-ui',
    script: 'node_modules/next/dist/bin/next',
    args: 'start',
    cwd: '/opt/kaamkart-ui',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF
fi

pm2 start ecosystem.config.js || pm2 restart kaamkart-ui
pm2 save
echo -e "${GREEN}✓ Services configured${NC}"
echo ""

echo -e "${GREEN}Step 6: Configuring Nginx...${NC}"
if [ -f $APP_DIR/config/nginx/kaamkart.in.conf ]; then
    cp $APP_DIR/config/nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in
    ln -sf /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test Nginx config
    if nginx -t; then
        systemctl reload nginx
        echo -e "${GREEN}✓ Nginx configured${NC}"
    else
        echo -e "${RED}Nginx configuration error!${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Nginx config not found. Please configure manually${NC}"
fi
echo ""

echo -e "${GREEN}Step 7: SSL Certificate${NC}"
echo -e "${YELLOW}Run the following to setup SSL:${NC}"
echo "sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in"
echo ""

echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Edit /etc/systemd/system/kaamkart-api.service with your environment variables"
echo "2. Start backend: sudo systemctl start kaamkart-api"
echo "3. Setup SSL: sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in"
echo "4. Test: https://kaamkart.in"
echo ""
echo -e "${GREEN}Done!${NC}"

