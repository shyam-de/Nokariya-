-- Migration script to support multiple labor types and date range in requests
-- Run this after updating the schema

-- Step 1: Create the new request_labor_types table
CREATE TABLE IF NOT EXISTS request_labor_types (
    request_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    PRIMARY KEY (request_id, labor_type)
);

-- Step 2: Migrate existing data from requests.labor_type to request_labor_types
INSERT INTO request_labor_types (request_id, labor_type)
SELECT id, labor_type FROM requests
WHERE labor_type IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM request_labor_types WHERE request_id = requests.id
);

-- Step 3: Add date columns to requests table
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Step 4: Set default dates for existing requests (optional - adjust as needed)
UPDATE requests 
SET start_date = DATE(created_at), 
    end_date = DATE_ADD(created_at, INTERVAL 1 DAY)
WHERE start_date IS NULL OR end_date IS NULL;

-- Step 5: Make date columns NOT NULL after setting defaults
ALTER TABLE requests 
MODIFY COLUMN start_date DATE NOT NULL,
MODIFY COLUMN end_date DATE NOT NULL;

-- Step 6: Remove the old labor_type column (DO THIS LAST, after verifying data migration)
-- ALTER TABLE requests DROP COLUMN labor_type;
-- ALTER TABLE requests DROP INDEX idx_labor_type;

-- Note: Uncomment Step 6 only after verifying that all data has been migrated correctly
