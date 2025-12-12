# Database Migration for Render - System User Support

## ⚠️ Important
**Database schema changes do NOT happen automatically when you deploy the app.** You must run the migration SQL commands manually on your Render database.

## Problem
The `concern_messages` table has `sent_by_id` as NOT NULL, which prevents system users (who don't have a User record) from adding messages.

## Solution
Run these SQL commands on your Render PostgreSQL database.

## How to Run Migration on Render

### Step 1: Access Your Database
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your PostgreSQL database service
3. Click on the database name
4. Click on "Connect" or "Query" tab (or use the "Shell" option)

### Step 2: Run These SQL Commands

Copy and paste these commands one by one, or all at once:

```sql
-- Step 1: Make sent_by_id nullable (THIS IS THE CRITICAL FIX)
ALTER TABLE concern_messages ALTER COLUMN sent_by_id DROP NOT NULL;

-- Step 2: Add new columns for system user support
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_system_user_id BIGINT NULL;
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(255) NULL;

-- Step 3: Update foreign key to allow NULL
ALTER TABLE concern_messages DROP CONSTRAINT IF EXISTS concern_messages_sent_by_id_fkey;
ALTER TABLE concern_messages ADD CONSTRAINT concern_messages_sent_by_id_fkey 
    FOREIGN KEY (sent_by_id) REFERENCES users(id) ON DELETE SET NULL;

-- Step 4: Add index for performance
CREATE INDEX IF NOT EXISTS idx_concern_messages_system_user_id 
    ON concern_messages(sent_by_system_user_id);

-- Step 5: Populate sent_by_name for existing messages
UPDATE concern_messages cm
SET sent_by_name = u.name
FROM users u
WHERE cm.sent_by_id = u.id AND cm.sent_by_name IS NULL;
```

### Step 3: Verify Migration

After running the commands, verify with:

```sql
-- Check table structure
\d concern_messages

-- Or check columns
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'concern_messages' 
ORDER BY ordinal_position;
```

You should see:
- `sent_by_id` is nullable (is_nullable = 'YES')
- `sent_by_system_user_id` column exists
- `sent_by_name` column exists

## Quick Fix (Minimum Required)

If you just want to fix the immediate error, run ONLY this command:

```sql
ALTER TABLE concern_messages ALTER COLUMN sent_by_id DROP NOT NULL;
```

Then add the new columns:

```sql
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_system_user_id BIGINT NULL;
ALTER TABLE concern_messages ADD COLUMN IF NOT EXISTS sent_by_name VARCHAR(255) NULL;
```

## Alternative: Using psql Command Line

If you have `psql` installed locally, you can connect directly:

```bash
psql "postgresql://kaamkart_user:u7B1yZpeSNCFzrsxv2ty8FYmMf4AjF7F@dpg-d4ttu5pr0fns739f4s40-a:5432/kaamkart"
```

Then run the SQL commands above.

## Notes
- This migration is **safe** - it won't affect existing data
- Existing messages will continue to work
- New messages from system users will use the new columns
- The migration can be run multiple times safely (uses `IF NOT EXISTS` and `IF EXISTS`)

## After Migration
Once the migration is complete, system users will be able to add messages without errors. The application code is already updated and ready to use the new schema.

