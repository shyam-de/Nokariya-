# Run KaamKart Locally on localhost

Simple guide to run the application on your local machine.

## Quick Start

```bash
./start-local.sh
```

That's it! The script will:
1. ✅ Start MySQL (if not running)
2. ✅ Build and start backend on `http://localhost:8585`
3. ✅ Start frontend on `http://localhost:3000`
4. ✅ Configure everything to use localhost

## Access Your Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8585/api
- **Health Check**: http://localhost:8585/api/health

## Prerequisites

Make sure you have:
- ✅ Java 17 installed
- ✅ Node.js 18+ installed
- ✅ MySQL running
- ✅ Maven installed

## Manual Start (Alternative)

### Backend:
```bash
cd kaamkartApi
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```

### Frontend (in another terminal):
```bash
cd kaamkartUI
npm run dev
```

## Stop Application

```bash
# Stop backend
pkill -f KaamKartApplication

# Stop frontend
pkill -f "next dev"
```

Or use Ctrl+C in the terminal where they're running.

## View Logs

```bash
# Backend logs
tail -f backend.log

# Frontend logs
tail -f frontend.log
```

## Default Login

- **Email**: `superadmin@kaamkart.in`
- **Password**: `Ankit@805204`

## Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports
lsof -ti:8585 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### MySQL Not Running
```bash
brew services start mysql
```

### Backend Not Starting
Check `backend.log` for errors:
```bash
tail -50 backend.log
```

### Frontend Not Starting
Check `frontend.log` for errors:
```bash
tail -50 frontend.log
```

## Configuration

- Backend runs on: `http://localhost:8585`
- Frontend runs on: `http://localhost:3000`
- Frontend API URL: `http://localhost:8585/api` (set in `.env.local`)

All configured automatically by `start-local.sh`!

