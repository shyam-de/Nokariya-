# KaamKart - Labor Worker Platform

A platform connecting labor workers (electricians, plumbers, carpenters, etc.) with customers who need their services.

## 🌐 Production Deployment

**Live Site**: [kaamkart.in](https://kaamkart.in)  
**API**: [api.kaamkart.in](https://api.kaamkart.in)

## Features

- **User Registration & Authentication**: Separate registration for customers and workers
- **Request Creation**: Customers can create requests specifying labor types, work details, and location
- **Location-Based Matching**: System finds nearest available workers
- **Real-time Notifications**: Workers receive instant notifications via WebSocket
- **Worker Confirmation**: Workers can confirm availability for requests
- **Admin Dashboard**: Super admins can manage requests, users, success stories, and advertisements
- **Success Stories & Advertisements**: Dynamic content management for homepage

## Tech Stack

### Frontend
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- WebSocket Client (Socket.io)
- Axios

### Backend
- Java 17
- Spring Boot 3.2.0
- Spring Data JPA
- MySQL 8.0+
- WebSocket (STOMP)
- JWT Authentication
- Spring Security

## Quick Start (Development)

### Prerequisites
- Node.js 18+
- Java 17+
- Maven 3.6+
- MySQL 8.0+

### Backend Setup

```bash
cd kaamkartApi

# Create database
mysql -u root -p < kaamkart-database.sql

# Update application-dev.properties with your database credentials

# Run application
mvn spring-boot:run
```

Backend runs on `http://localhost:8585`

### Frontend Setup

```bash
cd kaamkartUI

# Install dependencies
npm install

# Run development server
npm run dev
```

Frontend runs on `http://localhost:3000`

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete production deployment guide.

### Quick Deployment Steps

1. **Server Setup**
   ```bash
   sudo bash scripts/setup-server.sh
   ```

2. **Database Setup**
   ```bash
   mysql -u root -p < kaamkartApi/kaamkart-database.sql
   ```

3. **Configure Environment**
   - Backend: Edit `/etc/systemd/system/kaamkart-api.service`
   - Frontend: Create `.env.production` in `kaamkartUI/`

4. **Deploy**
   ```bash
   cd kaamkartApi && ./deploy.sh
   cd ../kaamkartUI && ./deploy.sh
   ```

5. **SSL Certificates**
   ```bash
   sudo certbot --nginx -d kaamkart.in -d www.kaamkart.in -d api.kaamkart.in
   ```

## Docker Deployment

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Project Structure

```
kaamkart/
├── kaamkartUI/              # Next.js frontend
│   ├── app/                # Next.js app directory
│   ├── Dockerfile          # Frontend Docker image
│   └── deploy.sh          # Frontend deployment script
├── kaamkartApi/            # Spring Boot backend
│   ├── src/
│   ├── Dockerfile         # Backend Docker image
│   ├── deploy.sh         # Backend deployment script
│   └── kaamkart-api.service  # Systemd service file
├── nginx/                  # Nginx configurations
│   └── kaamkart.in.conf  # Production Nginx config
├── scripts/                # Deployment scripts
│   ├── setup-server.sh    # Initial server setup
│   └── backup-database.sh # Database backup script
├── docker-compose.yml     # Docker Compose configuration
└── DEPLOYMENT.md          # Complete deployment guide
```

## API Endpoints

### Public Endpoints
- `GET /api/public/success-stories` - Get active success stories
- `GET /api/public/advertisements` - Get active advertisements
- `GET /api/health` - Health check

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Requests
- `POST /api/requests` - Create new request
- `GET /api/requests/my-requests` - Get customer's requests
- `GET /api/requests/available` - Get available requests (for workers)
- `POST /api/requests/{id}/confirm` - Confirm request (worker)
- `POST /api/requests/{id}/complete` - Complete request

### Admin
- `GET /api/admin/requests/pending` - Get pending requests
- `POST /api/admin/requests/{id}/approve` - Approve request
- `POST /api/admin/requests/{id}/deploy` - Deploy workers

## Database

The database schema is optimized for millions of users with comprehensive indexing. See:
- `kaamkartApi/kaamkart-database.sql` - Complete database setup
- `kaamkartApi/DATABASE_OPTIMIZATION.md` - Optimization details
- `kaamkartApi/SCALABILITY_SUMMARY.md` - Scalability guide

## Environment Variables

### Backend
See `kaamkartApi/.env.production.example`

### Frontend
See `kaamkartUI/.env.production.example`

## Monitoring

- Health Check: `https://api.kaamkart.in/api/health`
- Readiness: `https://api.kaamkart.in/api/health/ready`
- Liveness: `https://api.kaamkart.in/api/health/live`

## Backup

Database backups are automated via cron:
```bash
# Manual backup
./scripts/backup-database.sh

# Automated (add to crontab)
0 2 * * * /path/to/backup-database.sh
```

## Security

- JWT authentication
- BCrypt password hashing
- CORS protection
- Rate limiting (Nginx)
- SSL/TLS encryption
- Security headers
- SQL injection protection (JPA)
- XSS protection

## License

ISC

## Support

For deployment issues, see [DEPLOYMENT.md](./DEPLOYMENT.md) or check logs:
- Backend: `sudo journalctl -u kaamkart-api -f`
- Nginx: `sudo tail -f /var/log/nginx/error.log`
