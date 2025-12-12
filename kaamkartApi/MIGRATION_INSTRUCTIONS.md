# Database Migration Instructions for System User Support

## Problem
The `concern_messages` table has `sent_by_id` as NOT NULL, which prevents system users (who don't have a User record) from adding messages.

## Solution
Run the migration script to:
1. Make `sent_by_id` nullable
2. Add `sent_by_system_user_id` column
3. Add `sent_by_name` column

## How to Run Migration on Render

### Option 1: Using Render's Database Dashboard (Recommended)
1. Go to your Render dashboard
2. Navigate to your PostgreSQL database
3. Click on "Connect" or "Query" tab
4. Copy and paste the SQL commands from `migration-add-system-user-support.sql`
5. Execute them one by one

### Option 2: Using psql Command Line
```bash
# Connect to your Render database
psql "postgresql://kaamkart_user:u7B1yZpeSNCFzrsxv2ty8FYmMf4AjF7F@dpg-d4ttu5pr0fns739f4s40-a:5432/kaamkart"

# Then run the migration commands:
ALTER TABLE concern_messages ALTER COLUMN sent_by_id DROP NOT NULL;

ALTER TABLE concern_messages DROP CONSTRAINT IF EXISTS concern_messages_sent_by_id_fkey;

ALTER TABLE concern_messages ADD CONSTRAINT concern_messages_sent_by_id_fkey 
    FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_system_user_id BIGINT NULL;

ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_concern_messages_system_user_id 
    ON concern_messages(sent_by_system_user_id);

UPDATE concern_messages cm
SET sent_by_name = u.name
FROM users u
WHERE cm.sent_by_id = u.id 
  AND cm.sent_by_name IS NULL;
```

### Option 3: Quick Fix (Minimal Commands)
If you just need to fix the immediate issue, run these two commands:

```sql
ALTER TABLE concern_messages ALTER COLUMN sent_by_id DROP NOT NULL;
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_system_user_id BIGINT NULL;
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(255) NULL;
```

## Verification
After running the migration, verify with:
```sql
\d concern_messages
```

You should see:
- `sent_by_id` is nullable
- `sent_by_system_user_id` column exists
- `sent_by_name` column exists

## Notes
- This migration is safe and won't affect existing data
- Existing messages will continue to work
- New messages from system users will use the new columns

