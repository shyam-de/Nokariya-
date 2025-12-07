-- Migration script to remove SKILLED and UNSKILLED from existing tables
-- Run this after updating the schema

-- Update worker_labor_types table
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

-- Update requests table
ALTER TABLE requests 
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

-- Note: If you have existing data with SKILLED or UNSKILLED, you may need to update them first
-- UPDATE worker_labor_types SET labor_type = 'LABOUR' WHERE labor_type IN ('SKILLED', 'UNSKILLED');
-- UPDATE requests SET labor_type = 'LABOUR' WHERE labor_type IN ('SKILLED', 'UNSKILLED');
