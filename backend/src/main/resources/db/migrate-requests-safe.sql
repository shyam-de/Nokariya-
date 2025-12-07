-- Safe migration script for requests table
-- This handles the transition from single labor_type to multiple labor types with dates

USE nokariya;

-- Step 1: Update existing data - convert SKILLED/UNSKILLED to LABOUR
UPDATE requests 
SET labor_type = 'LABOUR' 
WHERE labor_type IN ('SKILLED', 'UNSKILLED');

-- Step 2: Update request_labor_types ENUM to include all new types
ALTER TABLE request_labor_types 
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

-- Step 3: Migrate existing data from requests.labor_type to request_labor_types
INSERT INTO request_labor_types (request_id, labor_type)
SELECT id, labor_type FROM requests
WHERE labor_type IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM request_labor_types WHERE request_id = requests.id
);

-- Step 4: Add date columns
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Step 5: Set default dates for existing requests
UPDATE requests 
SET start_date = COALESCE(start_date, DATE(created_at)), 
    end_date = COALESCE(end_date, DATE_ADD(created_at, INTERVAL 1 DAY))
WHERE start_date IS NULL OR end_date IS NULL;

-- Step 6: Make date columns NOT NULL
ALTER TABLE requests 
MODIFY COLUMN start_date DATE NOT NULL,
MODIFY COLUMN end_date DATE NOT NULL;

-- Step 7: Remove old labor_type column (after migration is verified)
-- ALTER TABLE requests DROP COLUMN labor_type;
-- ALTER TABLE requests DROP INDEX IF EXISTS idx_labor_type;
