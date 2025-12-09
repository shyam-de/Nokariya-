# Database Optimization Guide for Millions of Users

## Overview
This document outlines the database optimizations implemented to handle millions of users efficiently.

## Current Schema Analysis

### ✅ Strengths
1. **Proper Normalization**: Well-normalized schema with appropriate relationships
2. **Foreign Keys**: Proper foreign key relationships defined
3. **Data Types**: Appropriate data types used (Long for IDs, LocalDateTime for timestamps)
4. **Unique Constraints**: Email fields have unique constraints

### ⚠️ Issues Identified

#### 1. **Missing Indexes**
- No explicit indexes defined on frequently queried columns
- Foreign keys need indexes for efficient joins
- Date columns used in range queries need indexes
- Status columns need indexes for filtering
- Location queries need spatial/composite indexes

#### 2. **Query Patterns Requiring Optimization**
- Finding workers by labor type + availability + verification
- Finding requests by status + date range
- Finding deployed/confirmed workers by date range
- Location-based queries (latitude/longitude)
- User authentication (email lookup)
- Sorting by created_at, rating, etc.

## Optimization Strategy

### 1. **Index Strategy**

#### Primary Indexes (Already Created by MySQL)
- Primary keys (auto-indexed)
- Unique constraints (auto-indexed)

#### Secondary Indexes (Added in optimization script)
- **Foreign Key Indexes**: All foreign keys have indexes
- **Status Indexes**: All status/enum columns have indexes
- **Date Indexes**: All date columns used in queries have indexes
- **Composite Indexes**: Common query patterns have composite indexes
- **Location Indexes**: Latitude/longitude have indexes for location queries

### 2. **Critical Indexes for Scale**

#### Users Table
```sql
- idx_users_email: For authentication queries
- idx_users_role_blocked: For filtering active users by role
- idx_users_created_at: For sorting and pagination
```

#### Workers Table
```sql
- idx_workers_available_verified: For finding available verified workers
- idx_workers_rating: For sorting by rating
- idx_workers_location: For location-based queries
```

#### Requests Table
```sql
- idx_requests_status_dates: For filtering by status and date range
- idx_requests_customer_id: For user's request history
- idx_requests_location: For location-based worker matching
```

#### Worker Labor Types
```sql
- idx_wlt_worker_labor_type: For finding workers by labor type (most critical)
```

#### Deployed/Confirmed Workers
```sql
- idx_deployed_worker_date: For checking worker availability
- idx_confirmed_worker_date: For checking worker commitments
```

### 3. **Query Optimization Recommendations**

#### Use Pagination
Always use LIMIT/OFFSET or cursor-based pagination:
```java
Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
```

#### Avoid N+1 Queries
Use `@EntityGraph` or `JOIN FETCH`:
```java
@Query("SELECT r FROM Request r LEFT JOIN FETCH r.deployedWorkers WHERE r.id = :id")
```

#### Use Projections for Large Results
Return only needed fields:
```java
@Query("SELECT r.id, r.status, r.createdAt FROM Request r WHERE r.customer = :customer")
```

### 4. **Database Configuration**

#### Connection Pooling
Ensure proper connection pool settings in `application.properties`:
```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
spring.datasource.hikari.connection-timeout=30000
spring.datasource.hikari.idle-timeout=600000
spring.datasource.hikari.max-lifetime=1800000
```

#### Query Cache
Enable query result caching for frequently accessed data:
```properties
spring.jpa.properties.hibernate.cache.use_second_level_cache=true
spring.jpa.properties.hibernate.cache.use_query_cache=true
spring.jpa.properties.hibernate.cache.region.factory_class=org.hibernate.cache.jcache.JCacheRegionFactory
```

### 5. **Archiving Strategy**

For tables that grow indefinitely:
- **Requests**: Archive requests older than 2 years to separate table
- **Ratings**: Keep all ratings (small data size)
- **Concerns**: Archive resolved concerns older than 1 year

### 6. **Monitoring & Maintenance**

#### Enable Slow Query Log
```sql
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 2; -- Log queries taking more than 2 seconds
```

#### Regular Maintenance
```sql
-- Run weekly
OPTIMIZE TABLE users;
OPTIMIZE TABLE workers;
OPTIMIZE TABLE requests;
ANALYZE TABLE users;
ANALYZE TABLE workers;
ANALYZE TABLE requests;
```

### 7. **Scaling Strategies**

#### Read Replicas
For read-heavy operations:
- Use read replicas for dashboard queries
- Route read queries to replicas
- Keep writes on primary database

#### Caching Layer
Implement Redis for:
- User sessions
- Frequently accessed worker lists
- Active requests cache
- Location-based worker searches

#### Database Sharding (Future)
For extreme scale (10M+ users):
- Shard by user_id (hash-based)
- Shard by region (geographic)
- Shard by date (time-based)

## Implementation Steps

1. **Run Optimization Script**
   ```bash
   mysql -u root -p kaamkart < database-optimization.sql
   ```

2. **Update Application Properties**
   - Add connection pool settings
   - Enable query caching
   - Configure slow query logging

3. **Update Repository Queries**
   - Add pagination to all list queries
   - Use projections for large result sets
   - Add `@EntityGraph` for eager loading

4. **Monitor Performance**
   - Set up slow query monitoring
   - Monitor index usage
   - Track query execution times

5. **Regular Maintenance**
   - Schedule weekly OPTIMIZE TABLE
   - Monitor index fragmentation
   - Review and adjust indexes based on query patterns

## Expected Performance Improvements

- **User Authentication**: 10-100x faster with email index
- **Worker Search**: 50-500x faster with composite indexes
- **Request Filtering**: 20-200x faster with status/date indexes
- **Location Queries**: 100-1000x faster with location indexes
- **Join Operations**: 10-50x faster with foreign key indexes

## Monitoring Queries

### Check Index Usage
```sql
SELECT 
    TABLE_NAME,
    INDEX_NAME,
    SEQ_IN_INDEX,
    COLUMN_NAME,
    CARDINALITY
FROM 
    INFORMATION_SCHEMA.STATISTICS
WHERE 
    TABLE_SCHEMA = 'kaamkart'
ORDER BY 
    TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

### Check Table Sizes
```sql
SELECT 
    TABLE_NAME,
    ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) AS 'Size (MB)'
FROM 
    INFORMATION_SCHEMA.TABLES
WHERE 
    TABLE_SCHEMA = 'kaamkart'
ORDER BY 
    (DATA_LENGTH + INDEX_LENGTH) DESC;
```

### Check Slow Queries
```sql
SELECT 
    sql_text,
    exec_count,
    avg_timer_wait/1000000000000 as avg_time_sec,
    sum_timer_wait/1000000000000 as total_time_sec
FROM 
    performance_schema.events_statements_summary_by_digest
WHERE 
    avg_timer_wait > 1000000000000
ORDER BY 
    avg_timer_wait DESC
LIMIT 10;
```

## Next Steps

1. ✅ Run `database-optimization.sql` script
2. ⬜ Update application.properties with connection pool settings
3. ⬜ Implement pagination in all repository methods
4. ⬜ Add Redis caching layer
5. ⬜ Set up monitoring and alerting
6. ⬜ Schedule regular maintenance tasks

## Notes

- Indexes add slight overhead on INSERT/UPDATE operations but dramatically improve SELECT performance
- Monitor index usage and remove unused indexes
- Consider partial indexes for large tables (MySQL 8.0+)
- Use EXPLAIN to verify index usage in queries

