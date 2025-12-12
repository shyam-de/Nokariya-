# Database Migration for Render - System User Support

## ⚠️ Important
**Database schema changes do NOT happen automatically when you deploy the app.** You must run the migration SQL commands manually on your Render database.

## Problem
The `concern_messages` table has `sent_by_id` as NOT NULL, which prevents system users (who don't have a User record) from adding messages.

## Solution
Run these SQL commands on your Render PostgreSQL database.

## How to Run Migration on Render

### Step 1: Access Your Database

**Option A: Using Render Dashboard (if available)**
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Navigate to your PostgreSQL database service
3. Look for:
   - "Connect" button
   - "Query" or "SQL" tab
   - "Shell" option
   - "psql" or "Database" section

**Option B: Using External Database Tool (Recommended)**
Use a database client like:
- **pgAdmin** (Desktop app)
- **DBeaver** (Free, cross-platform)
- **TablePlus** (Mac/Windows)
- **Postico** (Mac)
- **psql** command line tool

**Option C: Using psql Command Line (if you have it installed)**
Connect directly from your terminal:

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

## Option 1: Using pgAdmin or DBeaver (Easiest)

### Using DBeaver (Free, Recommended):
1. Download DBeaver from https://dbeaver.io/download/
2. Install and open DBeaver
3. Click "New Database Connection" → Select "PostgreSQL"
4. Enter connection details:
   - **Host:** `dpg-d4ttu5pr0fns739f4s40-a`
   - **Port:** `5432`
   - **Database:** `kaamkart`
   - **Username:** `kaamkart_user`
   - **Password:** `u7B1yZpeSNCFzrsxv2ty8FYmMf4AjF7F`
5. Click "Test Connection" → "Finish"
6. Right-click on database → "SQL Editor" → "New SQL Script"
7. Paste and run the migration SQL commands

### Using pgAdmin:
1. Download from https://www.pgadmin.org/download/
2. Add new server with the same connection details above
3. Open Query Tool and run the SQL commands

## Option 2: Using psql Command Line

If you have `psql` installed (comes with PostgreSQL), connect directly:

```bash
psql "postgresql://kaamkart_user:u7B1yZpeSNCFzrsxv2ty8FYmMf4AjF7F@dpg-d4ttu5pr0fns739f4s40-a:5432/kaamkart"
```

Or step by step:
```bash
psql -h dpg-d4ttu5pr0fns739f4s40-a -p 5432 -U kaamkart_user -d kaamkart
# Enter password when prompted: u7B1yZpeSNCFzrsxv2ty8FYmMf4AjF7F
```

Then run the SQL commands above.

## Option 3: Using Render Shell (if available)

1. Go to Render Dashboard → Your Database
2. Look for "Shell" or "Console" option
3. If available, it will open a terminal where you can run `psql` commands

## Option 4: Using Online SQL Editor

Some online tools support PostgreSQL connections:
- **Adminer** (can be deployed as a service)
- **phpPgAdmin** (web-based)

## Notes
- This migration is **safe** - it won't affect existing data
- Existing messages will continue to work
- New messages from system users will use the new columns
- The migration can be run multiple times safely (uses `IF NOT EXISTS` and `IF EXISTS`)

## After Migration
Once the migration is complete, system users will be able to add messages without errors. The application code is already updated and ready to use the new schema.

