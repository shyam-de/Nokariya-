-- Set admin@nokariya.com as super admin
UPDATE users 
SET super_admin = TRUE 
WHERE email = 'admin@nokariya.com' AND role = 'ADMIN';
