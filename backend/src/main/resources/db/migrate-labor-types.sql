-- Migration script to update labor types in existing tables
-- Run this to update the ENUM values to match the new labor types
-- Note: This removes SKILLED and UNSKILLED, and adds the new specific types

USE nokariya;

-- First, convert any existing SKILLED/UNSKILLED values to LABOUR
UPDATE worker_labor_types 
SET labor_type = 'LABOUR' 
WHERE labor_type IN ('SKILLED', 'UNSKILLED');

-- Update worker_labor_types table ENUM (removing SKILLED and UNSKILLED)
ALTER TABLE worker_labor_types 
MODIFY COLUMN labor_type ENUM(
    'ELECTRICIAN', 
    'DRIVER', 
    'RIGGER', 
    'FITTER', 
    'COOK', 
    'PLUMBER', 
    'CARPENTER', 
    'PAINTER', 
    'LABOUR', 
    'RAJ_MISTRI'
) NOT NULL;
