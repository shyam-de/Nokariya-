-- Migration script to add support for system users in concern_messages
-- Run this on your PostgreSQL database

-- Make sent_by_id nullable to support system users
ALTER TABLE concern_messages 
    ALTER COLUMN sent_by_id DROP NOT NULL;

-- Change foreign key to allow NULL and use ON DELETE SET NULL
ALTER TABLE concern_messages 
    DROP CONSTRAINT IF EXISTS concern_messages_sent_by_id_fkey;

ALTER TABLE concern_messages 
    ADD CONSTRAINT concern_messages_sent_by_id_fkey 
    FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add new columns for system user support
ALTER TABLE concern_messages 
    ADD COLUMN IF NOT EXISTS sent_by_system_user_id BIGINT NULL;

ALTER TABLE concern_messages 
    ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(255) NULL;

-- Add index for system user ID lookups
CREATE INDEX IF NOT EXISTS idx_concern_messages_system_user_id 
    ON concern_messages(sent_by_system_user_id);

-- Update existing messages to have sent_by_name from users table
UPDATE concern_messages cm
SET sent_by_name = u.name
FROM users u
WHERE cm.sent_by_id = u.id 
  AND cm.sent_by_name IS NULL;

