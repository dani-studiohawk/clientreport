*   # Database Design Notes

**Last Updated:** December 5, 2025

This document captures important design decisions and implementation notes for the Client Report System database.

---

## Key Design Decisions

### 1. Sprint-Level vs Client-Level Monthly Rate

**Decision:** Store `monthly_rate` at BOTH client and sprint levels.

**Rationale:**
- Client-level rate (`clients.monthly_rate`) = default/current contract rate
- Sprint-level rate (`sprints.monthly_rate`) = actual rate for that specific sprint
- **Sprint rates can vary** between sprints for the same client
- All financial calculations must use `sprints.monthly_rate`, not client-level rate

**Real-world example:**
```
Client: Becextech
- Client monthly_rate: $3200 (current contract)
- Sprint 1-3: $3000/month (older rate)
- Sprint 4-5: $3200/month (rate increased mid-contract)
```

**Implementation:**
- Views and functions use `sprints.monthly_rate` for all calculations
- Client rate is reference/default only
- Sync process pulls both rates from Monday.com

---

### 2. DPR Lead Hierarchy

**Decision:** Client-level DPR Lead is authoritative.

**Context:**
- Monday.com has DPR Lead field at both client (main item) and sprint (subitem) levels
- **Client-level always takes precedence**
- Sprint-level DPR Lead is ignored/not synced

**Implementation:**
- Only `clients.dpr_lead_id` is stored and used
- RLS policies check client-level DPR Lead only
- Views join to `clients.dpr_lead_id` for reporting

**Why:**
- Client ownership doesn't typically change mid-contract
- Reduces data inconsistency
- Simpler access control logic

---

### 3. DPR Support Team

**Decision:** Support multiple support team members via array column.

**Schema:**
```sql
clients.dpr_support_ids UUID[]  -- Array of user IDs
```

**Mapping:**
- Monday.com field: `"DPR Support"` (people field, multiple selections allowed)
- Database: Array of internal user UUIDs

**Current Usage:**
- Field exists for future use
- Not currently used in RLS policies or views
- Can be expanded later for team-based access control

---

### 4. Sprint Naming and Numbering

**Discovery:** Sprint names are NOT standardized in Monday.com.

**Real-world examples:**
- `"Sprint #1"`, `"Sprint #2"`, `"Sprint #3"` (Becextech)
- `"Ongoing - Q1"`, `"Ongoing - Q2"` (Budget Pet Products)
- Custom names per client preference

**Implementation:**
- `sprints.name` stores the exact name from Monday.com
- `sprints.sprint_number` is pulled directly from Monday.com (not auto-calculated)
- `sprints.sprint_label` can store display labels
- `sprints.status` is auto-calculated by trigger based on dates

**Status Auto-Calculation:**
```sql
-- Trigger: auto_set_sprint_status()
IF end_date < CURRENT_DATE THEN status = 'completed'
ELSIF start_date > CURRENT_DATE THEN status = 'pending'
ELSE status = 'active'
```

---

### 5. Sprint Duration Variability

**Discovery:** Sprints are NOT always 3 months.

**Real-world examples:**
- 1 month sprint: `2024-08-05 to 2024-09-05`
- 2 month sprint: `2024-10-14 to 2024-12-14`
- 3 month sprint: `2025-01-20 to 2025-03-20` (typical)

**Implications:**
- Cannot assume `sprint_duration = 90 days`
- Revenue calculations: `sprint_revenue = monthly_rate × months_in_sprint`
- Health calculations use actual `days_total = end_date - start_date`

**Current Simplification:**
- Most calculations assume 3-month sprints (`monthly_rate × 3`)
- Hours allocation: `monthly_hours × 3`
- This is accurate for majority of sprints but may need refinement

---

### 6. Task Categorization

**Decision:** Use exact task names from Clockify dropdown.

**Evolution:**
- ❌ Initial approach: Keyword matching on description field
- ✅ Current approach: Store actual task names selected in Clockify

**Implementation:**
- `time_entries.task_category` stores the task name from Clockify
- Clockify has predefined tasks per project (dropdown selection)
- No auto-categorization or keyword matching needed

**Common task categories observed:**
- Client Communication
- Content Creation
- Data Analysis
- Link Outreach
- Monthly Reporting
- Strategy Planning

---

### 7. Monthly Hours Calculation

**Formula:** `monthly_hours = monthly_rate / 190`

**Rationale:**
- Standard StudioHawk billable rate: $190/hour
- Derives hours allocation from contract value
- Used for utilization calculations

**Implementation:**
- Stored as field in `clients.monthly_hours`
- Synced from Monday.com (pre-calculated there)
- Could be calculated on-the-fly but stored for query performance

---

### 8. Client-to-Sprint Relationship

**Structure:** One-to-Many (one client has many sprints)

**Constraints:**
- Each sprint belongs to exactly one client (`sprints.client_id`)
- Sprint dates can overlap for different clients (no global constraint)
- Sprint dates should NOT overlap for same client (data quality issue if they do)

**Sprint Assignment:**
- Time entries auto-assigned to sprints by date range
- `time_entry.entry_date` falls within `sprint.start_date` and `sprint.end_date`
- If multiple sprints match (shouldn't happen), undefined behavior

---

### 9. Time Entry to Sprint Assignment

**Decision:** Auto-assign based on date matching.

**Logic:**
```sql
-- During sync:
UPDATE time_entries te
SET sprint_id = s.id
FROM sprints s
WHERE te.entry_date BETWEEN s.start_date AND s.end_date
  AND s.client_id = te.client_id
```

**Edge Cases:**
- Entry before first sprint: `sprint_id = NULL`
- Entry after last sprint: `sprint_id = NULL`
- Entry between sprints (gap): `sprint_id = NULL`
- Entry during overlapping sprints: First match wins

**Implications:**
- Time entries need accurate `client_id` for proper sprint assignment
- Client-project mapping must be correct
- Orphaned entries (NULL sprint_id) are expected and valid

---

### 10. Row Level Security (RLS) Strategy

**Decision:** Role-based access with DPR Lead ownership model.

**Access Levels:**
1. **Admins** - Full access to everything
2. **DPR Leads** - Access to their assigned clients only
3. **Team Members** - Access to their own time entries

**Implementation Pattern:**
```sql
-- Every SELECT policy has two versions:
CREATE POLICY table_select_admin USING (is_current_user_admin());
CREATE POLICY table_select_assigned USING (
  dpr_lead_id IN (SELECT id FROM users WHERE email = auth_email())
);
```

**Authentication Chain:**
- `auth.uid()` → Supabase Auth user ID
- `auth_email()` → Email from auth.users table
- `users` table → Links email to internal user record
- RLS policies check against `users.is_admin` or `clients.dpr_lead_id`

---

## Data Sync Considerations

### Monday.com Sync

**Approach:**
- Fetch all board items (clients) and subitems (sprints)
- Upsert based on `monday_item_id` / `monday_subitem_id`
- Parse complex column values (people, dates, formulas)

**Challenges:**
- Column IDs vary by board (AU/US/UK boards have different IDs)
- Person fields need mapping to internal user UUIDs
- Lookup fields return arrays that need aggregation

### Clockify Sync

**Approach:**
- Fetch time entries for date range
- Map Clockify users to internal users by email
- Map projects to clients by name matching
- Auto-assign to sprints by date

**Challenges:**
- Project naming inconsistencies (e.g., "Client Name" vs "Client Name - SEO")
- Fuzzy matching needed for client-project mapping
- Tags stored as arrays need special handling

---

## Schema Maintenance

### Keeping Documentation Updated

Run this command to pull the latest schema from Supabase:
```bash
python scripts/pull_live_schema.py
```

This generates `database/schema_live.sql` with:
- All table definitions
- All indexes
- All functions
- All views
- All RLS policies

**Files to update after schema changes:**
1. `database/schema_live.sql` - Auto-generated (run script)
2. `database/README.md` - Manual update with context
3. `database/DESIGN_NOTES.md` - Update if design decisions change

---

## Known Limitations and Future Enhancements

### Current Limitations

1. **Overlapping sprints:** No database constraint prevents overlapping dates for same client
2. **Sprint duration assumption:** Most calculations assume 3-month sprints
3. **Single DPR Lead:** No support for shared client ownership
4. **Client-project mapping:** Name-based matching is fragile
5. **Task categorization:** Dependent on Clockify task setup

### Potential Enhancements

1. **Materialized views** for performance on large datasets
2. **Sprint overlap validation** via CHECK constraint or trigger
3. **Flexible sprint duration** calculations (auto-detect months)
4. **Client-project mapping table** for explicit relationships
5. **Historical DPR Lead tracking** (audit log of ownership changes)
6. **Automated sync scheduling** (currently manual/cron)
7. **Data quality monitoring** (orphaned entries, missing mappings)

---

## Real-World Data Examples

### Example Client: Budget Pet Products

```
Client ID: 8469593446
DPR Lead: Paige
Campaign Type: SEO & DPR Campaign
Monthly Rate: $3200
Monthly Hours: 17

Sprint 1: "Ongoing - Q1"
  - Dates: 2025-02-26 to 2025-05-26
  - KPI Target: 8 links
  - Monthly Rate: $3060
  
Sprint 2: "Ongoing - Q2"
  - Dates: 2025-05-26 to 2025-08-26
  - KPI Target: 8 links
  - KPI Achieved: 11 links ✅ (exceeded!)
  - Monthly Rate: $3060
```

### Example Client: Becextech

```
Sprint #1: 2024-08-05 to 2024-09-05 (1 month)
  - KPI: 8/8, Rate: $3000
  
Sprint #2: 2024-10-14 to 2024-12-14 (2 months)
  - KPI: 11/4 ⚠️ (exceeded target)
  - Rate: $3000
  
Sprint #3: 2025-01-20 to 2025-03-20 (3 months)
  - KPI: 5/8, Rate: $3000
  
Sprint #4: 2025-06-10 to 2025-09-10 (3 months)
  - KPI: 8/8, Rate: $3200 📈 (rate increased!)
```

**Observations:**
- Variable sprint durations (1-3 months)
- Mid-contract rate increases
- Some sprints exceed KPI targets significantly
