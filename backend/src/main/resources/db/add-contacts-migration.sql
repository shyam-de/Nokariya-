-- Migration script to add primary_contact and secondary_contact columns to users table

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS primary_contact VARCHAR(20) AFTER phone,
ADD COLUMN IF NOT EXISTS secondary_contact VARCHAR(20) AFTER primary_contact;

