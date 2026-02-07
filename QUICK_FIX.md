# Quick Database Fix

The database has existing users with `role='user'` but we've changed the enum to only support `'client'`, `'freelancer'`, and `'admin'`.

## Option 1: Update Existing Users (RECOMMENDED)

Run this SQL directly in your database:

```sql
-- Update existing users with role='user' to role='client'
UPDATE users SET role = 'client' WHERE role = 'user';
```

## Option 2: Clear All Data (Development Only)

```sql
-- Delete all users (this will cascade to related tables)
TRUNCATE users, otp_tokens, wallets, escrows, milestones, transactions, ratings RESTART IDENTITY CASCADE;
```

## Run One of These Commands

Using psql:
```bash
psql $DATABASE_URL -c "UPDATE users SET role = 'client' WHERE role = 'user';"
```

Or through DBeaver/pgAdmin - connect to your Neon database and run the SQL.
