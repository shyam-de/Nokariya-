-- Script to create an admin user
-- Run this command: mysql -u root -proot nokariya < create-admin.sql
-- Or execute the SQL directly in MySQL

USE nokariya;

-- Create admin user (password: admin123)
-- Password is hashed using BCrypt: $2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
INSERT INTO users (name, email, phone, password, role, created_at)
VALUES (
    'Admin User',
    'admin@nokariya.com',
    '1234567890',
    '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    'ADMIN',
    NOW()
);

-- To create admin with custom credentials, use this format:
-- Replace 'Your Name', 'your-email@example.com', 'your-phone', and 'your-password' with your values
-- Note: You'll need to hash the password using BCrypt. You can use an online BCrypt generator
-- or generate it programmatically in Java using BCryptPasswordEncoder

