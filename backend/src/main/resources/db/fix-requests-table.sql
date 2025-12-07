-- Fix requests table to match new schema
-- Run this to update your existing database

-- Step 1: Check if old labor_type column exists
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
-- WHERE TABLE_SCHEMA = 'nokariya' AND TABLE_NAME = 'requests' AND COLUMN_NAME = 'labor_type';

-- Step 2: Create request_labor_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS request_labor_types (
    request_id BIGINT NOT NULL,
    labor_type ENUM('ELECTRICIAN', 'DRIVER', 'RIGGER', 'FITTER', 'COOK', 'PLUMBER', 'CARPENTER', 'PAINTER', 'LABOUR', 'RAJ_MISTRI') NOT NULL,
    FOREIGN KEY (request_id) REFERENCES requests(id) ON DELETE CASCADE,
    PRIMARY KEY (request_id, labor_type)
);

-- Step 3: Migrate existing data if labor_type column exists
-- First check if the column exists, then migrate
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'requests' 
    AND COLUMN_NAME = 'labor_type'
);

SET @sql = IF(@col_exists > 0,
    'INSERT INTO request_labor_types (request_id, labor_type)
     SELECT id, labor_type FROM requests
     WHERE labor_type IS NOT NULL
     AND NOT EXISTS (
         SELECT 1 FROM request_labor_types WHERE request_id = requests.id
     )',
    'SELECT "labor_type column does not exist, skipping migration" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: Add date columns if they don't exist
ALTER TABLE requests 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Step 5: Set default dates for existing requests
UPDATE requests 
SET start_date = COALESCE(start_date, DATE(created_at)), 
    end_date = COALESCE(end_date, DATE_ADD(created_at, INTERVAL 1 DAY))
WHERE start_date IS NULL OR end_date IS NULL;

-- Step 6: Make date columns NOT NULL (only if all rows have dates)
-- First check if there are any NULLs
SET @null_dates = (SELECT COUNT(*) FROM requests WHERE start_date IS NULL OR end_date IS NULL);

SET @alter_sql = IF(@null_dates = 0,
    'ALTER TABLE requests MODIFY COLUMN start_date DATE NOT NULL, MODIFY COLUMN end_date DATE NOT NULL',
    'SELECT "Cannot make columns NOT NULL, there are NULL values" AS message'
);

PREPARE alter_stmt FROM @alter_sql;
EXECUTE alter_stmt;
DEALLOCATE PREPARE alter_stmt;

-- Step 7: Remove old labor_type column and index (DO THIS LAST, after verifying)
-- Uncomment these lines only after verifying that all data has been migrated:
-- ALTER TABLE requests DROP COLUMN labor_type;
-- ALTER TABLE requests DROP INDEX IF EXISTS idx_labor_type;
