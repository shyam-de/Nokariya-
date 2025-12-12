# Deploy KaamKart on DigitalOcean

Complete guide for deploying KaamKart to DigitalOcean.

## 🎯 Deployment Options

### Option 1: DigitalOcean Droplet (VPS) - Recommended ⭐
- **Cost**: $6-12/month
- **Control**: Full server control
- **Best for**: Production with custom requirements

### Option 2: DigitalOcean App Platform (PaaS)
- **Cost**: $5-25/month
- **Control**: Managed platform
- **Best for**: Easy deployment, auto-scaling

## 🚀 Option 1: Droplet Deployment (Recommended)

### Step 1: Create Droplet

1. **Login to DigitalOcean**
   - Go to https://cloud.digitalocean.com
   - Click "Create" → "Droplets"

2. **Choose Configuration**
   - **Image**: Ubuntu 22.04 (LTS)
   - **Plan**: Basic
   - **Size**: Regular Intel (2GB RAM / 1 vCPU) - $12/month
     - Or Premium Intel (4GB RAM / 2 vCPU) - $24/month (recommended for production)
   - **Region**: Choose closest to your users
   - **Authentication**: SSH keys (recommended) or Password

3. **Additional Options**
   - ✅ Enable Monitoring
   - ✅ Enable Backups (optional, +20% cost)
   - **User Data** (optional): Use `scripts/setup-server.sh` as reference

4. **Create Droplet**

### Step 2: Initial Server Setup

**Option A: Automated (Recommended)**
```bash
# SSH into your droplet
ssh root@YOUR_DROPLET_IP

# Run quick setup
curl -o /tmp/setup.sh https://raw.githubusercontent.com/your-username/nokariya/main/scripts/setup-server.sh
bash /tmp/setup.sh
```

**Option B: Full Automated**
```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Run full deployment script
curl -o /tmp/deploy.sh https://raw.githubusercontent.com/your-username/nokariya/main/scripts/deploy-digitalocean.sh
bash /tmp/deploy.sh
```

**Option C: Manual**
```bash
# Update system
apt update && apt upgrade -y

# Install required software
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
    fail2ban

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Configure firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### Step 3: Clone Repository

```bash
cd /opt
git clone https://github.com/your-username/nokariya.git kaamkart
cd kaamkart
```

### Step 4: Database Setup

```bash
# Secure MySQL
mysql_secure_installation

# Create database
mysql -u root -p
```

```sql
CREATE DATABASE kaamkart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kaamkart_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON kaamkart.* TO 'kaamkart_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Import schema
mysql -u kaamkart_user -p kaamkart < kaamkartApi/kaamkart-database.sql
```

### Step 5: Configure Backend

```bash
cd /opt/kaamkart/kaamkartApi

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET: $JWT_SECRET"
echo "Save this secret!"

# Create systemd service
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

### Step 6: Configure Frontend

```bash
cd /opt/kaamkart/kaamkartUI

# Create production environment file
cp .env.production.example .env.production
nano .env.production
```

Set:
```env
NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api
NEXT_PUBLIC_SOCKET_URL=https://api.kaamkart.in
```

### Step 7: Configure Nginx

```bash
# Copy Nginx config
sudo cp /opt/kaamkart/nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in

# Enable site
sudo ln -s /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 8: Configure DNS

**Option A: Use Your Domain Registrar**

Add A records:
```
@ (or kaamkart.in) → YOUR_DROPLET_IP
www → YOUR_DROPLET_IP
api → YOUR_DROPLET_IP
```

**Option B: Use DigitalOcean DNS (Recommended)**

1. Go to DigitalOcean Dashboard → **Networking** → **Domains**
2. Click **Add Domain**
3. Enter: `kaamkart.in`
4. Add A records:
   - `@` → YOUR_DROPLET_IP
   - `www` → YOUR_DROPLET_IP
   - `api` → YOUR_DROPLET_IP
5. Update nameservers at your domain registrar to DigitalOcean nameservers:
   - `ns1.digitalocean.com`
   - `ns2.digitalocean.com`
   - `ns3.digitalocean.com`

### Step 9: SSL Certificates

Wait 5-10 minutes for DNS propagation, then:

```bash
# Get SSL certificates
sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in

# Test auto-renewal
sudo certbot renew --dry-run
```

### Step 10: Deploy Applications

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

### Step 11: Verify Deployment

```bash
# Check services
sudo systemctl status kaamkart-api
sudo systemctl status nginx

# Test endpoints
curl https://api.kaamkart.in/api/health
curl https://kaamkart.in

# Check logs
sudo journalctl -u kaamkart-api -f
```

## 🚀 Option 2: App Platform Deployment

### Step 1: Prepare Repository

Ensure your code is on GitHub.

### Step 2: Create App

1. **Go to App Platform**
   - DigitalOcean Dashboard → **Apps** → **Create App**

2. **Connect Repository**
   - Connect your GitHub account
   - Select repository: `nokariya`
   - Select branch: `main`

3. **Configure Backend Service**
   - **Type**: Web Service
   - **Source Directory**: `kaamkartApi`
   - **Build Command**: `mvn clean package -DskipTests`
   - **Run Command**: `java -jar -Dspring.profiles.active=prod target/kaamkart-api-1.0.0.jar`
   - **HTTP Port**: `8585`
   - **Instance Size**: Basic ($5/month) or Professional ($12/month)

4. **Environment Variables** (Set as Secrets):
   ```
   SPRING_PROFILES_ACTIVE=prod
   DB_URL=jdbc:mysql://your-db-host:25060/kaamkart?useSSL=true
   DB_USERNAME=kaamkart_user
   DB_PASSWORD=your_password (SECRET)
   JWT_SECRET=your_jwt_secret (SECRET)
   CORS_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in
   WEBSOCKET_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in
   SERVER_PORT=8585
   ```

5. **Health Check**:
   - Path: `/api/health`

6. **Configure Frontend Service**
   - **Type**: Static Site
   - **Source Directory**: `kaamkartUI`
   - **Build Command**: `npm ci && npm run build`
   - **Output Directory**: `.next`

7. **Environment Variables**:
   ```
   NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api
   NEXT_PUBLIC_SOCKET_URL=https://api.kaamkart.in
   ```

8. **Add Database**
   - Click **Add Resource** → **Database**
   - Choose MySQL 8
   - Select plan (Basic $15/month recommended)
   - Database will be automatically connected

9. **Deploy**
   - Click **Review** → **Create Resources**

## 📊 DigitalOcean Specific Features

### Monitoring

DigitalOcean provides built-in monitoring:
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

**Enable**: Droplet → **Monitoring** tab → Enable

### Backups

Enable automatic backups:
- Droplet → **Settings** → **Backups**
- Cost: +20% of droplet cost
- Daily backups retained for 7 days

### Firewall

DigitalOcean Firewall (additional security layer):
1. **Networking** → **Firewalls** → **Create Firewall**
2. **Inbound Rules**:
   - HTTP (80) - Allow
   - HTTPS (443) - Allow
   - SSH (22) - Allow (from your IP only)
3. **Outbound Rules**: All
4. **Attach** to your droplet

### Load Balancer (For High Availability)

1. **Networking** → **Load Balancers** → **Create**
2. **Add** backend droplets
3. **Health Check**: `https://api.kaamkart.in/api/health`
4. **Update DNS** to point to load balancer IP

### Spaces (Object Storage - Optional)

For storing user uploads/images:
1. **Spaces** → **Create Space**
2. Use S3-compatible API
3. Update application to use Spaces

## 🔧 DigitalOcean Optimizations

### 1. Use Managed Database (Recommended)

Instead of self-hosted MySQL:
1. **Databases** → **Create Database**
2. Choose **MySQL 8**
3. Select **region** (same as droplet)
4. Choose **plan** (Basic $15/month)
5. Update `DB_URL` in backend config

**Benefits**:
- Automated backups
- High availability
- Managed updates
- Connection pooling

### 2. Enable Monitoring Alerts

1. **Monitoring** → **Alerts**
2. Create alerts for:
   - High CPU usage (>80%)
   - High memory usage (>90%)
   - Disk usage (>80%)
   - High network traffic

### 3. Use DigitalOcean Spaces for Static Assets

For images, documents:
```bash
# Install s3cmd
apt install s3cmd

# Configure
s3cmd --configure
```

## 💰 Cost Breakdown

### Droplet Option (Recommended)
- Droplet (2GB RAM): $12/month
- Domain: $10-15/year
- SSL: Free (Let's Encrypt)
- **Total: ~$12-15/month**

### Droplet + Managed Database
- Droplet (2GB RAM): $12/month
- Managed Database (Basic): $15/month
- Domain: $10-15/year
- **Total: ~$27-28/month**

### App Platform Option
- Backend (Basic): $5/month
- Frontend (Static): $0/month (free tier)
- Database (Basic): $15/month
- **Total: ~$20/month**

## 🔄 Updates

### Update via Git (Droplet)

```bash
cd /opt/kaamkart
git pull origin main
./scripts/update.sh
```

### Update via App Platform

- Automatic: Deploys on git push to main branch
- Manual: App Platform → **Actions** → **Force Rebuild**

## 🛠️ Troubleshooting

### Can't SSH into droplet

1. Check DigitalOcean Firewall rules
2. Verify SSH key in DigitalOcean
3. Try password authentication (if enabled)
4. Check droplet status in dashboard

### Service won't start

```bash
# Check logs
sudo journalctl -u kaamkart-api -n 50

# Check Java
java -version  # Should be 17+

# Check database connection
mysql -u kaamkart_user -p kaamkart

# Check systemd service
sudo systemctl status kaamkart-api
```

### SSL certificate issues

```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check Nginx config
sudo nginx -t
```

### High resource usage

1. Check monitoring dashboard
2. Review logs for errors
3. Consider upgrading droplet size
4. Optimize database queries
5. Enable caching

### Database connection issues

```bash
# Test connection
mysql -u kaamkart_user -p kaamkart

# Check MySQL status
sudo systemctl status mysql

# Check MySQL logs
sudo tail -f /var/log/mysql/error.log
```

## 📈 Scaling

### Vertical Scaling (Upgrade Droplet)

1. **Power off** droplet
2. **Resize** → Choose larger plan
3. **Power on**

### Horizontal Scaling (Load Balancer)

1. Create **additional droplets**
2. Deploy application to each
3. Set up **load balancer**
4. Configure **session affinity** (if needed)

### Auto-Scaling (App Platform)

App Platform supports auto-scaling:
- Configure min/max instances
- Set scaling rules based on CPU/memory
- Automatic scaling based on traffic

## 🔐 Security Best Practices

1. ✅ Use SSH keys (not passwords)
2. ✅ Enable DigitalOcean Firewall
3. ✅ Enable UFW firewall
4. ✅ Keep system updated: `apt update && apt upgrade`
5. ✅ Use strong passwords
6. ✅ Enable fail2ban
7. ✅ Regular backups
8. ✅ Monitor logs
9. ✅ Use managed database (optional)
10. ✅ Restrict SSH access to specific IPs

## 📞 Support

- **DigitalOcean Support**: https://www.digitalocean.com/support
- **Community**: https://www.digitalocean.com/community
- **Status**: https://status.digitalocean.com
- **Documentation**: https://docs.digitalocean.com

## 🎯 Quick Reference

### Important Commands

```bash
# Service management
sudo systemctl start kaamkart-api
sudo systemctl stop kaamkart-api
sudo systemctl restart kaamkart-api
sudo systemctl status kaamkart-api

# View logs
sudo journalctl -u kaamkart-api -f
sudo tail -f /var/log/nginx/error.log

# Health check
curl https://api.kaamkart.in/api/health

# Update application
cd /opt/kaamkart && git pull && ./scripts/update.sh

# Backup database
./scripts/backup-database.sh
```

### Important Files

- Service: `/etc/systemd/system/kaamkart-api.service`
- Nginx: `/etc/nginx/sites-available/kaamkart.in`
- Logs: `/var/log/kaamkart-api.log`
- App: `/opt/kaamkart-api/kaamkart-api-1.0.0.jar`
- Frontend: `/var/www/kaamkart.in`

---

**Ready to deploy?** Start with [QUICK_START_DIGITALOCEAN.md](./QUICK_START_DIGITALOCEAN.md) for fastest setup!
