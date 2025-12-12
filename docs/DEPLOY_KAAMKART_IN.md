# Deploy KaamKart to kaamkart.in

Complete guide for deploying KaamKart to production on kaamkart.in domain.

## Prerequisites

1. **Domain**: kaamkart.in (already purchased)
2. **VPS/Server**: 
   - Minimum: 2GB RAM, 2 CPU cores, 20GB storage
   - Recommended: 4GB RAM, 4 CPU cores, 50GB storage
   - Options: DigitalOcean Droplet, AWS EC2, Linode, Vultr, etc.
3. **SSH Access**: To your server
4. **Domain DNS Access**: To configure DNS records

## Step 1: Server Setup

### 1.1 Connect to Your Server

```bash
ssh root@YOUR_SERVER_IP
# Or
ssh ubuntu@YOUR_SERVER_IP
```

### 1.2 Run Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required software
sudo apt install -y openjdk-17-jdk maven nginx certbot python3-certbot-nginx git mysql-server mysql-client curl wget ufw

# Configure firewall
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 1.3 Setup MySQL

```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p << EOF
CREATE DATABASE kaamkart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kaamkart'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON kaamkart.* TO 'kaamkart'@'localhost';
FLUSH PRIVILEGES;
EOF
```

**Important**: Replace `STRONG_PASSWORD_HERE` with a strong password.

## Step 2: Domain DNS Configuration

Configure your domain DNS records:

### 2.1 A Records

Add these A records pointing to your server IP:

```
Type: A
Name: @
Value: YOUR_SERVER_IP
TTL: 3600

Type: A
Name: www
Value: YOUR_SERVER_IP
TTL: 3600

Type: A
Name: api
Value: YOUR_SERVER_IP
TTL: 3600
```

### 2.2 Verify DNS

```bash
# Check DNS propagation
dig kaamkart.in
dig www.kaamkart.in
dig api.kaamkart.in
```

Wait for DNS to propagate (can take up to 48 hours, usually 1-2 hours).

## Step 3: Deploy Application

### 3.1 Clone Repository

```bash
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/nokariya.git kaamkart
# Or upload files via SCP/SFTP
cd kaamkart
```

### 3.2 Setup Database

```bash
# Import database schema
sudo mysql -u kaamkart -p kaamkart < kaamkartApi/kaamkart-database.sql
```

### 3.3 Build Backend

```bash
cd kaamkartApi

# Build JAR file
mvn clean package -DskipTests

# Create application directory
sudo mkdir -p /opt/kaamkart-api
sudo cp target/kaamkart-*.jar /opt/kaamkart-api/kaamkart-api.jar

# Create logs directory
sudo mkdir -p /opt/kaamkart-api/logs
sudo chown -R $USER:$USER /opt/kaamkart-api
```

### 3.4 Configure Backend Service

```bash
# Copy service file
sudo cp kaamkart-api.service /etc/systemd/system/

# Edit service file
sudo nano /etc/systemd/system/kaamkart-api.service
```

Update the service file with your configuration:

```ini
[Unit]
Description=KaamKart API Service
After=network.target mysql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/kaamkart-api
ExecStart=/usr/bin/java -Xms512m -Xmx1024m -jar /opt/kaamkart-api/kaamkart-api.jar --spring.profiles.active=prod
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kaamkart-api

# Environment variables
Environment="SPRING_PROFILES_ACTIVE=prod"
Environment="DB_URL=jdbc:mysql://localhost:3306/kaamkart?useSSL=true&requireSSL=true&serverTimezone=UTC"
Environment="DB_USERNAME=kaamkart"
Environment="DB_PASSWORD=YOUR_DB_PASSWORD"
Environment="JWT_SECRET=YOUR_JWT_SECRET_HERE"
Environment="CORS_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in"
Environment="WEBSOCKET_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in"
Environment="LOG_FILE_PATH=/opt/kaamkart-api/logs/kaamkart-api.log"

[Install]
WantedBy=multi-user.target
```

**Important**: Replace:
- `YOUR_DB_PASSWORD` with your MySQL password
- `YOUR_JWT_SECRET_HERE` with a strong random string (generate with: `openssl rand -base64 32`)

### 3.5 Start Backend Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service
sudo systemctl enable kaamkart-api

# Start service
sudo systemctl start kaamkart-api

# Check status
sudo systemctl status kaamkart-api

# View logs
sudo journalctl -u kaamkart-api -f
```

### 3.6 Build Frontend

```bash
cd /opt/kaamkart/kaamkartUI

# Install dependencies
npm install

# Create production environment file
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api
EOF

# Build for production
npm run build

# Create application directory
sudo mkdir -p /opt/kaamkart-ui
sudo cp -r .next /opt/kaamkart-ui/
sudo cp -r public /opt/kaamkart-ui/ 2>/dev/null || true
sudo cp package.json /opt/kaamkart-ui/
sudo cp next.config.js /opt/kaamkart-ui/
sudo chown -R www-data:www-data /opt/kaamkart-ui
```

### 3.7 Setup Frontend Service

```bash
# Install PM2 for process management
sudo npm install -g pm2

# Create PM2 ecosystem file
cat > /opt/kaamkart-ui/ecosystem.config.js << EOF
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

# Start with PM2
cd /opt/kaamkart-ui
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## Step 4: Configure Nginx

### 4.1 Copy Nginx Configuration

```bash
sudo cp /opt/kaamkart/nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in
sudo ln -s /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default
```

### 4.2 Update Nginx Configuration

Edit the configuration file:

```bash
sudo nano /etc/nginx/sites-available/kaamkart.in
```

Make sure it includes:
- Frontend proxy to `http://localhost:3000`
- Backend API proxy to `http://localhost:8585`
- SSL configuration (will be updated by Certbot)

### 4.3 Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 5: SSL Certificate Setup

### 5.1 Get SSL Certificate

```bash
# Stop Nginx temporarily (Certbot will start it)
sudo systemctl stop nginx

# Get certificate for all domains
sudo certbot certonly --standalone \
  -d kaamkart.in \
  -d www.kaamkart.in \
  -d api.kaamkart.in

# Start Nginx
sudo systemctl start nginx
```

### 5.2 Configure SSL in Nginx

```bash
# Run Certbot to configure Nginx
sudo certbot --nginx \
  -d kaamkart.in \
  -d www.kaamkart.in \
  -d api.kaamkart.in
```

This will automatically update your Nginx configuration with SSL.

### 5.3 Setup Auto-Renewal

```bash
# Test renewal
sudo certbot renew --dry-run

# Certbot auto-renewal is already configured via systemd timer
```

## Step 6: Final Configuration

### 6.1 Update Frontend API URL

Make sure frontend is using the correct API URL:

```bash
# Check .env.production
cat /opt/kaamkart-ui/.env.production
# Should show: NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api
```

### 6.2 Verify Services

```bash
# Check backend
curl http://localhost:8585/api/health

# Check frontend
curl http://localhost:3000

# Check from external
curl https://api.kaamkart.in/api/health
```

### 6.3 Setup Monitoring

```bash
# Setup log rotation
sudo nano /etc/logrotate.d/kaamkart-api
```

Add:
```
/opt/kaamkart-api/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
```

## Step 7: Testing

### 7.1 Test URLs

- Frontend: https://kaamkart.in
- Frontend (www): https://www.kaamkart.in
- API: https://api.kaamkart.in/api/health
- API Health: https://api.kaamkart.in/api/health

### 7.2 Test Features

1. ✅ Homepage loads
2. ✅ Can register new user
3. ✅ Can login
4. ✅ API endpoints work
5. ✅ SSL certificate valid
6. ✅ All pages accessible

## Step 8: Maintenance

### 8.1 Update Application

```bash
cd /opt/kaamkart

# Pull latest changes
git pull

# Rebuild and redeploy backend
cd kaamkartApi
mvn clean package -DskipTests
sudo systemctl stop kaamkart-api
sudo cp target/kaamkart-*.jar /opt/kaamkart-api/kaamkart-api.jar
sudo systemctl start kaamkart-api

# Rebuild and redeploy frontend
cd ../kaamkartUI
npm install
npm run build
sudo cp -r .next /opt/kaamkart-ui/
pm2 restart kaamkart-ui
```

### 8.2 Database Backup

```bash
# Manual backup
mysqldump -u kaamkart -p kaamkart > backup-$(date +%Y%m%d).sql

# Setup automated backups (add to crontab)
0 2 * * * mysqldump -u kaamkart -pPASSWORD kaamkart > /backups/kaamkart-$(date +\%Y\%m\%d).sql
```

### 8.3 Monitor Logs

```bash
# Backend logs
sudo journalctl -u kaamkart-api -f

# Frontend logs
pm2 logs kaamkart-ui

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Backend Not Starting

```bash
# Check service status
sudo systemctl status kaamkart-api

# Check logs
sudo journalctl -u kaamkart-api -n 50

# Check Java version
java -version  # Should be 17+

# Check database connection
mysql -u kaamkart -p -e "SELECT 1"
```

### Frontend Not Loading

```bash
# Check PM2 status
pm2 status

# Check PM2 logs
pm2 logs kaamkart-ui

# Restart PM2
pm2 restart kaamkart-ui
```

### SSL Issues

```bash
# Check certificate
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx SSL config
sudo nginx -t
```

### Database Connection Issues

```bash
# Test MySQL connection
mysql -u kaamkart -p kaamkart

# Check MySQL status
sudo systemctl status mysql

# Check MySQL logs
sudo tail -f /var/log/mysql/error.log
```

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] Strong database password
- [ ] Strong JWT secret
- [ ] SSL certificates installed
- [ ] Non-root user for services
- [ ] Regular security updates
- [ ] Database backups configured
- [ ] Log rotation setup
- [ ] CORS properly configured
- [ ] Environment variables secured

## Performance Optimization

1. **Enable Gzip** (already in Nginx config)
2. **Enable Caching** (add to Nginx config)
3. **Database Indexes** (already optimized)
4. **Connection Pooling** (configured in application-prod.properties)
5. **CDN** (optional, for static assets)

## Support

For issues or questions:
- Check logs first
- Review this guide
- Check GitHub issues
- Contact support

---

**Congratulations!** Your KaamKart application is now live on kaamkart.in! 🎉

