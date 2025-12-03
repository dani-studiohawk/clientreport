# Schema Clarifications - Final Updates

## Clarifications Received

### 1. Sprint Numbering
**Previous approach:** Auto-calculate sprint_number from chronological order
**Updated approach:** Get sprint_number directly from Monday.com (already exists in their system)

**Field Mapping:**
- Monday.com has a sprint numbering system in place
- We'll extract this number and store it as-is (1, 2, 3, etc.)
- No auto-calculation needed

**Changes Made:**
- ✅ Updated `sprints.sprint_number` comment to indicate it comes from Monday.com
- ✅ Removed `auto_number_sprint()` function
- ✅ Removed sprint auto-numbering trigger
- ✅ Kept `auto_set_sprint_status()` function (still needed for status calculation)

---

### 2. Task Categorization
**Previous approach:** Keyword matching on description field to guess categories
**Updated approach:** Use actual task names from Clockify dropdown

**How it works:**
- Clockify has dropdown tasks that users select from when logging time
- These are predefined tasks per project
- We'll store the exact task name as selected by the user

**Changes Made:**
- ✅ Updated `fetch_clockify_data.py` to fetch tasks from projects
- ✅ Script now includes `all_task_names` list in output
- ✅ Removed `categorize_task()` function (no longer needed)
- ✅ Removed `auto_categorize_time_entry()` trigger
- ✅ Updated `time_entries.task_category` comment to clarify it's from Clockify dropdown

**Data Structure:**
```json
{
  "all_task_names": [
    "Client Communication",
    "Content Creation",
    "Data Analysis",
    "Link Outreach",
    "Monthly Reporting",
    "Strategy Planning",
    ...
  ]
}
```

---

### 3. DPR Support Team
**Previous:** Only single `dpr_lead_id` field
**Updated:** Added support for multiple support team members

**Changes Made:**
- ✅ Added `dpr_support_ids UUID[]` array column to `clients` table
- ✅ Can store multiple support team member IDs for future use

**Mapping:**
- Monday.com field: `"DPR Support"` (people field, can have multiple)
- Database: `clients.dpr_support_ids` (UUID array)

---

### 4. DPR Lead Hierarchy
**Clarification:** Client-level DPR Lead overrides sprint-level

**Behavior:**
- Monday.com has DPR Lead at both client (main item) and sprint (subitem) levels
- **Client-level is authoritative** - always use this one
- Sprint-level can be ignored or used for historical reference only

**Changes Made:**
- ✅ Updated `clients` table comment to clarify client-level overrides sprint-level
- ✅ Views and queries use `clients.dpr_lead_id` (not sprint-level)

---

### 5. Monthly Hours Calculation
**Formula:** `monthly_hours = monthly_rate / 190`

**Rationale:**
- Standard billable rate is $190/hour
- Monthly hours allocation is derived from monthly rate
- Applies to all sprints under the client

**Implementation Options:**

**Option A: Store in database** (currently implemented)
```sql
clients.monthly_hours NUMERIC  -- Stored value from Monday.com
```
- Pro: Faster queries, matches Monday.com structure
- Con: Needs to be kept in sync if rate changes

**Option B: Calculate on the fly**
```sql
CREATE VIEW client_metrics AS
SELECT
  *,
  monthly_rate / 190.0 AS monthly_hours
FROM clients;
```
- Pro: Always accurate, single source of truth
- Con: Slight performance hit, can't use in WHERE clauses directly

**Changes Made:**
- ✅ Updated `clients.monthly_hours` comment to document the calculation
- ✅ Keeping as stored field (matches Monday.com structure)
- ✅ ETL sync will calculate: `monthly_hours = monthly_rate / 190`

---

## Updated Data Mappings

### Monday.com Clients (Main Items)

| Monday Field | Column ID | Database Column | Notes |
|--------------|-----------|-----------------|-------|
| DPR Lead | `person` | `dpr_lead_id` | **Client-level is authoritative** |
| DPR Support | `people__1` | `dpr_support_ids` | Array of UUIDs |
| Monthly Rate | `monthly_rate__usd__mkmdtr65` | `monthly_rate` | |
| Monthly Hours | `numbers__1` | `monthly_hours` | Calculated: rate / 190 |

### Monday.com Sprints (Subitems)

| Monday Field | Column ID | Database Column | Notes |
|--------------|-----------|-----------------|-------|
| Sprint | `status_1__1` | `sprint_number` | Extract number (1, 2, 3) |
| DPR Lead | `person` | - | **Ignored - use client-level** |
| Start Date | `date0` | `start_date` | |
| End Date | `date_mkkzg40c` | `end_date` | |
| Monthly Rate (AUD) | `numeric_mkq022hv` | `monthly_rate` | Per-sprint rate |

### Clockify Time Entries

| Clockify Field | Database Column | Notes |
|----------------|-----------------|-------|
| task.name | `task_category` | Dropdown task name selected by user |
| description | `description` | Free-text description |
| duration | `hours` | Convert to decimal hours |
| project.name | `project_name` | For reference/mapping |

---

## Fetch Script Updates

### fetch_clockify_data.py

**New functionality:**
1. Fetches tasks for each project
2. Creates `all_task_names` array with unique task names
3. Stores tasks within each project object

**Output structure:**
```json
{
  "workspace": {...},
  "projects": [
    {
      "id": "...",
      "name": "Project Name",
      "tasks": [
        {"id": "...", "name": "Task Name", ...}
      ]
    }
  ],
  "all_task_names": ["Task 1", "Task 2", ...],
  "time_entries": [...],
  "users": [...],
  "clients": [...]
}
```

---

## Schema Summary

### Tables Changed

**clients:**
- Added: `dpr_support_ids UUID[]`
- Updated comment: `dpr_lead_id` (client-level overrides sprint)
- Updated comment: `monthly_hours` (calculated as rate / 190)

**sprints:**
- Updated comment: `sprint_number` (from Monday.com, not auto-calculated)

**time_entries:**
- Updated comment: `task_category` (from Clockify dropdown, not keyword-matched)

### Functions Removed

- ❌ `categorize_task()` - No longer needed (use actual task names)
- ❌ `auto_categorize_time_entry()` - No longer needed
- ❌ `auto_number_sprint()` - No longer needed (get from Monday.com)

### Functions Kept

- ✅ `calculate_sprint_health()` - Still needed
- ✅ `calculate_billable_rate()` - Still needed
- ✅ `calculate_hours_utilization()` - Still needed
- ✅ `auto_set_sprint_status()` - Still needed (status from dates)

### Triggers Updated

**Removed:**
- `trigger_auto_number_sprint`
- `trigger_auto_categorize_time_entry`

**Kept:**
- `trigger_auto_set_sprint_status` - Auto-sets pending/active/completed based on dates
- All `update_updated_at` triggers

---

## Next Steps

### 1. Test Clockify Fetch Script
Run the updated script to see what tasks are available:
```bash
python fetch_clockify_data.py
```

Then check the output:
```bash
jq '.all_task_names' clockify_data_structure.json
```

### 2. Verify Sprint Number Field in Monday.com
Need to confirm:
- Which Monday.com field contains the sprint number?
- Is it the `"Sprint"` status field? (e.g., "Sprint #1" → extract "1")
- Or is there a separate numeric field?

### 3. Map DPR Support IDs
When syncing from Monday.com:
- Parse `"DPR Support"` people array
- Map Monday person IDs to internal user UUIDs
- Store as array in `dpr_support_ids`

### 4. Calculate Monthly Hours in ETL
When syncing clients from Monday.com:
```python
monthly_rate = client_data['monthly_rate']
monthly_hours = monthly_rate / 190.0  # Standard billable rate
```

---

## Questions Resolved

✅ **Q: How are sprint numbers assigned?**
A: Monday.com already has sprint numbers (1, 2, 3...). We'll extract and use those.

✅ **Q: How do we categorize time entries?**
A: Clockify has dropdown tasks that users select. Use those exact names.

✅ **Q: Should we support multiple DPR Support members?**
A: Yes, added array column for future use.

✅ **Q: Which DPR Lead takes precedence - client or sprint level?**
A: Client-level overrides sprint-level. Always use client's DPR Lead.

✅ **Q: How is monthly_hours calculated?**
A: `monthly_hours = monthly_rate / 190` (standard billable rate)
