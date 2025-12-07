-- Migration script to remove Aadhaar columns from workers table
-- Run this to clean up your existing database

USE nokariya;

-- Remove indexes first (MySQL syntax)
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                     WHERE table_schema = 'nokariya' 
                     AND table_name = 'workers' 
                     AND index_name = 'idx_aadhaar_number');
SET @sql = IF(@index_exists > 0, 'ALTER TABLE workers DROP INDEX idx_aadhaar_number', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                     WHERE table_schema = 'nokariya' 
                     AND table_name = 'workers' 
                     AND index_name = 'idx_aadhaar_verified');
SET @sql = IF(@index_exists > 0, 'ALTER TABLE workers DROP INDEX idx_aadhaar_verified', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Remove Aadhaar columns from workers table
-- Note: MySQL doesn't support DROP COLUMN IF EXISTS, so we check first
SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
                      WHERE table_schema = 'nokariya' 
                      AND table_name = 'workers' 
                      AND column_name = 'aadhaar_number');
SET @sql = IF(@column_exists > 0, 'ALTER TABLE workers DROP COLUMN aadhaar_number', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists = (SELECT COUNT(*) FROM information_schema.columns 
                      WHERE table_schema = 'nokariya' 
                      AND table_name = 'workers' 
                      AND column_name = 'aadhaar_verified');
SET @sql = IF(@column_exists > 0, 'ALTER TABLE workers DROP COLUMN aadhaar_verified', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
