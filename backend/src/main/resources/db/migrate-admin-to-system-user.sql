-- Migration script to move admin@nokariya.com from users table to system_users table
-- Run this after creating the system_users table

-- First, check if admin exists in users table
SELECT * FROM users WHERE email = 'admin@nokariya.com' AND role = 'ADMIN';

-- Insert into system_users (adjust values as needed)
INSERT INTO system_users (name, email, phone, password, super_admin, blocked, created_at)
SELECT 
    name,
    email,
    phone,
    password,
    COALESCE(super_admin, TRUE) as super_admin,  -- Set as super admin by default
    COALESCE(blocked, FALSE) as blocked,
    created_at
FROM users
WHERE email = 'admin@nokariya.com' AND role = 'ADMIN'
AND NOT EXISTS (SELECT 1 FROM system_users WHERE email = 'admin@nokariya.com');

-- After migration, you can optionally delete from users table (or keep for reference)
-- DELETE FROM users WHERE email = 'admin@nokariya.com' AND role = 'ADMIN';
