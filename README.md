# KaamKart - Labor Worker Platform

A platform connecting labor workers (electricians, plumbers, carpenters, etc.) with customers who need their services.

## 🌐 Production Deployment

**Live Site**: [https://nokariya.onrender.com](https://nokariya.onrender.com)  
**API**: [https://nokariya-zo4u.onrender.com](https://nokariya-zo4u.onrender.com)

## 🚀 Deploy on Render

Deploy KaamKart easily on Render platform. See [docs/RENDER_DEPLOYMENT.md](./docs/RENDER_DEPLOYMENT.md) for detailed instructions.

### Quick Deploy

1. **Push your code to GitHub**
2. **Connect to Render** and use the `render.yaml` blueprint
3. **Configure environment variables** in Render dashboard
4. **Deploy!**

For step-by-step instructions, see [docs/RENDER_DEPLOYMENT.md](./docs/RENDER_DEPLOYMENT.md).

## Features

- **User Registration & Authentication**: Separate registration for customers and workers
- **Request Creation**: Customers can create requests specifying labor types, work details, and location
- **Location-Based Matching**: System finds nearest available workers
- **Real-time Notifications**: Workers receive instant notifications via WebSocket
- **Worker Confirmation**: Workers can confirm availability for requests
- **Admin Dashboard**: Super admins can manage requests, users, success stories, and advertisements
- **Success Stories & Advertisements**: Dynamic content management for homepage
- **Password Reset**: Forgot password and reset password functionality
- **API Logging & Metrics**: Comprehensive logging and monitoring

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

## Quick Start (Local Development)

```bash
./scripts/start-local.sh
```

This will start:
- Backend on `http://localhost:8585`
- Frontend on `http://localhost:3000`

See [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md) for details.

## Project Structure

```
kaamkart/
├── kaamkartUI/              # Next.js frontend (UI)
│   ├── app/                # Next.js app directory
│   └── Dockerfile          # Frontend Docker image
├── kaamkartApi/            # Spring Boot backend (API)
│   ├── src/
│   ├── Dockerfile         # Backend Docker image
│   └── kaamkart-database.sql  # Database schema
├── docs/                   # Documentation
│   ├── RENDER_DEPLOYMENT.md  # Render deployment guide
│   ├── LOCAL_SETUP.md     # Local development setup
│   └── LOGGING_AND_METRICS.md  # Logging documentation
├── scripts/                # Utility scripts
│   └── start-local.sh     # Start local development
└── render.yaml            # Render deployment configuration
```

## API Endpoints

### Public Endpoints
- `GET /api/public/success-stories` - Get active success stories
- `GET /api/public/advertisements` - Get active advertisements
- `GET /api/health` - Health check

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

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
- `GET /api/admin/metrics/summary` - Get application metrics
- `GET /api/admin/metrics/errors` - Get error statistics
- `GET /api/admin/metrics/logs` - Get API logs

## Database

The database schema is optimized for millions of users with comprehensive indexing. See:
- `kaamkartApi/kaamkart-database.sql` - Complete database setup

## Environment Variables

### Backend (Render)

| Variable | Description | Required |
|----------|-------------|----------|
| `SPRING_PROFILES_ACTIVE` | Spring profile | Yes (set to `prod`) |
| `SPRING_DATASOURCE_URL` | Database connection URL | Yes |
| `SPRING_DATASOURCE_USERNAME` | Database username | Yes |
| `SPRING_DATASOURCE_PASSWORD` | Database password | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `PORT` | Server port | Yes (8585) |

### Frontend (Render)

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Node environment | Yes (set to `production`) |
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `PORT` | Server port | Yes (3000) |

## Monitoring

- Health Check: `https://your-api-url.onrender.com/api/health`
- Metrics: `https://your-api-url.onrender.com/api/admin/metrics/summary` (admin only)
- View logs in Render dashboard

## Security

- JWT authentication
- BCrypt password hashing
- CORS protection
- SSL/TLS encryption (automatic on Render)
- Security headers
- SQL injection protection (JPA)
- XSS protection

## License

ISC

## Support

For deployment issues:
- Render: See [docs/RENDER_DEPLOYMENT.md](./docs/RENDER_DEPLOYMENT.md)
- Local Development: See [docs/LOCAL_SETUP.md](./docs/LOCAL_SETUP.md)
- Logging & Metrics: See [docs/LOGGING_AND_METRICS.md](./docs/LOGGING_AND_METRICS.md)
