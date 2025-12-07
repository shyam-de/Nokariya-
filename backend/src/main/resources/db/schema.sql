-- Nokariya Database Schema
-- Run this script to create the database and tables

CREATE DATABASE IF NOT EXISTS nokariya;
USE nokariya;

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
    blocked BOOLEAN DEFAULT FALSE,
    super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role)
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
    INDEX idx_email (email),
    INDEX idx_super_admin (super_admin)
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
    INDEX idx_available (available)
);

-- Worker labor types (many-to-many)
CREATE TABLE IF NOT EXISTS worker_labor_types (
    worker_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE,
    PRIMARY KEY (worker_id, labor_type),
    INDEX idx_labor_type (labor_type)
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
    latitude DOUBLE,
    longitude DOUBLE,
    address VARCHAR(500),
    landmark VARCHAR(500),
    status ENUM('PENDING', 'PENDING_ADMIN_APPROVAL', 'ADMIN_APPROVED', 'NOTIFIED', 'CONFIRMED', 'DEPLOYED', 'COMPLETED', 'CANCELLED', 'REJECTED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_start_date (start_date),
    INDEX idx_end_date (end_date)
);

-- Request labor types (many-to-many) - kept for backward compatibility
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
    INDEX idx_request_id (request_id)
);

-- Confirmed workers table
CREATE TABLE IF NOT EXISTS confirmed_workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_request_worker (request_id, worker_id)
);

-- Deployed workers table
CREATE TABLE IF NOT EXISTS deployed_workers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    worker_id BIGINT NOT NULL,
    deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    FOREIGN KEY (worker_id) REFERENCES users(id) ON DELETE CASCADE
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
    INDEX idx_rated (rated_id),
    INDEX idx_rater (rater_id)
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
    INDEX idx_raised_by (raised_by_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
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
    INDEX idx_concern (concern_id),
    INDEX idx_created_at (created_at)
);

