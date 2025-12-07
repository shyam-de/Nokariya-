-- Migration script to update existing database
-- Run this if you have an existing database with the old schema

USE nokariya;

-- Update users table to include ADMIN role
ALTER TABLE users MODIFY COLUMN role ENUM('CUSTOMER', 'WORKER', 'ADMIN') NOT NULL;

-- Update requests table to include new status values
ALTER TABLE requests MODIFY COLUMN status ENUM('PENDING', 'PENDING_ADMIN_APPROVAL', 'ADMIN_APPROVED', 'NOTIFIED', 'CONFIRMED', 'DEPLOYED', 'COMPLETED', 'CANCELLED', 'REJECTED') DEFAULT 'PENDING';

