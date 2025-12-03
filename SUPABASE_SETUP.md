# Supabase Deployment Guide

## Step 1: Create a Supabase Project

### 1.1 Sign Up / Log In
1. Go to https://supabase.com
2. Click "Start your project" or "Sign in"
3. Sign in with GitHub (recommended) or email

### 1.2 Create New Project
1. Click "New Project"
2. Choose your organization (or create one)
3. Fill in project details:
   - **Project Name:** `clientreport` (or your preferred name)
   - **Database Password:** Generate a strong password (save this!)
   - **Region:** Choose closest to your location (e.g., "Australia (Sydney)")
   - **Pricing Plan:** Start with "Free" tier (includes 500MB database, 1GB file storage)
4. Click "Create new project"
5. Wait 2-3 minutes for provisioning

### 1.3 Save Your Credentials
Once created, you'll need these (found in Settings > API):
- **Project URL:** `https://xxxxx.supabase.co`
- **Anon (public) key:** `eyJhbG...` (for frontend)
- **Service role key:** `eyJhbG...` (for backend - keep secret!)
- **Database password:** (the one you created above)

---

## Step 2: Run the Database Schema

### 2.1 Access SQL Editor
1. In Supabase dashboard, click "SQL Editor" in left sidebar
2. Click "New query"

### 2.2 Copy Schema File
1. Open `database/schema.sql` from this repository
2. Copy the entire contents (all ~720 lines)
3. Paste into the SQL Editor

### 2.3 Execute Schema
1. Click "Run" button (or Ctrl/Cmd + Enter)
2. Wait for execution (should take 5-10 seconds)
3. Check for success message: "Success. No rows returned"

### 2.4 Verify Tables Created
1. Click "Table Editor" in left sidebar
2. You should see all tables:
   - ✅ users
   - ✅ clients
   - ✅ sprints
   - ✅ time_entries
   - ✅ clockify_projects
   - ✅ sync_logs

### 2.5 Verify Admin Users
1. In Table Editor, click on `users` table
2. You should see 3 rows:
   - dani@studiohawk.com.au
   - georgia.anderson@studiohawk.com.au
   - daisy@studiohawk.com.au
3. All should have `is_admin = true`

---

## Step 3: Configure Authentication

### 3.1 Enable Email Authentication
1. Click "Authentication" in left sidebar
2. Go to "Providers" tab
3. Find "Email" and click to configure
4. Toggle "Enable Email provider" to ON
5. **Enable email confirmations:** OFF (for now - we'll use magic links)
6. Click "Save"

### 3.2 Configure Email Domain Restriction
We need to restrict login to @studiohawk.com.au emails only.

**Option A: Database Trigger (Recommended)**
1. Go back to SQL Editor
2. Create a new query with this code:

```sql
-- Function to check email domain
CREATE OR REPLACE FUNCTION check_email_domain()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email NOT LIKE '%@studiohawk.com.au' THEN
    RAISE EXCEPTION 'Only @studiohawk.com.au email addresses are allowed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on auth.users table
DROP TRIGGER IF EXISTS check_email_domain_trigger ON auth.users;
CREATE TRIGGER check_email_domain_trigger
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION check_email_domain();
```

3. Run the query

**Option B: Email Allowlist (Alternative)**
1. In Authentication settings
2. Scroll to "Email Allowlist"
3. Add pattern: `*@studiohawk.com.au`

### 3.3 Configure Email Templates (Optional)
1. Go to "Authentication" > "Email Templates"
2. Customize "Magic Link" email template
3. Update subject and body to match your branding

---

## Step 4: Set Up Environment Variables

### 4.1 Create .env File
Create a `.env` file in your project root (this is already in .gitignore):

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...

# Monday.com
MONDAY_API_KEY=your_monday_api_key
MONDAY_AU_BOARD_ID=your_board_id

# Clockify
CLOCKIFY_API_KEY=your_clockify_api_key
CLOCKIFY_WORKSPACE_ID=your_workspace_id
```

### 4.2 Get API Keys

**Supabase Keys:**
- Dashboard > Settings > API
- Copy "Project URL", "anon public", and "service_role secret"

**Monday.com API Key:**
1. Go to https://monday.com
2. Click your avatar (top right) > "Developers"
3. Click "My Access Tokens"
4. Click "Generate" or "Show" for existing token
5. Copy the token

**Monday.com Board ID:**
- It's in the URL when viewing your board
- Example: `https://monday.com/boards/1234567890` → Board ID is `1234567890`

**Clockify API Key:**
1. Go to https://clockify.me
2. Click your avatar > "Settings"
3. Scroll to "API" section
4. Copy your API key

**Clockify Workspace ID:**
1. In Clockify, click workspace dropdown (top left)
2. Click "Settings"
3. Copy the Workspace ID from the URL or settings page

---

## Step 5: Test Database Connection

### 5.1 Install Supabase Python Client
```bash
pip install supabase
```

### 5.2 Create Test Script
Create `test_supabase.py`:

```python
import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Test: Fetch admin users
response = supabase.table('users').select('email, name, is_admin').execute()

print("✅ Connected to Supabase!")
print(f"Found {len(response.data)} users:")
for user in response.data:
    print(f"  - {user['name']} ({user['email']}) - Admin: {user['is_admin']}")
```

### 5.3 Run Test
```bash
python test_supabase.py
```

Expected output:
```
✅ Connected to Supabase!
Found 3 users:
  - Dani (dani@studiohawk.com.au) - Admin: True
  - Georgia Anderson (georgia.anderson@studiohawk.com.au) - Admin: True
  - Daisy (daisy@studiohawk.com.au) - Admin: True
```

---

## Step 6: Verify Row Level Security (RLS)

### 6.1 Check RLS Status
1. In Supabase dashboard, go to "Table Editor"
2. Click on `users` table
3. Click the shield icon (🛡️) next to table name
4. Should see "Row Level Security is **enabled**"
5. Verify policies exist:
   - `users_select_own`
   - `users_select_admin`
6. Repeat for all tables

### 6.2 Test RLS Policies (Optional)
Create `test_rls.py`:

```python
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
anon_key = os.environ.get("SUPABASE_ANON_KEY")  # Using anon key, not service role!
supabase = create_client(url, anon_key)

# Try to query without authentication (should return empty)
response = supabase.table('users').select('*').execute()
print(f"Unauthenticated query returned {len(response.data)} rows (should be 0)")

# Note: To fully test, you'd need to sign in a user first
```

---

## Step 7: Initial Data Seed (Optional)

If you want to add test data:

### 7.1 Add Test Client
```sql
INSERT INTO clients (
  monday_item_id,
  name,
  dpr_lead_id,
  monthly_rate,
  monthly_hours,
  campaign_type,
  campaign_start_date,
  is_active
) VALUES (
  9999999999,  -- Fake Monday ID for testing
  'Test Client Co',
  (SELECT id FROM users WHERE email = 'dani@studiohawk.com.au'),
  3000,
  15.79,  -- 3000 / 190
  'SEO & DPR Campaign',
  '2025-01-01',
  true
);
```

### 7.2 Add Test Sprint
```sql
INSERT INTO sprints (
  client_id,
  monday_subitem_id,
  name,
  sprint_number,
  start_date,
  end_date,
  kpi_target,
  kpi_achieved,
  monthly_rate
) VALUES (
  (SELECT id FROM clients WHERE monday_item_id = 9999999999),
  8888888888,  -- Fake Monday subitem ID
  'Test Sprint Q1',
  1,
  '2025-01-01',
  '2025-03-31',
  8,
  3,
  3000
);
```

### 7.3 Verify Data
```bash
python -c "
from supabase import create_client
import os
from dotenv import load_dotenv
load_dotenv()

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

clients = supabase.table('clients').select('*').execute()
print(f'Clients: {len(clients.data)}')

sprints = supabase.table('sprints').select('*').execute()
print(f'Sprints: {len(sprints.data)}')
"
```

---

## Step 8: What's Next?

Now that Supabase is set up, you can:

1. **Build ETL Functions:**
   - Create `sync_monday_data.py` to sync clients and sprints
   - Create `sync_clockify_data.py` to sync time entries
   - Use the Supabase client to insert/update data

2. **Set Up Supabase Edge Functions (Optional):**
   - For daily automated syncs
   - `supabase functions new monday-sync`
   - Deploy with `supabase functions deploy`

3. **Start Frontend Development:**
   - Initialize Next.js project
   - Install `@supabase/supabase-js`
   - Connect to your Supabase project
   - Build authentication flow
   - Create Sprint and Client views

---

## Troubleshooting

### Error: "relation does not exist"
- Schema wasn't created properly
- Re-run the `schema.sql` file
- Check SQL Editor for errors

### Error: "new row violates row-level security policy"
- Using anon key instead of service role key for admin operations
- RLS policies are blocking your insert
- Use service_role key for ETL/admin operations

### Can't connect to Supabase
- Check your `.env` file has correct values
- Verify Project URL is correct (no trailing slash)
- Make sure you're using the right API key (anon vs service_role)

### Email authentication not working
- Check email provider is enabled
- Verify email domain restriction is configured
- Check spam folder for magic link emails

---

## Security Checklist

Before going to production:

- [ ] Database password is strong and saved securely
- [ ] Service role key is never exposed to frontend
- [ ] RLS is enabled on all tables
- [ ] Email domain restriction is active (@studiohawk.com.au only)
- [ ] Environment variables are not committed to git (.env in .gitignore)
- [ ] Admin users are correctly seeded
- [ ] Test authentication flow
- [ ] Verify non-admin users can only see their clients

---

## Quick Reference

**Supabase Dashboard URLs:**
- Project: `https://supabase.com/dashboard/project/[project-id]`
- SQL Editor: `https://supabase.com/dashboard/project/[project-id]/sql`
- Table Editor: `https://supabase.com/dashboard/project/[project-id]/editor`
- Authentication: `https://supabase.com/dashboard/project/[project-id]/auth/users`
- API Settings: `https://supabase.com/dashboard/project/[project-id]/settings/api`

**Database Connection String:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```
(Found in Settings > Database)

**Python Supabase Client:**
```python
from supabase import create_client, Client
supabase: Client = create_client(supabase_url, supabase_key)
```

**Common Queries:**
```python
# Insert
supabase.table('users').insert({'email': '...', 'name': '...'}).execute()

# Select
supabase.table('clients').select('*').execute()

# Update
supabase.table('sprints').update({'kpi_achieved': 5}).eq('id', sprint_id).execute()

# Delete
supabase.table('time_entries').delete().eq('id', entry_id).execute()
```
