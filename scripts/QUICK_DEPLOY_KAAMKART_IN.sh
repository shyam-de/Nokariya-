#!/bin/bash

# Quick Deploy Script for kaamkart.in
# Run this on your production server

set -e

echo "🚀 Deploying KaamKart to kaamkart.in..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root or with sudo"
    exit 1
fi

APP_DIR="/opt/kaamkart"
API_DIR="/opt/kaamkart-api"
UI_DIR="/opt/kaamkart-ui"

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
apt update
apt install -y openjdk-17-jdk maven nginx certbot python3-certbot-nginx git mysql-server curl

# Step 2: Setup directories
echo "📁 Creating directories..."
mkdir -p $APP_DIR $API_DIR/logs $UI_DIR
chown -R www-data:www-data $API_DIR $UI_DIR

# Step 3: Clone/Update code
if [ ! -d "$APP_DIR/.git" ]; then
    echo "📥 Cloning repository..."
    cd /opt
    git clone https://github.com/YOUR_USERNAME/nokariya.git kaamkart || echo "⚠️  Please upload code manually to $APP_DIR"
else
    echo "🔄 Updating code..."
    cd $APP_DIR
    git pull || echo "⚠️  Could not pull, using existing code"
fi

# Step 4: Setup Database
echo "🗄️  Setting up database..."
if [ ! -f /root/.db_setup_done ]; then
    read -sp "Enter MySQL root password: " MYSQL_ROOT_PASS
    echo ""
    mysql -u root -p$MYSQL_ROOT_PASS < $APP_DIR/kaamkartApi/kaamkart-database.sql
    touch /root/.db_setup_done
fi

# Step 5: Build Backend
echo "🔨 Building backend..."
cd $APP_DIR/kaamkartApi
mvn clean package -DskipTests
cp target/kaamkart-*.jar $API_DIR/kaamkart-api.jar
chown www-data:www-data $API_DIR/kaamkart-api.jar

# Step 6: Configure Backend Service
echo "⚙️  Configuring backend service..."
cat > /etc/systemd/system/kaamkart-api.service << 'EOF'
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
Environment="SPRING_PROFILES_ACTIVE=prod"
Environment="DB_URL=jdbc:mysql://localhost:3306/kaamkart?useSSL=false&serverTimezone=UTC"
Environment="DB_USERNAME=root"
Environment="DB_PASSWORD=CHANGE_ME"
Environment="JWT_SECRET=$(openssl rand -base64 32)"
Environment="CORS_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in"
Environment="WEBSOCKET_ALLOWED_ORIGINS=https://kaamkart.in,https://www.kaamkart.in"

[Install]
WantedBy=multi-user.target
EOF

echo "⚠️  IMPORTANT: Edit /etc/systemd/system/kaamkart-api.service and set DB_PASSWORD"
systemctl daemon-reload
systemctl enable kaamkart-api

# Step 7: Build Frontend
echo "🎨 Building frontend..."
cd $APP_DIR/kaamkartUI
npm install
echo "NEXT_PUBLIC_API_URL=https://api.kaamkart.in/api" > .env.production
npm run build
cp -r .next $UI_DIR/
cp package.json $UI_DIR/
cp next.config.js $UI_DIR/
chown -R www-data:www-data $UI_DIR

# Step 8: Setup Frontend with PM2
echo "🚀 Setting up frontend..."
npm install -g pm2
cd $UI_DIR
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
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Step 9: Configure Nginx
echo "🌐 Configuring Nginx..."
cp $APP_DIR/config/nginx/kaamkart.in.conf /etc/nginx/sites-available/kaamkart.in
ln -sf /etc/nginx/sites-available/kaamkart.in /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Temporarily comment SSL for initial setup
sed -i 's/listen 443/listen 80 #listen 443/' /etc/nginx/sites-available/kaamkart.in
sed -i 's/# Redirect HTTP to HTTPS/# Redirect HTTP to HTTPS\n    # return 301 https:\/\/$server_name$request_uri;/' /etc/nginx/sites-available/kaamkart.in

nginx -t && systemctl reload nginx

# Step 10: Setup SSL
echo "🔒 Setting up SSL certificates..."
echo "⚠️  Make sure DNS is pointing to this server!"
read -p "Press Enter to continue with SSL setup..."
certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in --non-interactive --agree-tos --email admin@kaamkart.in || echo "⚠️  SSL setup failed. Run manually: certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in"

# Step 11: Start Services
echo "▶️  Starting services..."
systemctl start kaamkart-api
systemctl status kaamkart-api --no-pager

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit /etc/systemd/system/kaamkart-api.service and set DB_PASSWORD"
echo "2. Restart backend: systemctl restart kaamkart-api"
echo "3. Check status: systemctl status kaamkart-api"
echo "4. Test: https://kaamkart.in"
echo ""
echo "🔍 Check logs:"
echo "  Backend: journalctl -u kaamkart-api -f"
echo "  Frontend: pm2 logs kaamkart-ui"
echo "  Nginx: tail -f /var/log/nginx/error.log"

