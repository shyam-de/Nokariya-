-- Migration script to add landmark column and request_labor_type_requirements table
-- Run this to update your existing database

USE nokariya;

-- Add landmark column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS landmark VARCHAR(500);

-- Add landmark column to system_users table
ALTER TABLE system_users 
ADD COLUMN IF NOT EXISTS landmark VARCHAR(500);

-- Add landmark column to workers table (current_landmark)
ALTER TABLE workers 
ADD COLUMN IF NOT EXISTS current_landmark VARCHAR(500);

-- Add landmark column to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS landmark VARCHAR(500);

-- Create request_labor_type_requirements table
CREATE TABLE IF NOT EXISTS request_labor_type_requirements (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    request_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    number_of_workers INT NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    INDEX idx_request_id (request_id)
);

