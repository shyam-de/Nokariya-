#!/bin/bash

# KaamKart AWS Free Tier EC2 User Data Script
# Optimized for t2.micro (1GB RAM)
# This script runs when EC2 instance first launches

set -e

echo "🚀 KaamKart AWS Free Tier Setup"
echo "==============================="

# Update system
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Install required packages (minimal for free tier)
apt-get install -y \
    openjdk-17-jdk \
    maven \
    nginx \
    certbot \
    python3-certbot-nginx \
    git \
    ufw \
    fail2ban \
    mysql-client \
    curl \
    wget \
    unattended-upgrades

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Configure automatic security updates
echo 'Unattended-Upgrade::Automatic-Reboot "false";' >> /etc/apt/apt.conf.d/50unattended-upgrades

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Create swap file (important for 1GB RAM)
echo "📦 Creating swap file..."
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Create application directories
mkdir -p /opt/kaamkart-api
mkdir -p /var/www/kaamkart.in
mkdir -p /var/log/kaamkart
mkdir -p /backup/kaamkart
chown -R ubuntu:ubuntu /opt/kaamkart-api
chown -R www-data:www-data /var/www/kaamkart.in
chown -R www-data:www-data /var/log/kaamkart

# Configure fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Get instance metadata
INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s http://169.254.169.254/latest/meta-data/placement/region)
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

echo "✅ EC2 Free Tier setup complete!"
echo "📍 Instance ID: $INSTANCE_ID"
echo "📍 Region: $REGION"
echo "📍 Public IP: $PUBLIC_IP"
echo "💾 Swap: 2GB created"
echo ""
echo "Next: Clone repository and deploy"
echo "Run: bash aws/scripts/deploy-aws-free-tier.sh"

