# Data Sync Guide

This guide explains how to sync data from Monday.com and Clockify into Supabase.

---

## Prerequisites

1. ✅ Supabase project deployed with schema
2. ✅ Environment variables configured in `.env`:
   ```bash
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
   MONDAY_API_KEY=your_monday_api_key
   MONDAY_AU_BOARD_ID=your_board_id
   CLOCKIFY_API_KEY=your_clockify_api_key
   CLOCKIFY_WORKSPACE_ID=your_workspace_id
   ```

3. ✅ Python packages installed:
   ```bash
   pip install supabase requests python-dotenv
   ```

---

## Step 1: Sync Users (First Time Setup)

Before syncing clients and time entries, you need to populate the users table with your team members.

### Option A: Manual User Creation (Recommended for first time)

Go to Supabase dashboard → Table Editor → users table, and add team members:

| email | name | is_admin | clockify_user_id | monday_person_id |
|-------|------|----------|------------------|------------------|
| paige@studiohawk.com.au | Paige | false | (from Clockify) | 68445639 |
| janine.tan.pacis@studiohawk.com.au | Janine Tan Pacis | false | (from Clockify) | 49331015 |
| ... | ... | ... | ... | ... |

**How to find IDs:**

**Monday Person IDs:**
1. Run `python fetch_monday_data.py`
2. Open `monday_board_structure.json`
3. Search for DPR Lead values, e.g.:
   ```json
   "value": "{\"personsAndTeams\":[{\"id\":68445639,\"kind\":\"person\"}]}"
   ```
   → Person ID is `68445639`

**Clockify User IDs:**
1. Run `python fetch_clockify_data.py`
2. Open `clockify_data_structure.json`
3. Look in the `users` array:
   ```json
   {
     "id": "679c0e559b5954747a4001b3",
     "email": "paige@studiohawk.com.au",
     "name": "Paige Claydon"
   }
   ```

### Option B: Auto-Create Users from Clockify (Future Enhancement)

Create a `sync_users.py` script that:
1. Fetches all users from Clockify
2. Creates user records in Supabase
3. You manually update Monday person IDs later

---

## Step 2: Sync Clients and Sprints from Monday.com

Run the Monday.com sync script:

```bash
python sync_monday_data.py
```

**What it does:**
1. Fetches all board items (clients) and subitems (sprints)
2. Maps Monday person IDs to internal user UUIDs
3. Extracts sprint numbers from labels (Q1 = 1, Q2 = 2, etc.)
4. Calculates monthly hours (rate / 190)
5. Upserts clients and sprints to Supabase

**Expected output:**
```
🔄 Starting Monday.com sync...
📥 Fetching board data from Monday.com...

📂 Processing group: Active Campaigns - AU
  ✅ Client: Budget Pet Products
    ↳ Sprint: Budget Pet Products (Q1)
    ↳ Sprint: Budget Pet Products (Q2)
  ✅ Client: Becextech
    ↳ Sprint: Becextech #1
    ↳ Sprint: Becextech #2
    ...

✅ Sync complete!
   Clients synced: 15
   Sprints synced: 42
```

**Verify in Supabase:**
```sql
-- Check clients
SELECT name, dpr_lead_id, monthly_rate, monthly_hours FROM clients;

-- Check sprints
SELECT c.name, s.name, s.sprint_number, s.start_date, s.end_date, s.kpi_target
FROM sprints s
JOIN clients c ON s.client_id = c.id
ORDER BY c.name, s.sprint_number;
```

---

## Step 3: Sync Time Entries from Clockify

Run the Clockify sync script:

```bash
python sync_clockify_data.py
```

**What it does:**
1. Fetches time entries for all users (last 90 days by default)
2. Maps Clockify users to internal users by email
3. Maps Clockify projects to clients by name matching
4. Assigns time entries to sprints based on entry date
5. Extracts task name from Clockify task dropdown
6. Upserts time_entries to Supabase

**Expected output:**
```
🔄 Starting Clockify sync (last 90 days)...
📥 Fetching Clockify users...
   Found 12 users
📥 Fetching Clockify projects...
   Found 24 projects
   ✓ Mapped project 'Budget Pet Products' to client
   ✓ Mapped project 'Becextech' to client
   ...

👤 Processing user: Paige Claydon
   Found 142 time entries
   ✅ Synced 138 entries

👤 Processing user: Janine Tan Pacis
   Found 98 time entries
   ✅ Synced 95 entries
   ...

✅ Sync complete!
   Time entries synced: 856
   Entries skipped: 23
```

**Why entries might be skipped:**
- Entry has 0 hours (running timer not stopped)
- Project not mapped to a client
- Entry date doesn't fall within any sprint dates
- User not found in system

**Verify in Supabase:**
```sql
-- Check time entries
SELECT
  u.name as user_name,
  c.name as client_name,
  s.name as sprint_name,
  te.entry_date,
  te.hours,
  te.task_category
FROM time_entries te
JOIN users u ON te.user_id = u.id
JOIN sprints s ON te.sprint_id = s.id
JOIN clients c ON s.client_id = c.id
ORDER BY te.entry_date DESC
LIMIT 20;

-- Check sync logs
SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 10;
```

---

## Step 4: Test the Views

Check that calculated views are working:

```sql
-- Sprint metrics
SELECT
  client_name,
  sprint_name,
  kpi_progress_percent,
  hours_used,
  hours_allocated,
  health_status
FROM sprint_metrics
WHERE status = 'active'
ORDER BY health_status, days_remaining;

-- Client contract metrics
SELECT
  client_name,
  total_sprints,
  contract_kpi_percent,
  avg_billable_rate
FROM client_contract_metrics
WHERE is_active = true;

-- Task breakdown for a sprint
SELECT * FROM task_breakdown WHERE sprint_id = 'your-sprint-uuid';

-- User breakdown for a sprint
SELECT * FROM user_sprint_breakdown WHERE sprint_id = 'your-sprint-uuid';
```

---

## Sync Schedule

### Manual Syncing (For Now)

Run these commands whenever you want to refresh data:

```bash
# Sync clients and sprints (run when board structure changes)
python sync_monday_data.py

# Sync time entries (run daily to get latest hours)
python sync_clockify_data.py
```

### Automated Daily Sync (Future)

**Option A: Cron Job**
```bash
# Add to crontab (Linux/Mac)
0 2 * * * cd /path/to/clientreport && python sync_monday_data.py && python sync_clockify_data.py
```

**Option B: Supabase Edge Functions**
1. Convert sync scripts to Deno/TypeScript
2. Deploy as Edge Functions
3. Schedule with `pg_cron` or external scheduler

**Option C: GitHub Actions**
```yaml
# .github/workflows/daily-sync.yml
name: Daily Data Sync
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install supabase requests python-dotenv
      - run: python sync_monday_data.py
      - run: python sync_clockify_data.py
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      MONDAY_API_KEY: ${{ secrets.MONDAY_API_KEY }}
      MONDAY_AU_BOARD_ID: ${{ secrets.MONDAY_AU_BOARD_ID }}
      CLOCKIFY_API_KEY: ${{ secrets.CLOCKIFY_API_KEY }}
      CLOCKIFY_WORKSPACE_ID: ${{ secrets.CLOCKIFY_WORKSPACE_ID }}
```

---

## Troubleshooting

### "User not found in system"

**Problem:** Clockify user email doesn't match any user in Supabase `users` table.

**Solution:**
1. Check user email in Clockify vs Supabase
2. Add user to Supabase users table
3. Ensure email is lowercase
4. Re-run sync

### "Project not mapped to client"

**Problem:** Clockify project name doesn't match any client name.

**Solution:**
1. Check project name in Clockify: `clockify_data_structure.json` → `projects` array
2. Check client name in Monday: `monday_board_structure.json` → item `name`
3. Names must be similar (fuzzy matching is used)
4. Manually create `clockify_projects` record with client mapping:
   ```sql
   INSERT INTO clockify_projects (clockify_id, name, client_id)
   VALUES ('clockify-project-id', 'Project Name', 'client-uuid');
   ```

### "Sprint not found for date"

**Problem:** Time entry date doesn't fall within any sprint's start/end dates.

**Solution:**
1. Check sprint dates in Supabase
2. Ensure sprints cover all time periods
3. Time entry might be logged outside of active sprints
4. Check if client has sprints created

### "Monday person ID not mapped"

**Problem:** Monday.com person ID doesn't have a matching user in Supabase.

**Solution:**
1. Find person ID from Monday data
2. Add `monday_person_id` to corresponding user record:
   ```sql
   UPDATE users
   SET monday_person_id = 68445639
   WHERE email = 'paige@studiohawk.com.au';
   ```

### "Infinite recursion detected in policy"

**Problem:** RLS policy error (should be fixed in schema).

**Solution:**
1. Run `database/fix_rls_recursion.sql` in Supabase SQL Editor
2. Or re-deploy the updated schema

---

## Data Quality Checks

After syncing, run these queries to verify data quality:

```sql
-- Clients without DPR Lead
SELECT name FROM clients WHERE dpr_lead_id IS NULL;

-- Sprints without monthly rate
SELECT c.name, s.name FROM sprints s
JOIN clients c ON s.client_id = c.id
WHERE s.monthly_rate IS NULL;

-- Time entries without task category
SELECT COUNT(*) FROM time_entries WHERE task_category IS NULL;

-- Orphaned time entries (no sprint)
SELECT COUNT(*) FROM time_entries WHERE sprint_id IS NULL;

-- Users not mapped to Monday or Clockify
SELECT name, email,
       monday_person_id IS NULL as no_monday,
       clockify_user_id IS NULL as no_clockify
FROM users
WHERE NOT is_admin;
```

---

## Maintenance

### Update User Mappings

When a new team member joins:

1. Add to Supabase `users` table
2. Set `email` (from Clockify)
3. Set `monday_person_id` (from Monday.com)
4. Set `clockify_user_id` (from Clockify)
5. Re-run sync scripts

### Clean Up Old Data

Periodically archive old time entries:

```sql
-- Archive entries older than 1 year
CREATE TABLE time_entries_archive AS
SELECT * FROM time_entries
WHERE entry_date < CURRENT_DATE - INTERVAL '1 year';

DELETE FROM time_entries
WHERE entry_date < CURRENT_DATE - INTERVAL '1 year';
```

---

## Next Steps

Once data is syncing correctly:

1. **Build Frontend:** Start building the dashboard with real data
2. **Automate Syncs:** Set up daily automated sync
3. **Add Monitoring:** Set up alerts for sync failures
4. **Optimize Queries:** Add indexes based on actual query patterns
5. **Add Features:** User management, client management, etc.
