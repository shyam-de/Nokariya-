#!/bin/bash

# KaamKart Server Setup Script
# Run this script on a fresh Ubuntu 22.04 server
# Usage: sudo ./setup-server.sh

set -e

echo "🚀 Setting up KaamKart production server..."

# Update system
echo "📦 Updating system packages..."
apt update && apt upgrade -y

# Install required software
echo "📦 Installing required software..."
apt install -y \
    openjdk-17-jdk \
    maven \
    mysql-server \
    nginx \
    certbot \
    python3-certbot-nginx \
    nodejs \
    npm \
    git \
    ufw \
    fail2ban \
    htop \
    curl \
    wget

# Install Node.js 18+ if needed
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" -lt 18 ]; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Configure firewall
echo "🔥 Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Secure MySQL
echo "🔒 Securing MySQL..."
if [ ! -f /root/.mysql_configured ]; then
    mysql_secure_installation
    touch /root/.mysql_configured
fi

# Create application directories
echo "📁 Creating application directories..."
mkdir -p /opt/kaamkart-api
mkdir -p /var/www/kaamkart.in
mkdir -p /var/log/kaamkart
mkdir -p /backup/kaamkart
chown -R www-data:www-data /opt/kaamkart-api
chown -R www-data:www-data /var/www/kaamkart.in
chown -R www-data:www-data /var/log/kaamkart

# Create systemd service directory
mkdir -p /etc/systemd/system

echo "✅ Server setup complete!"
echo ""
echo "Next steps:"
echo "1. Clone your repository: git clone https://github.com/your-username/nokariya.git /opt/kaamkart"
echo "2. Set up database: mysql -u root -p < /opt/kaamkart/kaamkartApi/kaamkart-database.sql"
echo "3. Configure environment variables in /etc/systemd/system/kaamkart-api.service"
echo "4. Copy Nginx config: cp /opt/kaamkart/nginx/kaamkart.in.conf /etc/nginx/sites-available/"
echo "5. Enable site: ln -s /etc/nginx/sites-available/kaamkart.in.conf /etc/nginx/sites-enabled/"
echo "6. Get SSL certificates: certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in"
echo "7. Deploy backend: cd /opt/kaamkart/kaamkartApi && ./deploy.sh"
echo "8. Deploy frontend: cd /opt/kaamkart/kaamkartUI && ./deploy.sh"

