-- QUICK MIGRATION SCRIPT FOR RENDER DATABASE
-- Copy and paste these commands into your database client

-- CRITICAL: Make sent_by_id nullable (fixes the error)
ALTER TABLE concern_messages ALTER COLUMN sent_by_id DROP NOT NULL;

-- Add new columns for system user support
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_system_user_id BIGINT NULL;
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(255) NULL;

-- Update foreign key to allow NULL
ALTER TABLE concern_messages DROP CONSTRAINT IF EXISTS concern_messages_sent_by_id_fkey;
ALTER TABLE concern_messages ADD CONSTRAINT concern_messages_sent_by_id_fkey 
    FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_concern_messages_system_user_id 
    ON concern_messages(sent_by_system_user_id);

-- Populate sent_by_name for existing messages
UPDATE concern_messages cm
SET sent_by_name = u.name
FROM users u
WHERE cm.sent_by_id = u.id AND cm.sent_by_name IS NULL;

-- Verify the changes
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'concern_messages' 
AND column_name IN ('sent_by_id', 'sent_by_system_user_id', 'sent_by_name')
ORDER BY column_name;

