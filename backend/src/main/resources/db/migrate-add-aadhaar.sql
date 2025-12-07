-- Migration script to add Aadhaar number fields to workers table
-- Run this to update your existing database

USE nokariya;

-- Add Aadhaar columns to workers table
ALTER TABLE workers 
ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(12) UNIQUE,
ADD COLUMN IF NOT EXISTS aadhaar_verified BOOLEAN DEFAULT FALSE;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_aadhaar_number ON workers(aadhaar_number);
CREATE INDEX IF NOT EXISTS idx_aadhaar_verified ON workers(aadhaar_verified);

-- Note: Existing workers will have NULL aadhaar_number and FALSE aadhaar_verified
