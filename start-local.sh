#!/bin/bash

# Start KaamKart Application Locally on localhost

echo "🚀 Starting KaamKart Local Development Server..."
echo ""

# Set Java 17
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"

# Check if MySQL is running
if ! pgrep -x "mysqld" > /dev/null; then
    echo "⚠️  Starting MySQL..."
    brew services start mysql
    sleep 3
fi

# Stop existing processes
echo "Stopping existing processes..."
pkill -f "KaamKartApplication" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# Start backend
echo "📦 Starting Backend..."
cd kaamkartApi

# Build if needed
if [ ! -f target/kaamkart-api-1.0.0.jar ]; then
    echo "Building backend..."
    mvn clean package -DskipTests -q
fi

# Start backend in background
java -jar target/kaamkart-api-1.0.0.jar --spring.profiles.active=dev > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"
cd ..

# Wait for backend to start
echo "Waiting for backend to start..."
sleep 8

# Check backend health
if curl -s http://localhost:8585/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
else
    echo "⚠️  Backend might still be starting..."
fi

# Start frontend
echo ""
echo "🎨 Starting Frontend..."
cd kaamkartUI

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Ensure .env.local uses localhost
if [ ! -f .env.local ] || ! grep -q "localhost" .env.local; then
    echo "NEXT_PUBLIC_API_URL=http://localhost:8585/api" > .env.local
    echo "✅ Created/Updated .env.local with localhost API URL"
fi

# Start frontend in background
PORT=3000 npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"
cd ..

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ KaamKart is running locally!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:8585/api"
echo "❤️  Health:   http://localhost:8585/api/health"
echo ""
echo "📋 View logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop:"
echo "   pkill -f KaamKartApplication"
echo "   pkill -f 'next dev'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

