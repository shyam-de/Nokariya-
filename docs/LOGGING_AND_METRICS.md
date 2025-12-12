# KaamKart Logging & Metrics Documentation

## Overview

The application now includes comprehensive logging and metrics tracking to monitor all API requests, responses, errors, and performance metrics. All data is stored in the database for analysis and troubleshooting.

## Features

### 1. Request/Response Logging (Optimized)
- **Automatic logging** of all API requests and responses
- **Database storage** in `api_logs` table
- **Essential fields always logged**: endpoint, method, user ID, IP address, status code, response time
- **Conditional logging**:
  - **Request/Response bodies**: Only logged for errors (status >= 400) or critical endpoints (login, request creation)
  - **User agent**: Only logged for errors (security monitoring)
  - **Stack traces**: Only logged for errors
- **Error tracking**: Full error details for failed requests

### 2. Enhanced Controller Logging
- **Login operations**: Track login attempts, successes, and failures
- **Request creation**: Log all request creation attempts
- **Request confirmation**: Track worker confirmations
- **Admin approvals/rejections**: Monitor admin actions
- **Performance metrics**: Response time tracking for all operations

### 3. Metrics Service
- **Error tracking**: Count errors by endpoint
- **Performance metrics**: Average response times
- **Endpoint statistics**: Request counts and performance by endpoint
- **Error rate calculation**: Overall error rate monitoring

### 4. Metrics API Endpoints

All metrics endpoints require **ADMIN** role:

#### Get Metrics Summary
```
GET /api/admin/metrics/summary?hours=24
```
Returns comprehensive metrics for the last N hours (default 24).

#### Get Recent Errors
```
GET /api/admin/metrics/errors?limit=50
```
Returns the most recent errors (default 50).

#### Get API Logs
```
GET /api/admin/metrics/logs?page=0&size=50&endpoint=/api/auth/login&statusCode=400&userId=1
```
Get paginated API logs with optional filters:
- `endpoint`: Filter by endpoint
- `statusCode`: Filter by status code
- `userId`: Filter by user ID

#### Get Endpoint Statistics
```
GET /api/admin/metrics/endpoints?hours=24
```
Get statistics for all endpoints in the last N hours.

## Database Schema

### api_logs Table

```sql
CREATE TABLE api_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    endpoint VARCHAR(500) NOT NULL,
    method VARCHAR(10) NOT NULL,
    user_id BIGINT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    request_body TEXT,
    response_body TEXT,
    status_code INT NOT NULL,
    response_time_ms BIGINT,
    error_message TEXT,
    error_stack_trace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Indexes for fast queries
    INDEX idx_api_logs_endpoint (endpoint(255)),
    INDEX idx_api_logs_method (method),
    INDEX idx_api_logs_status (status_code),
    INDEX idx_api_logs_user_id (user_id),
    INDEX idx_api_logs_created_at (created_at DESC),
    INDEX idx_api_logs_endpoint_status (endpoint(255), status_code),
    INDEX idx_api_logs_user_created (user_id, created_at DESC)
);
```

## Logging Format

### Console Logs

#### Login Operations
```
🔐 LOGIN ATTEMPT | Email: user@example.com | Timestamp: 1234567890
✅ LOGIN SUCCESS | Email: user@example.com | Role: CUSTOMER | Duration: 45ms
❌ LOGIN FAILED | Email: user@example.com | Error: Invalid credentials | Duration: 12ms
```

#### Request Operations
```
📝 CREATE REQUEST | User: 123 | WorkerTypes: 2 | WorkType: CONSTRUCTION | StartDate: 2024-01-01
✅ REQUEST CREATED | RequestID: 456 | User: 123 | Duration: 234ms
❌ REQUEST CREATION FAILED | User: 123 | Error: Validation failed | Duration: 45ms
```

#### Confirmation Operations
```
✅ CONFIRM REQUEST | RequestID: 456 | User: 789 | Timestamp: 1234567890
✅ REQUEST CONFIRMED | RequestID: 456 | User: 789 | Duration: 123ms
❌ REQUEST CONFIRMATION FAILED | RequestID: 456 | User: 789 | Error: Request not found | Duration: 12ms
```

#### Admin Operations
```
✅ APPROVE REQUEST | RequestID: 456 | Admin: 1 | Timestamp: 1234567890
✅ REQUEST APPROVED | RequestID: 456 | Admin: 1 | Duration: 234ms
❌ REQUEST APPROVAL FAILED | RequestID: 456 | Error: Invalid status | Duration: 45ms
```

### API Request Logs
```
API Request: POST /api/auth/login | Status: 200 | Time: 45ms | User: 123 | IP: 192.168.1.1
API Error: POST /api/requests | Status: 400 | Error: Validation failed
```

## Usage Examples

### View Recent Errors
```bash
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:8585/api/admin/metrics/errors?limit=10
```

### Get Metrics Summary
```bash
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:8585/api/admin/metrics/summary?hours=24
```

### Query API Logs
```bash
# Get all logs for a specific endpoint
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8585/api/admin/metrics/logs?endpoint=/api/auth/login&page=0&size=50"

# Get all errors (status >= 400)
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8585/api/admin/metrics/logs?statusCode=400&page=0&size=50"

# Get logs for a specific user
curl -H "Authorization: Bearer <admin_token>" \
  "http://localhost:8585/api/admin/metrics/logs?userId=123&page=0&size=50"
```

## Performance Considerations

1. **Asynchronous Logging**: API logs are saved asynchronously to avoid blocking requests
2. **Conditional Body Logging**: Request/response bodies only logged for errors or critical operations (reduces database size)
3. **Body Size Limits**: Request/response bodies are truncated to 2000 characters (reduced from 5000)
4. **Stack Trace Limits**: Stack traces are truncated to 10000 characters (only for errors)
5. **Indexes**: All query fields are indexed for fast retrieval
6. **Health Check Exclusion**: Health check endpoints are excluded from logging
7. **Minimal Logging**: Only essential fields logged for successful requests to reduce storage

## Monitoring Recommendations

1. **Regular Cleanup**: Archive old logs periodically (e.g., older than 90 days)
2. **Error Alerts**: Set up alerts for high error rates
3. **Performance Monitoring**: Track average response times for critical endpoints
4. **User Activity**: Monitor user-specific logs for suspicious activity
5. **Endpoint Analysis**: Use endpoint statistics to identify slow endpoints

## Database Maintenance

### Archive Old Logs
```sql
-- Create archive table
CREATE TABLE api_logs_archive LIKE api_logs;

-- Move old logs (older than 90 days)
INSERT INTO api_logs_archive 
SELECT * FROM api_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);

-- Delete archived logs
DELETE FROM api_logs 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
```

### Query Examples

#### Get error rate for last 24 hours
```sql
SELECT 
    COUNT(*) as total_requests,
    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors,
    (SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as error_rate
FROM api_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
```

#### Get slowest endpoints
```sql
SELECT 
    endpoint,
    COUNT(*) as request_count,
    AVG(response_time_ms) as avg_response_time,
    MAX(response_time_ms) as max_response_time
FROM api_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY endpoint
ORDER BY avg_response_time DESC
LIMIT 10;
```

#### Get user activity
```sql
SELECT 
    user_id,
    COUNT(*) as request_count,
    SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_count
FROM api_logs
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
  AND user_id IS NOT NULL
GROUP BY user_id
ORDER BY request_count DESC
LIMIT 20;
```

## Security Notes

- **Sensitive Data**: Request/response bodies may contain sensitive information (passwords, tokens). Consider masking sensitive fields.
- **Access Control**: Metrics endpoints require ADMIN role
- **IP Tracking**: IP addresses are logged for security monitoring
- **User Tracking**: User IDs are logged for audit trails

