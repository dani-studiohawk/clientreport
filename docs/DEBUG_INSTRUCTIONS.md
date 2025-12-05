# Debugging Sprint Date Matching Issues

## Problem
105 time entries couldn't find matching sprints during Clockify sync. The warnings show entries like:
- `⚠️ No sprint found for FrameShop on 2025-10-22`
- `⚠️ No sprint found for LHD Lawyers on 2025-10-16`
- `⚠️ No sprint found for Pillow Talk on 2025-10-16`

## Possible Causes

1. **Sprints don't exist** - Some clients may not have sprints created in Monday.com yet
2. **Sprint dates don't cover the period** - Sprint date ranges might not include the dates when work was logged
3. **Date gaps** - There might be gaps between sprint end and next sprint start
4. **Recent work** - Work logged very recently might be outside the latest sprint's end date

## How to Debug

### Option 1: Quick Check in Supabase SQL Editor

Run these queries in your Supabase SQL Editor:

#### 1. Check specific failing examples:

```sql
-- FrameShop on 2025-10-22
SELECT
    c.name as client,
    s.name as sprint,
    s.start_date,
    s.end_date,
    '2025-10-22'::date as entry_date,
    CASE
        WHEN s.start_date <= '2025-10-22' AND s.end_date >= '2025-10-22'
        THEN '✅ SHOULD MATCH'
        ELSE '❌ OUTSIDE RANGE'
    END as status
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE c.name ILIKE '%FrameShop%'
ORDER BY s.start_date;
```

Change the client name and date for each warning you want to investigate.

#### 2. Find clients with NO sprints:

```sql
SELECT
    c.name as client_name,
    COUNT(s.id) as sprint_count
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
GROUP BY c.name
HAVING COUNT(s.id) = 0
ORDER BY c.name;
```

#### 3. Check date coverage for active clients:

```sql
SELECT
    c.name as client,
    COUNT(s.id) as sprint_count,
    MIN(s.start_date) as earliest_sprint,
    MAX(s.end_date) as latest_sprint,
    CURRENT_DATE as today,
    CASE
        WHEN MAX(s.end_date) < CURRENT_DATE THEN '⚠️ All sprints ended'
        WHEN MIN(s.start_date) > CURRENT_DATE THEN '⚠️ All sprints future'
        ELSE '✅ Has current sprint'
    END as status
FROM clients c
LEFT JOIN sprints s ON s.client_id = c.id
WHERE c.is_active = true
GROUP BY c.id, c.name
ORDER BY status, c.name;
```

#### 4. Find the problematic time entries:

```sql
SELECT
    te.project_name,
    te.entry_date,
    COUNT(*) as entries,
    SUM(te.hours) as hours
FROM time_entries te
WHERE te.sprint_id IS NULL
  AND te.project_name IS NOT NULL
  AND te.project_name NOT IN ('Non-Client', 'StudioHawk', 'Internal')
GROUP BY te.project_name, te.entry_date
ORDER BY te.entry_date DESC
LIMIT 50;
```

### Option 2: Use the complete debug script

Run all queries in `debug_sprint_dates.sql` file in Supabase SQL Editor for a comprehensive analysis.

## Common Solutions

### If clients have NO sprints:
- Need to create sprints in Monday.com for these clients
- Or the Monday.com sync might have failed for these clients

### If sprint dates don't cover recent work:
- Option A: Extend the latest sprint's end date in Monday.com
- Option B: Create a new sprint in Monday.com for the current period
- Option C: Accept that recent work outside sprint ranges will have `sprint_id = NULL`

### If there are date gaps:
- Adjust sprint dates in Monday.com to be continuous
- Or accept that work during gaps will have `sprint_id = NULL`

## Next Steps

1. Run the SQL queries above to identify which situation applies
2. Share the results so we can determine the best fix:
   - Do the clients have sprints at all?
   - Are the sprint dates correct but don't cover recent work?
   - Are there specific clients that need new sprints created?

3. Depending on findings, we can:
   - Update Monday.com sprint dates and re-sync
   - Modify the sync logic if needed
   - Create missing sprints in Monday.com
