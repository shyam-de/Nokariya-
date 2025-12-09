# KaamKart - Labor Worker Platform

A platform connecting labor workers (electricians, skilled, and unskilled laborers) with end users who need their services.

## Features

- **User Registration & Authentication**: Separate registration for customers and workers
- **Request Creation**: Customers can create requests specifying:
  - Type of labor needed (electrician, skilled, unskilled)
  - Type of work
  - Number of workers required
  - Location
- **Location-Based Matching**: System finds nearest available workers
- **Real-time Notifications**: Workers receive instant notifications for new requests via WebSocket
- **Worker Confirmation**: Workers can confirm availability for requests
- **Automatic Deployment**: System automatically deploys workers once enough confirmations are received

## Tech Stack

### Frontend
- Next.js 14 (React)
- TypeScript
- Tailwind CSS
- WebSocket Client (SockJS/STOMP)
- Axios

### Backend
- Java 17
- Spring Boot 3.2.0
- Spring Data JPA
- MySQL 8.0+
- WebSocket (STOMP)
- JWT Authentication
- Spring Security

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher) - for frontend
- Java 17 or higher - for backend
- Maven 3.6+ - for backend
- MySQL 8.0+ - for database

### Backend Setup

1. **Install MySQL** and make sure it's running

2. **Create Database**:
   ```bash
   mysql -u root -p < kaamkartApi/src/main/resources/db/schema.sql
   ```
   Or manually:
   ```sql
   CREATE DATABASE kaamkart;
   ```

3. **Configure Database**:
   Edit `kaamkartApi/src/main/resources/application.properties`:
   ```properties
   spring.datasource.username=root
   spring.datasource.password=your_mysql_password
   ```

4. **Build and Run Backend**:
   ```bash
   cd kaamkartApi
   mvn clean install
   mvn spring-boot:run
   ```
   Backend will start on `http://localhost:5000`

### Frontend Setup

1. **Install Dependencies**:
   ```bash
   cd kaamkartUI
   npm install
   ```

2. **Configure Environment** (optional):
   Create `kaamkartUI/.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
   ```

3. **Run Frontend**:
   ```bash
   cd kaamkartUI
   npm run dev
   ```
   Frontend will start on `http://localhost:3000`

## Usage

### For Customers:
1. Register/Login as a customer
2. Create a request specifying:
   - Labor type (electrician, skilled, unskilled)
   - Work type description
   - Number of workers needed
   - Location
3. System automatically notifies nearby workers
4. View confirmed and deployed workers

### For Workers:
1. Register/Login as a worker (select labor types during registration)
2. Set availability status
3. Receive real-time notifications for nearby requests
4. Confirm requests you're available for
5. Get deployed once customer has enough confirmations

## Project Structure

```
kaamkart/
├── kaamkartUI/         # Next.js frontend
│   ├── app/            # Next.js app directory
│   └── ...
├── kaamkartApi/        # Spring Boot backend
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/com/kaamkart/
│   │   │   │   ├── model/      # JPA entities
│   │   │   │   ├── repository/ # Data repositories
│   │   │   │   ├── service/    # Business logic
│   │   │   │   ├── controller/ # REST controllers
│   │   │   │   ├── config/     # Configuration
│   │   │   │   └── dto/        # Data transfer objects
│   │   │   └── resources/
│   │   │       ├── application.properties
│   │   │       └── db/schema.sql
│   └── pom.xml
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Requests
- `POST /api/requests` - Create new request
- `GET /api/requests/my-requests` - Get customer's requests
- `GET /api/requests/available` - Get available requests (for workers)
- `POST /api/requests/{id}/confirm` - Confirm request (worker)
- `POST /api/requests/{id}/complete` - Complete request

### Workers
- `GET /api/workers/profile` - Get worker profile
- `PUT /api/workers/location` - Update worker location
- `PUT /api/workers/availability` - Update availability

## WebSocket

WebSocket endpoint: `ws://localhost:5000/ws`

Topics:
- `/topic/worker/{workerId}` - Worker notifications
- `/topic/customer/{customerId}` - Customer notifications

## Database Schema

The database schema is automatically created by Hibernate on first run, or you can manually run:
- `kaamkartApi/src/main/resources/db/schema.sql`

Main tables:
- `users` - User accounts (customers and workers)
- `workers` - Worker profiles
- `requests` - Customer requests
- `confirmed_workers` - Worker confirmations
- `deployed_workers` - Deployed workers

## License

ISC
