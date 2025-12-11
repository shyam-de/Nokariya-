#!/bin/bash

# KaamKart AWS Free Tier Deployment Script
# Run this on your EC2 t2.micro instance after initial setup

set -e

echo "🚀 KaamKart AWS Free Tier Deployment"
echo "====================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running on EC2
if ! curl -s http://169.254.169.254/latest/meta-data/instance-id > /dev/null; then
    echo -e "${RED}❌ This script must run on an EC2 instance${NC}"
    exit 1
fi

INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
echo -e "${BLUE}📍 Instance ID: $INSTANCE_ID${NC}"
echo -e "${BLUE}📍 Region: $REGION${NC}"

# Get RDS endpoint
echo ""
read -p "Enter RDS Endpoint (e.g., kaamkart-db.xxxxx.us-east-1.rds.amazonaws.com): " RDS_ENDPOINT
read -sp "Enter RDS Password: " RDS_PASSWORD
echo ""

# Test RDS connection
echo -e "${YELLOW}🔌 Testing RDS connection...${NC}"
if ! mysql -h "$RDS_ENDPOINT" -u kaamkart_admin -p"$RDS_PASSWORD" -e "SELECT 1" 2>/dev/null; then
    echo -e "${RED}❌ Cannot connect to RDS.${NC}"
    echo -e "${YELLOW}⚠️  Check:${NC}"
    echo "  1. RDS security group allows EC2 security group"
    echo "  2. RDS endpoint is correct"
    echo "  3. Username and password are correct"
    exit 1
fi
echo -e "${GREEN}✅ RDS connection successful${NC}"

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✅ JWT Secret: $JWT_SECRET${NC}"
echo -e "${YELLOW}⚠️  Save this secret!${NC}"

# Clone repository if not exists
if [ ! -d "/opt/kaamkart" ]; then
    echo -e "${YELLOW}📥 Cloning repository...${NC}"
    read -p "GitHub repository URL: " REPO_URL
    cd /opt
    git clone "$REPO_URL" kaamkart
else
    echo -e "${YELLOW}📥 Pulling latest changes...${NC}"
    cd /opt/kaamkart
    git pull origin main
fi

# Setup database
echo -e "${YELLOW}💾 Setting up database...${NC}"
cd /opt/kaamkart/kaamkartApi
if mysql -h "$RDS_ENDPOINT" -u kaamkart_admin -p"$RDS_PASSWORD" kaamkart < kaamkart-database.sql 2>/dev/null; then
    echo -e "${GREEN}✅ Database schema imported${NC}"
else
    echo -e "${YELLOW}⚠️  Database might already exist or error occurred. Continuing...${NC}"
fi

# Configure backend
echo -e "${YELLOW}⚙️  Configuring backend...${NC}"
cd /opt/kaamkart/kaamkartApi

# Update systemd service
sudo cp kaamkart-api.service /etc/systemd/system/
sudo sed -i "s|CHANGE_THIS_PASSWORD|$RDS_PASSWORD|g" /etc/systemd/system/kaamkart-api.service
sudo sed -i "s|CHANGE_THIS_SECRET|$JWT_SECRET|g" /etc/systemd/system/kaamkart-api.service
sudo sed -i "s|localhost:3306|$RDS_ENDPOINT:3306|g" /etc/systemd/system/kaamkart-api.service

# Optimize for free tier (1GB RAM) - reduce Java heap
sudo sed -i 's/-Xms512m -Xmx1024m/-Xms256m -Xmx384m/g' /etc/systemd/system/kaamkart-api.service

sudo systemctl daemon-reload
sudo systemctl enable kaamkart-api

# Configure frontend
echo -e "${YELLOW}🎨 Configuring frontend...${NC}"
cd /opt/kaamkart/kaamkartUI
if [ ! -f ".env.production" ]; then
    cp .env.production.example .env.production
fi
sed -i "s|http://localhost:8585/api|https://api.kaamkart.in/api|g" .env.production
sed -i "s|http://localhost:8585|https://api.kaamkart.in|g" .env.production

# Setup Nginx
echo -e "${YELLOW}🌐 Setting up Nginx...${NC}"
if [ -f "/opt/kaamkart/nginx/kaamkart.in.conf" ]; then
    sudo cp /opt/kaamkart/nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in
    sudo ln -sf /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo nginx -t
    sudo systemctl reload nginx
    echo -e "${GREEN}✅ Nginx configured${NC}"
else
    echo -e "${YELLOW}⚠️  Nginx config not found. Configure manually.${NC}"
fi

# Deploy
echo -e "${YELLOW}🚀 Deploying applications...${NC}"
cd /opt/kaamkart/kaamkartApi
if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    ./deploy.sh
else
    echo -e "${YELLOW}⚠️  Deploy script not found. Building manually...${NC}"
    mvn clean package -DskipTests
    sudo mkdir -p /opt/kaamkart-api
    sudo cp target/kaamkart-api-1.0.0.jar /opt/kaamkart-api/
    sudo systemctl start kaamkart-api
fi

cd /opt/kaamkart/kaamkartUI
if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    ./deploy.sh
else
    echo -e "${YELLOW}⚠️  Deploy script not found. Building manually...${NC}"
    npm ci
    npm run build
    sudo mkdir -p /var/www/kaamkart.in
    sudo cp -r .next /var/www/kaamkart.in/
    sudo cp -r public /var/www/kaamkart.in/ 2>/dev/null || true
fi

# Wait for service to start
sleep 5

# Check service status
if sudo systemctl is-active --quiet kaamkart-api; then
    echo -e "${GREEN}✅ Backend service is running${NC}"
else
    echo -e "${RED}❌ Backend service failed to start${NC}"
    echo -e "${YELLOW}Check logs: sudo journalctl -u kaamkart-api -n 50${NC}"
fi

echo ""
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo -e "${YELLOW}⚠️  Next steps:${NC}"
echo "1. Configure DNS in Route 53 (point to EC2 Elastic IP)"
echo "2. Update RDS security group to allow EC2 security group only"
echo "3. Get SSL certificates: sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in"
echo "4. Set up CloudWatch billing alerts"
echo "5. Test: curl http://localhost:8585/api/health"
echo ""
echo -e "${GREEN}🎉 Your app is ready!${NC}"

