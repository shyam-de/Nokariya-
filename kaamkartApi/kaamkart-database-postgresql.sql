-- ============================================================================
-- KaamKart Complete Database Setup - PostgreSQL Version
-- ============================================================================
-- This is the PostgreSQL version of the database schema
-- Run this script to create the database, tables, indexes, and initial data
-- Usage: psql -U postgres -d kaamkart -f kaamkart-database-postgresql.sql
-- Or: psql -U postgres -c "CREATE DATABASE kaamkart;" then run this file
-- ============================================================================

-- Note: Connect to the database first:
-- psql -U postgres
-- CREATE DATABASE kaamkart;
-- \c kaamkart
-- Then run this script

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    secondary_phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER', 'WORKER', 'ADMIN')),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address VARCHAR(500),
    landmark VARCHAR(500),
    blocked BOOLEAN DEFAULT FALSE,
    super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked);
CREATE INDEX IF NOT EXISTS idx_users_role_blocked ON users(role, blocked);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- System Users table (for admins and super admins)
CREATE TABLE IF NOT EXISTS system_users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    secondary_phone VARCHAR(20),
    password VARCHAR(255) NOT NULL,
    super_admin BOOLEAN DEFAULT FALSE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    address VARCHAR(500),
    landmark VARCHAR(500),
    blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_system_users_super_admin ON system_users(super_admin);
CREATE INDEX IF NOT EXISTS idx_system_users_blocked ON system_users(blocked);
CREATE INDEX IF NOT EXISTS idx_system_users_super_blocked ON system_users(super_admin, blocked);
CREATE INDEX IF NOT EXISTS idx_system_users_created_at ON system_users(created_at);

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    experience INT DEFAULT 0,
    rating DOUBLE PRECISION DEFAULT 0.0,
    total_jobs INT DEFAULT 0,
    available BOOLEAN DEFAULT TRUE,
    verified BOOLEAN DEFAULT FALSE,
    current_latitude DOUBLE PRECISION,
    current_longitude DOUBLE PRECISION,
    current_address VARCHAR(500),
    current_landmark VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_available ON workers(available);
CREATE INDEX IF NOT EXISTS idx_workers_verified ON workers(verified);
CREATE INDEX IF NOT EXISTS idx_workers_available_verified ON workers(available, verified);
CREATE INDEX IF NOT EXISTS idx_workers_rating ON workers(rating DESC);
CREATE INDEX IF NOT EXISTS idx_workers_created_at ON workers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workers_current_latitude ON workers(current_latitude);
CREATE INDEX IF NOT EXISTS idx_workers_current_longitude ON workers(current_longitude);
CREATE INDEX IF NOT EXISTS idx_workers_location ON workers(current_latitude, current_longitude);

-- Worker Types table (dynamic, managed by super admin)
CREATE TABLE IF NOT EXISTS worker_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    icon VARCHAR(10),
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_worker_types_name ON worker_types(name);
CREATE INDEX IF NOT EXISTS idx_worker_types_active ON worker_types(is_active);
CREATE INDEX IF NOT EXISTS idx_worker_types_active_name ON worker_types(is_active, name);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at for worker_types
CREATE TRIGGER update_worker_types_updated_at BEFORE UPDATE ON worker_types
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Worker type assignments (many-to-many join table: workers <-> worker_types)
CREATE TABLE IF NOT EXISTS workers_worker_types (
    worker_id BIGINT NOT NULL,
    worker_type VARCHAR(100) NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, worker_type)
);

CREATE INDEX IF NOT EXISTS idx_wwt_worker_id ON workers_worker_types(worker_id);
CREATE INDEX IF NOT EXISTS idx_wwt_worker_type ON workers_worker_types(worker_type);
CREATE INDEX IF NOT EXISTS idx_wwt_worker_worker_type ON workers_worker_types(worker_id, worker_type);

-- Worker skills
CREATE TABLE IF NOT EXISTS worker_skills (
    worker_id BIGINT NOT NULL,
    skill VARCHAR(255) NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
);

-- Requests table
CREATE TABLE IF NOT EXISTS requests (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    work_type VARCHAR(255) NOT NULL,
    number_of_workers INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    location_latitude DOUBLE PRECISION,
    location_longitude DOUBLE PRECISION,
    location_address VARCHAR(500),
    location_landmark VARCHAR(500),
    status VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PENDING_ADMIN_APPROVAL', 'ADMIN_APPROVED', 'NOTIFIED', 'CONFIRMED', 'DEPLOYED', 'COMPLETED', 'CANCELLED', 'REJECTED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_requests_customer_id ON requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_start_date ON requests(start_date);
CREATE INDEX IF NOT EXISTS idx_requests_end_date ON requests(end_date);
CREATE INDEX IF NOT EXISTS idx_requests_date_range ON requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_requests_status_dates ON requests(status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_requests_completed_at ON requests(completed_at);
CREATE INDEX IF NOT EXISTS idx_requests_latitude ON requests(location_latitude);
CREATE INDEX IF NOT EXISTS idx_requests_longitude ON requests(location_longitude);
CREATE INDEX IF NOT EXISTS idx_requests_location ON requests(location_latitude, location_longitude);

-- Request worker types (kept for backward compatibility)
CREATE TABLE IF NOT EXISTS request_worker_types (
    request_id BIGINT NOT NULL,
    worker_type VARCHAR(100) NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    PRIMARY KEY (request_id, worker_type)
);

-- Request worker type requirements (with counts)
CREATE TABLE IF NOT EXISTS request_worker_type_requirements (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_type VARCHAR(100) NOT NULL,
    number_of_workers INT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rwt_request_id ON request_worker_type_requirements(request_id);
CREATE INDEX IF NOT EXISTS idx_rwt_worker_type ON request_worker_type_requirements(worker_type);
CREATE INDEX IF NOT EXISTS idx_rwt_request_worker_type ON request_worker_type_requirements(request_id, worker_type);

-- Confirmed workers table
CREATE TABLE IF NOT EXISTS confirmed_workers (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (request_id, worker_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmed_request_id ON confirmed_workers(request_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_worker_id ON confirmed_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_worker_request ON confirmed_workers(worker_id, request_id);
CREATE INDEX IF NOT EXISTS idx_confirmed_confirmed_at ON confirmed_workers(confirmed_at DESC);
CREATE INDEX IF NOT EXISTS idx_confirmed_worker_date ON confirmed_workers(worker_id, confirmed_at DESC);

-- Deployed workers table
CREATE TABLE IF NOT EXISTS deployed_workers (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deployed_request_id ON deployed_workers(request_id);
CREATE INDEX IF NOT EXISTS idx_deployed_worker_id ON deployed_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_deployed_worker_request ON deployed_workers(worker_id, request_id);
CREATE INDEX IF NOT EXISTS idx_deployed_deployed_at ON deployed_workers(deployed_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployed_worker_date ON deployed_workers(worker_id, deployed_at DESC);

-- Ratings table
CREATE TABLE IF NOT EXISTS ratings (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL,
    rater_id BIGINT NOT NULL,
    rated_id BIGINT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (rater_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (rated_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (request_id, rater_id)
);

CREATE INDEX IF NOT EXISTS idx_ratings_request_id ON ratings(request_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rater_id ON ratings(rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated_id ON ratings(rated_id);
CREATE INDEX IF NOT EXISTS idx_ratings_request_rater ON ratings(request_id, rater_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON ratings(created_at DESC);

-- Concerns table
CREATE TABLE IF NOT EXISTS concerns (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT,
    raised_by_id BIGINT NOT NULL,
    related_to_id BIGINT,
    description VARCHAR(1000) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('WORK_QUALITY', 'PAYMENT_ISSUE', 'BEHAVIOR', 'SAFETY', 'OTHER')),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
    admin_response VARCHAR(1000),
    user_message VARCHAR(1000),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE SET NULL,
    FOREIGN KEY (raised_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_to_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_concerns_request_id ON concerns(request_id);
CREATE INDEX IF NOT EXISTS idx_concerns_raised_by ON concerns(raised_by_id);
CREATE INDEX IF NOT EXISTS idx_concerns_related_to ON concerns(related_to_id);
CREATE INDEX IF NOT EXISTS idx_concerns_status ON concerns(status);
CREATE INDEX IF NOT EXISTS idx_concerns_type ON concerns(type);
CREATE INDEX IF NOT EXISTS idx_concerns_status_type ON concerns(status, type);
CREATE INDEX IF NOT EXISTS idx_concerns_created_at ON concerns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concerns_resolved_at ON concerns(resolved_at);

-- Concern Messages table (for conversation thread)
CREATE TABLE IF NOT EXISTS concern_messages (
    id BIGSERIAL PRIMARY KEY,
    concern_id BIGINT NOT NULL,
    sent_by_id BIGINT NOT NULL,
    message VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (concern_id) REFERENCES concerns(id) ON DELETE CASCADE,
    FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_concern_messages_concern_id ON concern_messages(concern_id);
CREATE INDEX IF NOT EXISTS idx_concern_messages_created_at ON concern_messages(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_concern_messages_concern_created ON concern_messages(concern_id, created_at ASC);

-- Success Stories table
CREATE TABLE IF NOT EXISTS success_stories (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    customer_name VARCHAR(100),
    worker_name VARCHAR(100),
    worker_type VARCHAR(50),
    rating INT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stories_is_active ON success_stories(is_active);
CREATE INDEX IF NOT EXISTS idx_stories_display_order ON success_stories(display_order);
CREATE INDEX IF NOT EXISTS idx_stories_active_order ON success_stories(is_active, display_order, created_at DESC);

-- Trigger to auto-update updated_at for success_stories
CREATE TRIGGER update_success_stories_updated_at BEFORE UPDATE ON success_stories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Advertisements table
CREATE TABLE IF NOT EXISTS advertisements (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL UNIQUE,
    text TEXT NOT NULL,
    image_url VARCHAR(500),
    link_url VARCHAR(500),
    link_text VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ads_is_active ON advertisements(is_active);
CREATE INDEX IF NOT EXISTS idx_ads_display_order ON advertisements(display_order);
CREATE INDEX IF NOT EXISTS idx_ads_active_order ON advertisements(is_active, display_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ads_start_date ON advertisements(start_date);
CREATE INDEX IF NOT EXISTS idx_ads_end_date ON advertisements(end_date);
CREATE INDEX IF NOT EXISTS idx_ads_date_range ON advertisements(start_date, end_date);

-- Trigger to auto-update updated_at for advertisements
CREATE TRIGGER update_advertisements_updated_at BEFORE UPDATE ON advertisements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Password Reset Tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(100) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL,
    is_system_user BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reset_token_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_token_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_token_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_reset_token_user_expires ON password_reset_tokens(user_id, expires_at);

-- API Logs table (for tracking essential API request/response data)
CREATE TABLE IF NOT EXISTS api_logs (
    id BIGSERIAL PRIMARY KEY,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_logs_method ON api_logs(method);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON api_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_id ON api_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint_status ON api_logs(endpoint, status_code);
CREATE INDEX IF NOT EXISTS idx_api_logs_user_created ON api_logs(user_id, created_at DESC);

-- ============================================================================
-- 2. INITIAL DATA - WORKER TYPES
-- ============================================================================

-- Insert initial worker types (can be managed by super admin later)
INSERT INTO worker_types (name, display_name, icon, description, is_active, display_order) VALUES
('ELECTRICIAN', 'Electrician', '⚡', 'Electrical repairs, installations & maintenance', TRUE, 1),
('DRIVER', 'Driver', '🚗', 'Professional drivers for all your transportation needs', TRUE, 2),
('RIGGER', 'Rigger', '🔩', 'Expert rigging and lifting services', TRUE, 3),
('FITTER', 'Fitter', '🔧', 'Mechanical fitting and assembly work', TRUE, 4),
('COOK', 'Cook', '👨‍🍳', 'Professional cooking and kitchen services', TRUE, 5),
('PLUMBER', 'Plumber', '🔧', 'Plumbing repairs, installations & maintenance', TRUE, 6),
('CARPENTER', 'Carpenter', '🪚', 'Carpentry, furniture & woodwork', TRUE, 7),
('PAINTER', 'Painter', '🎨', 'Interior & exterior painting services', TRUE, 8),
('UNSKILLED_WORKER', 'Unskilled Worker', '👷', 'Unskilled worker for all manual tasks', TRUE, 9),
('RAJ_MISTRI', 'Raj Mistri', '👷‍♂️', 'Supervisor & foreman for construction projects', TRUE, 10)
ON CONFLICT (name) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description;

-- ============================================================================
-- 3. INITIAL DATA - SUCCESS STORIES
-- ============================================================================

-- Insert default success stories
INSERT INTO success_stories (title, description, customer_name, worker_name, worker_type, rating, is_active, display_order) VALUES
('Excellent Electrical Work', 'Got my entire house rewired by an expert electrician from KaamKart. Professional service, timely completion, and reasonable pricing. Highly recommended!', 'Rajesh Kumar', 'Amit Sharma', 'ELECTRICIAN', 5, TRUE, 1),
('Reliable Driver Service', 'Used KaamKart driver for my daily commute. Punctual, safe, and courteous. Made my life so much easier!', 'Priya Singh', 'Vikram Mehta', 'DRIVER', 5, TRUE, 2),
('Perfect Plumbing Solution', 'Had a major leak in my bathroom. The plumber from KaamKart fixed it quickly and efficiently. Great work!', 'Anil Verma', 'Suresh Patel', 'PLUMBER', 5, TRUE, 3),
('Beautiful Home Painting', 'Got my entire house painted through KaamKart. The painter did an amazing job with attention to detail. Love the results!', 'Meera Joshi', 'Ramesh Yadav', 'PAINTER', 5, TRUE, 4),
('Expert Carpentry Work', 'Needed custom furniture for my home. The carpenter from KaamKart delivered exactly what I wanted. Excellent craftsmanship!', 'Deepak Malhotra', 'Kiran Reddy', 'CARPENTER', 5, TRUE, 5)
ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description,
    customer_name = EXCLUDED.customer_name,
    worker_name = EXCLUDED.worker_name,
    worker_type = EXCLUDED.worker_type,
    rating = EXCLUDED.rating,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

-- ============================================================================
-- 4. INITIAL DATA - ADVERTISEMENTS
-- ============================================================================

-- Insert default advertisements
INSERT INTO advertisements (title, text, link_url, link_text, is_active, display_order, start_date, end_date) VALUES
('Find Skilled Workers Fast!', 'Connect with verified workers for all your needs. Electricians, Plumbers, Drivers, and more. Book now!', '/login', 'Get Started', TRUE, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year'),
('Trusted by Thousands', 'Join thousands of satisfied customers who found reliable workers through KaamKart. Your trusted labor connection platform.', '/', 'Learn More', TRUE, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year'),
('Verified Workers Only', 'All workers on KaamKart are verified and background checked. Your safety and satisfaction is our priority.', '/login', 'Browse Workers', TRUE, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '1 year')
ON CONFLICT (title) DO UPDATE SET
    text = EXCLUDED.text,
    link_url = EXCLUDED.link_url,
    link_text = EXCLUDED.link_text,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date;

-- ============================================================================
-- 5. INITIAL DATA - SUPER ADMIN USERS
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
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    password = EXCLUDED.password,
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
    CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    password = EXCLUDED.password,
    super_admin = TRUE,
    blocked = FALSE;

-- ============================================================================
-- 6. PERFORMANCE OPTIMIZATIONS
-- ============================================================================

-- Analyze tables to update statistics (helps query optimizer)
ANALYZE users;
ANALYZE workers;
ANALYZE requests;
ANALYZE confirmed_workers;
ANALYZE deployed_workers;
ANALYZE ratings;
ANALYZE concerns;
ANALYZE workers_worker_types;
ANALYZE request_worker_types;
ANALYZE request_worker_type_requirements;
ANALYZE concern_messages;
ANALYZE system_users;
ANALYZE success_stories;
ANALYZE advertisements;
ANALYZE worker_types;

-- ============================================================================
-- 7. VERIFICATION QUERIES
-- ============================================================================

-- Verify super admin users were created
SELECT id, name, email, super_admin, blocked, created_at 
FROM system_users 
WHERE email IN ('superadmin@kaamkart.in', 'admin@kaamkart.com');

-- Show all tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- END OF DATABASE SETUP
-- ============================================================================
-- 
-- Notes:
-- 1. All tables are created with proper indexes for scalability
-- 2. Foreign keys ensure referential integrity
-- 3. Indexes are optimized for millions of users
-- 4. Super admin users are created automatically
-- 5. Run ANALYZE periodically to update statistics
-- 
-- For production:
-- - Enable query logging in postgresql.conf
-- - Monitor index usage and query performance
-- - Consider read replicas for heavy read operations
-- - Implement caching layer (Redis) for frequently accessed data
-- 
-- ============================================================================
