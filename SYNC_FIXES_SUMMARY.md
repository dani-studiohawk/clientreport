# Sync Fixes Summary

## Issues Fixed

### 1. Post-Sprint Time Entries (Clockify Sync)
**Problem:** Time entries logged after sprint end dates were being skipped, resulting in lost data.

**Solution:**
- Added a `tags` column to the `time_entries` table
- Time entries outside sprint ranges are now tagged as `post_sprint_work`
- These entries are still synced (not skipped) so no data is lost
- They can be reviewed later using: `SELECT * FROM time_entries WHERE 'post_sprint_work' = ANY(tags);`

**Files Modified:**
- `sync_clockify_data.py` - Updated to tag post-sprint entries instead of skipping them
- `database/migrations/add_tags_to_time_entries.sql` - New migration

### 2. Inactive/Finished Clients Not Syncing (Monday.com Sync)
**Problem:** Only active clients were being synced from Monday.com boards.

**Solution:**
- Modified sync to pull ALL clients regardless of status
- Added `group_name` column to track which Monday.com group each client belongs to
- Added smart detection of `is_active` status based on group keywords (finished, refunded, cancelled, etc.)
- Added visual indicators: ✅ for active clients, 💤 for inactive

**Files Modified:**
- `sync_monday_data.py` - Updated `parse_client_item()` to use group title for status detection
- `database/migrations/add_group_name_to_clients.sql` - New migration

### 3. Missing Region/Country Tracking
**Problem:** No way to identify which board/country a client belongs to.

**Solution:**
- Added `region` column to `clients` table
- Automatically captured during sync (AU, US, UK)

**Files Modified:**
- `sync_monday_data.py` - Updated to pass and store region
- `database/migrations/add_region_to_clients.sql` - New migration

## Migrations to Run

Run these SQL commands in Supabase SQL Editor:

```sql
-- 1. Add tags to time_entries
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_time_entries_tags ON time_entries USING GIN(tags);

COMMENT ON COLUMN time_entries.tags IS 'Array of tags for categorizing time entries. Examples: post_sprint_work, unassigned, overtime, etc.';

-- 2. Add group_name to clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS group_name TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_group_name ON clients(group_name);

COMMENT ON COLUMN clients.group_name IS 'Monday.com board group name (e.g., "Active", "Finished", "Refunded"). Used to determine client status.';

-- 3. Add region to clients
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_region ON clients(region);

COMMENT ON COLUMN clients.region IS 'Board region/country code (AU, US, UK) indicating which Monday.com board the client is from.';
```

## Testing Instructions

After running migrations:

1. **Test Monday.com sync:**
   ```bash
   python sync_monday_data.py
   ```
   - Should show all clients including inactive ones
   - Watch for ✅ (active) and 💤 (inactive) indicators
   - Check console output shows group names and item counts

2. **Test Clockify sync:**
   ```bash
   python sync_clockify_data.py
   ```
   - Should show warnings for post-sprint work with "tagging as post_sprint_work" message
   - These entries should now be synced instead of skipped

3. **Verify data in Supabase:**
   ```sql
   -- Check clients with regions and groups
   SELECT name, region, group_name, is_active FROM clients ORDER BY region, is_active DESC;

   -- Check post-sprint time entries
   SELECT project_name, entry_date, hours, tags
   FROM time_entries
   WHERE 'post_sprint_work' = ANY(tags)
   ORDER BY entry_date DESC;
   ```

## Missing Clients Investigation

If clients like "Lifespan Fitness" or "Pack & Send" are still missing:

1. Check they exist in Monday.com boards
2. Check they're not in a filtered/hidden group
3. Look at the sync output for which groups were processed
4. Verify the board IDs in `.env` are correct

The enhanced logging now shows:
- Number of groups found per board
- Number of items in each group
- Each client being processed with status indicator
