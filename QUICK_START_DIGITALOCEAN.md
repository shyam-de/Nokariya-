# 🚀 Quick Start: Deploy to DigitalOcean

Fastest way to deploy KaamKart to DigitalOcean.

## Prerequisites

- DigitalOcean account
- Domain name (kaamkart.in) configured
- GitHub repository

## 5-Minute Deployment

### 1. Create Droplet (2 minutes)

1. Login to DigitalOcean
2. Create → Droplets
3. Choose:
   - **Ubuntu 22.04**
   - **Regular Intel - 2GB RAM** ($12/month)
   - **Region**: Closest to users
   - **SSH Keys**: Add your key
4. Click "Create Droplet"

### 2. Initial Setup (1 minute)

```bash
# SSH into droplet
ssh root@YOUR_DROPLET_IP

# Run quick setup
curl -o /tmp/setup.sh https://raw.githubusercontent.com/your-username/nokariya/main/scripts/setup-server.sh
bash /tmp/setup.sh
```

### 3. Clone & Configure (1 minute)

```bash
# Clone repository
cd /opt
git clone https://github.com/your-username/nokariya.git kaamkart
cd kaamkart

# Run full deployment script
bash scripts/deploy-digitalocean.sh
```

### 4. Database Setup (1 minute)

```bash
# Create database
mysql -u root -p
```

```sql
CREATE DATABASE kaamkart CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'kaamkart_user'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON kaamkart.* TO 'kaamkart_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
# Import schema
mysql -u kaamkart_user -p kaamkart < kaamkartApi/kaamkart-database.sql
```

### 5. Configure & Deploy (1 minute)

```bash
# Edit systemd service with your credentials
nano /etc/systemd/system/kaamkart-api.service
# Update: DB_PASSWORD, JWT_SECRET

# Configure frontend
cd /opt/kaamkart/kaamkartUI
cp .env.production.example .env.production
nano .env.production
# Set: NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api

# Deploy
cd /opt/kaamkart/kaamkartApi && ./deploy.sh
cd /opt/kaamkart/kaamkartUI && ./deploy.sh
```

### 6. DNS & SSL (1 minute)

1. **Configure DNS** (in your domain registrar):
   ```
   A: @ → YOUR_DROPLET_IP
   A: www → YOUR_DROPLET_IP
   A: api → YOUR_DROPLET_IP
   ```

2. **Get SSL** (wait 5-10 min for DNS propagation):
   ```bash
   sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in
   ```

## ✅ Verify

```bash
# Check health
curl https://api.kaamkart.in/api/health

# Visit site
# https://kaamkart.in
```

## 🎉 Done!

Your application is now live at:
- **Frontend**: https://kaamkart.in
- **API**: https://api.kaamkart.in

## 📊 Monitoring

DigitalOcean provides built-in monitoring:
- View in Droplet → Monitoring tab
- Set up alerts for CPU, Memory, Disk

## 🔄 Updates

```bash
cd /opt/kaamkart
git pull origin main
./scripts/update.sh
```

## 💰 Cost

- Droplet: $12/month
- Domain: $10-15/year
- **Total: ~$12-15/month**

---

**Need help?** See [DEPLOY_DIGITALOCEAN.md](./DEPLOY_DIGITALOCEAN.md) for detailed guide.

