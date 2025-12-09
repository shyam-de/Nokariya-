# KaamKart API - Spring Boot

Spring Boot REST API for the KaamKart platform.

## Prerequisites

- Java 17 or higher
- Maven 3.6+
- MySQL 8.0+

## Setup Instructions

### 1. Install MySQL

Make sure MySQL is installed and running on your system.

### 2. Create Database

Run the SQL script to create the database:
```bash
mysql -u root -p < src/main/resources/db/schema.sql
```

Or manually create the database:
```sql
CREATE DATABASE kaamkart;
```

### 3. Configure Application

Update `src/main/resources/application.properties` with your MySQL credentials:

```properties
spring.datasource.username=root
spring.datasource.password=your_password
```

### 4. Build and Run

```bash
# Build the project
mvn clean install

# Run the application
mvn spring-boot:run
```

Or use your IDE to run `KaamKartApplication.java`

The server will start on `http://localhost:5000`

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

The application uses JPA/Hibernate with automatic schema generation. The schema is defined in:
- `src/main/resources/db/schema.sql` - Manual SQL script
- Entity classes in `com.kaamkart.model` package

## Technologies

- Spring Boot 3.2.0
- Spring Data JPA
- MySQL
- WebSocket (STOMP)
- JWT Authentication
- Spring Security

