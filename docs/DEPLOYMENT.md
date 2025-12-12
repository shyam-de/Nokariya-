# KaamKart Production Deployment Guide

Complete guide for deploying KaamKart to production on kaamkart.in

## Prerequisites

- Ubuntu 22.04 LTS server (2 CPU, 4GB RAM minimum)
- Domain name: kaamkart.in (DNS configured)
- SSH access to server
- Root/sudo access

## Quick Start

### 1. Initial Server Setup

```bash
# On your local machine, copy setup script to server
scp scripts/setup-server.sh user@your-server-ip:/tmp/

# SSH into server
ssh user@your-server-ip

# Run setup script
sudo bash /tmp/setup-server.sh
```

### 2. Clone Repository

```bash
cd /opt
sudo git clone https://github.com/your-username/nokariya.git kaamkart
sudo chown -R $USER:$USER kaamkart
cd kaamkart
```

### 3. Database Setup

```bash
# Create database user
sudo mysql -u root -p
```

```sql
CREATE DATABASE kaamkart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kaamkart_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON kaamkart.* TO 'kaamkart_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Import database schema
mysql -u kaamkart_user -p kaamkart < kaamkartApi/kaamkart-database.sql
```

### 4. Configure Backend

```bash
cd kaamkartApi

# Generate JWT secret
openssl rand -base64 32

# Copy and edit systemd service file
sudo cp kaamkart-api.service /etc/systemd/system/
sudo nano /etc/systemd/system/kaamkart-api.service
```

Update these values in the service file:
- `DB_PASSWORD`: Your database password
- `JWT_SECRET`: Generated secret from above
- Verify `CORS_ALLOWED_ORIGINS` and `WEBSOCKET_ALLOWED_ORIGINS`

```bash
# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable kaamkart-api
```

### 5. Configure Frontend

```bash
cd ../kaamkartUI

# Copy environment template
cp .env.production.example .env.production
nano .env.production
```

Update:
```env
NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api
NEXT_PUBLIC_SOCKET_URL=https://api.kaamkart.in
```

### 6. Configure Nginx

```bash
# Copy Nginx configuration
sudo cp nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in

# Enable site
sudo ln -s /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### 7. SSL Certificates

```bash
# Get SSL certificates from Let's Encrypt
sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in

# Test auto-renewal
sudo certbot renew --dry-run
```

### 8. Deploy Applications

```bash
# Deploy backend
cd /opt/kaamkart/kaamkartApi
chmod +x deploy.sh
./deploy.sh

# Deploy frontend
cd /opt/kaamkart/kaamkartUI
chmod +x deploy.sh
./deploy.sh
```

### 9. Verify Deployment

```bash
# Check backend health
curl https://api.kaamkart.in/api/health

# Check services
sudo systemctl status kaamkart-api
sudo systemctl status nginx

# Check logs
sudo journalctl -u kaamkart-api -f
```

## DNS Configuration

In your domain registrar, add these DNS records:

**A Records:**
```
@ (or kaamkart.in) → YOUR_SERVER_IP
www → YOUR_SERVER_IP
api → YOUR_SERVER_IP
```

**Or CNAME:**
```
www → kaamkart.in
api → kaamkart.in
```

Wait for DNS propagation (can take up to 48 hours, usually 1-2 hours).

## Environment Variables

### Backend (Systemd Service)

Edit `/etc/systemd/system/kaamkart-api.service`:

```ini
Environment="DB_URL=jdbc:mysql://localhost:3306/kaamkart?useSSL=true&requireSSL=true&serverTimezone=UTC"
Environment="DB_USERNAME=kaamkart_user"
Environment="DB_PASSWORD=your_password"
Environment="JWT_SECRET=your_jwt_secret"
Environment="CORS_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in"
Environment="WEBSOCKET_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in"
```

After editing, reload:
```bash
sudo systemctl daemon-reload
sudo systemctl restart kaamkart-api
```

### Frontend

Edit `/opt/kaamkart/kaamkartUI/.env.production`:

```env
NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api
NEXT_PUBLIC_SOCKET_URL=https://api.kaamkart.in
```

## Monitoring

### Health Checks

- Backend: `https://api.kaamkart.in/api/health`
- Readiness: `https://api.kaamkart.in/api/health/ready`
- Liveness: `https://api.kaamkart.in/api/health/live`

### Logs

```bash
# Backend logs
sudo journalctl -u kaamkart-api -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Application logs
sudo tail -f /var/log/kaamkart-api.log
```

### Service Management

```bash
# Start/Stop/Restart backend
sudo systemctl start kaamkart-api
sudo systemctl stop kaamkart-api
sudo systemctl restart kaamkart-api

# Check status
sudo systemctl status kaamkart-api

# View logs
sudo journalctl -u kaamkart-api -n 100
```

## Backup Strategy

### Database Backup

```bash
# Make backup script executable
chmod +x scripts/backup-database.sh

# Set database password
export DB_PASSWORD="your_password"

# Run backup manually
./scripts/backup-database.sh

# Add to crontab for daily backups at 2 AM
sudo crontab -e
# Add: 0 2 * * * /opt/kaamkart/scripts/backup-database.sh
```

Backups are stored in `/backup/kaamkart/` and kept for 30 days.

## Updates and Maintenance

### Update Backend

```bash
cd /opt/kaamkart
git pull origin main
cd kaamkartApi
./deploy.sh
```

### Update Frontend

```bash
cd /opt/kaamkart
git pull origin main
cd kaamkartUI
./deploy.sh
```

## Security Checklist

- [ ] Firewall configured (UFW)
- [ ] Fail2ban installed and configured
- [ ] SSL certificates installed and auto-renewal enabled
- [ ] Database password is strong
- [ ] JWT secret is strong and unique
- [ ] CORS origins are restricted
- [ ] Systemd service runs as non-root user
- [ ] Regular backups configured
- [ ] Logs are monitored
- [ ] Security headers enabled in Nginx

## Troubleshooting

### Backend won't start

```bash
# Check logs
sudo journalctl -u kaamkart-api -n 50

# Check Java version
java -version  # Should be 17+

# Check database connection
mysql -u kaamkart_user -p kaamkart
```

### Frontend not loading

```bash
# Check Nginx logs
sudo tail -f /var/log/nginx/error.log

# Check if build exists
ls -la /var/www/kaamkart.in/.next

# Rebuild if needed
cd /opt/kaamkart/kaamkartUI
npm run build
```

### SSL certificate issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

## Performance Optimization

### Database

- Indexes are already configured in the schema
- Run `ANALYZE TABLE` weekly for query optimization
- Monitor slow query log

### Application

- Connection pooling is configured (HikariCP)
- JVM heap size: 512MB-1GB (adjust in systemd service)
- Enable G1GC for better performance

### Nginx

- Gzip compression enabled
- Static asset caching configured
- Rate limiting enabled

## Support

For issues or questions:
- Check logs first
- Review this deployment guide
- Check GitHub issues
- Contact system administrator

## Cost Estimate

- VPS: $6-15/month (DigitalOcean, AWS EC2)
- Domain: $10-15/year
- SSL: Free (Let's Encrypt)
- **Total: ~$10-20/month**

