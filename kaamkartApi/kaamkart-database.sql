-- ============================================================================
-- KaamKart Complete Database Setup
-- ============================================================================
-- This is the single, comprehensive SQL file for KaamKart database
-- Run this script to create the database, tables, indexes, and initial data
-- Usage: mysql -u root -p < kaamkart-database.sql
-- ============================================================================

-- Create database
CREATE DATABASE IF NOT EXISTS kaamkart;
USE kaamkart;

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    secondary_phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role ENUM('CUSTOMER', 'WORKER', 'ADMIN') NOT NULL,
    latitude DOUBLE,
    longitude DOUBLE,
    address VARCHAR(500),
    landmark VARCHAR(500),
    blocked BOOLEAN DEFAULT FALSE,
    super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_users_email (email(100)),
    INDEX idx_users_role (role),
    INDEX idx_users_blocked (blocked),
    INDEX idx_users_role_blocked (role, blocked),
    INDEX idx_users_created_at (created_at)
);

-- System Users table (for admins and super admins)
CREATE TABLE IF NOT EXISTS system_users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    secondary_phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    super_admin BOOLEAN DEFAULT FALSE,
    latitude DOUBLE,
    longitude DOUBLE,
    address VARCHAR(500),
    landmark VARCHAR(500),
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_system_users_email (email(100)),
    INDEX idx_system_users_super_admin (super_admin),
    INDEX idx_system_users_blocked (blocked),
    INDEX idx_system_users_super_blocked (super_admin, blocked),
    INDEX idx_system_users_created_at (created_at)
);

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    experience INT DEFAULT 0,
    rating DOUBLE DEFAULT 0.0,
    total_jobs INT DEFAULT 0,
    available BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    current_latitude DOUBLE,
    current_longitude DOUBLE,
    current_address VARCHAR(500),
    current_landmark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_workers_user_id (user_id),
    INDEX idx_workers_available (available),
    INDEX idx_workers_verified (verified),
    INDEX idx_workers_available_verified (available, verified),
    INDEX idx_workers_rating (rating DESC),
    INDEX idx_workers_created_at (created_at DESC),
    INDEX idx_workers_current_latitude (current_latitude),
    INDEX idx_workers_current_longitude (current_longitude),
    INDEX idx_workers_location (current_latitude, current_longitude)
);

-- Worker labor types (many-to-many)
CREATE TABLE IF NOT EXISTS worker_labor_types (
    worker_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, labor_type),
    INDEX idx_wlt_worker_id (worker_id),
    INDEX idx_wlt_labor_type (labor_type),
    INDEX idx_wlt_worker_labor_type (worker_id, labor_type)
);

-- Worker skills
CREATE TABLE IF NOT EXISTS worker_skills (
    worker_id BIGINT NOT NULL,
    skill VARCHAR(255) NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    work_type VARCHAR(255) NOT NULL,
    number_of_workers INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location_latitude DOUBLE,
    location_longitude DOUBLE,
    location_address VARCHAR(500),
    location_landmark VARCHAR(500),
    status ENUM('PENDING', 'PENDING_ADMIN_APPROVAL', 'ADMIN_APPROVED', 'NOTIFIED', 'CONFIRMED', 'DEPLOYED', 'COMPLETED', 'CANCELLED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_requests_customer_id (customer_id),
    INDEX idx_requests_status (status),
    INDEX idx_requests_start_date (start_date),
    INDEX idx_requests_end_date (end_date),
    INDEX idx_requests_date_range (start_date, end_date),
    INDEX idx_requests_status_dates (status, start_date, end_date),
    INDEX idx_requests_created_at (created_at DESC),
    INDEX idx_requests_completed_at (completed_at),
    INDEX idx_requests_latitude (location_latitude),
    INDEX idx_requests_longitude (location_longitude),
    INDEX idx_requests_location (location_latitude, location_longitude)
);

-- Request labor types (kept for backward compatibility)
CREATE TABLE IF NOT EXISTS request_labor_types (
    request_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    PRIMARY KEY (request_id, labor_type)
);

-- Request labor type requirements (with counts)
CREATE TABLE IF NOT EXISTS request_labor_type_requirements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    number_of_workers INT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    INDEX idx_rlt_request_id (request_id),
    INDEX idx_rlt_labor_type (labor_type),
    INDEX idx_rlt_request_labor_type (request_id, labor_type)
);

-- Confirmed workers table
CREATE TABLE IF NOT EXISTS confirmed_workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request_worker (request_id, worker_id),
    INDEX idx_confirmed_request_id (request_id),
    INDEX idx_confirmed_worker_id (worker_id),
    INDEX idx_confirmed_worker_request (worker_id, request_id),
    INDEX idx_confirmed_confirmed_at (confirmed_at DESC),
    INDEX idx_confirmed_worker_date (worker_id, confirmed_at DESC)
);

-- Deployed workers table
CREATE TABLE IF NOT EXISTS deployed_workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_deployed_request_id (request_id),
    INDEX idx_deployed_worker_id (worker_id),
    INDEX idx_deployed_worker_request (worker_id, request_id),
    INDEX idx_deployed_deployed_at (deployed_at DESC),
    INDEX idx_deployed_worker_date (worker_id, deployed_at DESC)
);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    rater_id BIGINT NOT NULL,
    rated_id BIGINT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rated_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request_rater (request_id, rater_id),
    INDEX idx_ratings_request_id (request_id),
    INDEX idx_ratings_rater_id (rater_id),
    INDEX idx_ratings_rated_id (rated_id),
    INDEX idx_ratings_request_rater (request_id, rater_id),
    INDEX idx_ratings_rated (rated_id, created_at DESC),
    INDEX idx_ratings_created_at (created_at DESC)
);

-- Concerns table
CREATE TABLE IF NOT EXISTS concerns (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT,
    raised_by_id BIGINT NOT NULL,
    related_to_id BIGINT,
    description VARCHAR(1000) NOT NULL,
    type ENUM('WORK_QUALITY', 'PAYMENT_ISSUE', 'BEHAVIOR', 'SAFETY', 'OTHER') NOT NULL,
    status ENUM('PENDING', 'IN_REVIEW', 'RESOLVED', 'DISMISSED') DEFAULT 'PENDING',
    admin_response VARCHAR(1000),
    user_message VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL,
    FOREIGN KEY (raised_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_to_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_concerns_request_id (request_id),
    INDEX idx_concerns_raised_by (raised_by_id),
    INDEX idx_concerns_related_to (related_to_id),
    INDEX idx_concerns_status (status),
    INDEX idx_concerns_type (type),
    INDEX idx_concerns_status_type (status, type),
    INDEX idx_concerns_created_at (created_at DESC),
    INDEX idx_concerns_resolved_at (resolved_at)
);

-- Concern Messages table (for conversation thread)
CREATE TABLE IF NOT EXISTS concern_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concern_id BIGINT NOT NULL,
    sent_by_id BIGINT NOT NULL,
    message VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concern_id) REFERENCES concerns(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_concern_messages_concern_id (concern_id),
    INDEX idx_concern_messages_created_at (created_at ASC),
    INDEX idx_concern_messages_concern_created (concern_id, created_at ASC)
);

-- Success Stories table
CREATE TABLE IF NOT EXISTS success_stories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    customer_name VARCHAR(100),
    worker_name VARCHAR(100),
    labor_type VARCHAR(50),
    rating INT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_stories_is_active (is_active),
    INDEX idx_stories_display_order (display_order),
    INDEX idx_stories_active_order (is_active, display_order, created_at DESC)
);

-- Advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    text TEXT NOT NULL,
    image_url VARCHAR(500),
    link_url VARCHAR(500),
    link_text VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ads_is_active (is_active),
    INDEX idx_ads_display_order (display_order),
    INDEX idx_ads_active_order (is_active, display_order, created_at DESC),
    INDEX idx_ads_start_date (start_date),
    INDEX idx_ads_end_date (end_date),
    INDEX idx_ads_date_range (start_date, end_date)
);

-- ============================================================================
-- 2. INITIAL DATA - SUPER ADMIN USERS
-- ============================================================================

-- Create superadmin@kaamkart.in as system user with super admin privileges
-- Email: superadmin@kaamkart.in
-- Password: Ankit@805204 (hashed using BCrypt)
INSERT INTO system_users (name, email, phone, password, super_admin, blocked, created_at)
VALUES (
    'Super Admin',
    'superadmin@kaamkart.in',
    '1234567890',
    '$2a$10$AZo6H41WujUc9x8z0pJ9qe7joFJCiY.a1LF8wEERVdU.g2PoBn6QK',
    TRUE,
    FALSE,
    NOW()
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    phone = VALUES(phone),
    password = VALUES(password),
    super_admin = TRUE,
    blocked = FALSE;

-- Create admin@kaamkart.com as system user with super admin privileges
-- Email: admin@kaamkart.com
-- Password: admin123 (hashed using BCrypt)
INSERT INTO system_users (name, email, phone, password, super_admin, blocked, created_at)
VALUES (
    'Admin User',
    'admin@kaamkart.com',
    '1234567890',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    TRUE,
    FALSE,
    NOW()
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    phone = VALUES(phone),
    password = VALUES(password),
    super_admin = TRUE,
    blocked = FALSE;

-- ============================================================================
-- 3. PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Analyze tables to update statistics (helps query optimizer)
ANALYZE TABLE users;
ANALYZE TABLE workers;
ANALYZE TABLE requests;
ANALYZE TABLE confirmed_workers;
ANALYZE TABLE deployed_workers;
ANALYZE TABLE ratings;
ANALYZE TABLE concerns;
ANALYZE TABLE worker_labor_types;
ANALYZE TABLE request_labor_types;
ANALYZE TABLE request_labor_type_requirements;
ANALYZE TABLE concern_messages;
ANALYZE TABLE system_users;
ANALYZE TABLE success_stories;
ANALYZE TABLE advertisements;

-- ============================================================================
-- 4. VERIFICATION QUERIES
-- ============================================================================

-- Verify super admin users were created
SELECT id, name, email, super_admin, blocked, created_at 
FROM system_users 
WHERE email IN ('superadmin@kaamkart.in', 'admin@kaamkart.com');

-- Show all tables
SHOW TABLES;

-- ============================================================================
-- END OF DATABASE SETUP
-- ============================================================================
-- 
-- Notes:
-- 1. All tables are created with proper indexes for scalability
-- 2. Foreign keys ensure referential integrity
-- 3. Indexes are optimized for millions of users
-- 4. Super admin users are created automatically
-- 5. Run ANALYZE TABLE periodically to update statistics
-- 
-- For production:
-- - Enable slow query log: SET GLOBAL slow_query_log = 'ON';
-- - Set long_query_time: SET GLOBAL long_query_time = 2;
-- - Monitor index usage and query performance
-- - Consider read replicas for heavy read operations
-- - Implement caching layer (Redis) for frequently accessed data
-- 
-- ============================================================================

