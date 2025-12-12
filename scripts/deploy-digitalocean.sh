#!/bin/bash

# KaamKart DigitalOcean Deployment Script
# This script automates the deployment process on a DigitalOcean droplet
# Run this script on your DigitalOcean droplet after initial setup

set -e

echo "🚀 KaamKart DigitalOcean Deployment"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}❌ Please run as root or with sudo${NC}"
   exit 1
fi

# Get droplet IP
DROPLET_IP=$(curl -s http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "${BLUE}📍 Droplet IP: $DROPLET_IP${NC}"

# Step 1: Update system
echo -e "\n${YELLOW}📦 Step 1: Updating system...${NC}"
apt update && apt upgrade -y

# Step 2: Install required software
echo -e "\n${YELLOW}📦 Step 2: Installing required software...${NC}"
apt install -y \
    openjdk-17-jdk \
    maven \
    mysql-server \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    ufw \
    fail2ban \
    curl \
    wget

# Install Node.js 18+
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 18 ]; then
    echo -e "${YELLOW}📦 Installing Node.js 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Step 3: Configure firewall
echo -e "\n${YELLOW}🔥 Step 3: Configuring firewall...${NC}"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Step 4: Secure MySQL
echo -e "\n${YELLOW}🔒 Step 4: Securing MySQL...${NC}"
if [ ! -f /root/.mysql_configured ]; then
    echo -e "${YELLOW}⚠️  Please run: mysql_secure_installation${NC}"
    echo -e "${YELLOW}⚠️  Then create database and user manually${NC}"
    touch /root/.mysql_configured
fi

# Step 5: Create directories
echo -e "\n${YELLOW}📁 Step 5: Creating directories...${NC}"
mkdir -p /opt/kaamkart-api
mkdir -p /var/www/kaamkart.in
mkdir -p /var/log/kaamkart
mkdir -p /backup/kaamkart
chown -R www-data:www-data /opt/kaamkart-api
chown -R www-data:www-data /var/www/kaamkart.in
chown -R www-data:www-data /var/log/kaamkart

# Step 6: Clone repository (if not exists)
if [ ! -d "/opt/kaamkart" ]; then
    echo -e "\n${YELLOW}📥 Step 6: Cloning repository...${NC}"
    echo -e "${YELLOW}⚠️  Please provide your repository URL:${NC}"
    read -p "GitHub repository URL: " REPO_URL
    cd /opt
    git clone "$REPO_URL" kaamkart
else
    echo -e "\n${YELLOW}📥 Step 6: Repository already exists, pulling latest...${NC}"
    cd /opt/kaamkart
    git pull origin main
fi

# Step 7: Database setup reminder
echo -e "\n${YELLOW}💾 Step 7: Database Setup${NC}"
echo -e "${BLUE}Please run these commands:${NC}"
echo "mysql -u root -p"
echo "CREATE DATABASE kaamkart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "CREATE USER 'kaamkart_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';"
echo "GRANT ALL PRIVILEGES ON kaamkart.* TO 'kaamkart_user'@'localhost';"
echo "FLUSH PRIVILEGES;"
echo "EXIT;"
echo ""
echo "mysql -u kaamkart_user -p kaamkart < /opt/kaamkart/kaamkartApi/kaamkart-database.sql"

# Step 8: Generate JWT secret
echo -e "\n${YELLOW}🔐 Step 8: Generating JWT secret...${NC}"
JWT_SECRET=$(openssl rand -base64 32)
echo -e "${GREEN}✅ JWT Secret: $JWT_SECRET${NC}"
echo -e "${YELLOW}⚠️  Save this secret! You'll need it for the systemd service.${NC}"

# Step 9: Setup systemd service
echo -e "\n${YELLOW}⚙️  Step 9: Setting up systemd service...${NC}"
if [ -f "/opt/kaamkart/kaamkartApi/kaamkart-api.service" ]; then
    cp /opt/kaamkart/kaamkartApi/kaamkart-api.service /etc/systemd/system/
    echo -e "${YELLOW}⚠️  Please edit /etc/systemd/system/kaamkart-api.service and update:${NC}"
    echo "  - DB_PASSWORD"
    echo "  - JWT_SECRET (use the one generated above)"
else
    echo -e "${RED}❌ Service file not found!${NC}"
fi

# Step 10: Setup Nginx
echo -e "\n${YELLOW}🌐 Step 10: Setting up Nginx...${NC}"
if [ -f "/opt/kaamkart/config/nginx/kaamkart.in.conf" ]; then
    cp /opt/kaamkart/config/nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in
    ln -sf /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
    echo -e "${GREEN}✅ Nginx configured${NC}"
else
    echo -e "${RED}❌ Nginx config not found!${NC}"
fi

# Summary
echo -e "\n${GREEN}✅ Setup Complete!${NC}"
echo -e "\n${BLUE}Next Steps:${NC}"
echo "1. Setup database (see instructions above)"
echo "2. Edit /etc/systemd/system/kaamkart-api.service with your credentials"
echo "3. Configure DNS to point to this droplet: $DROPLET_IP"
echo "4. Get SSL certificates: sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in"
echo "5. Deploy backend: cd /opt/kaamkart/kaamkartApi && ./deploy.sh"
echo "6. Deploy frontend: cd /opt/kaamkart/kaamkartUI && ./deploy.sh"
echo ""
echo -e "${GREEN}🎉 Ready for deployment!${NC}"

