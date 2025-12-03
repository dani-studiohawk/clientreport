# Schema Review - Findings from Actual Data

## Data Structure Analysis

### ✅ Confirmed from Budget Pet Products Example

#### Client-Level Fields (Main Item)
```json
{
  "name": "Budget Pet Products",
  "id": "8469593446",
  "DPR Lead": "Paige" (person_id: 68445639),
  "SEO Lead": "James G.",
  "Campaign Type": "SEO & DPR Campaign",
  "Campaign Start Date": "2025-02-26",
  "Report Date": "2025-12-12",
  "Report Status": "Ready to Start",
  "Monthly Rate": "3200",  // ⚠️ Client default monthly rate
  "Monthly Hours": "17"    // ⚠️ Client default monthly hours
}
```

#### Sprint-Level Fields (Subitems)
```json
{
  "name": "Ongoing - Q1",  // ⚠️ Not always "Sprint #X" format
  "id": "9065123933",
  "DPR Lead": "Paige",     // Can override client-level DPR Lead
  "Start Date": "2025-02-26",
  "End Date": "2025-05-26",
  "Link KPI Per Quarter": "8",
  "Links Achieved Per Quarter": "0",
  "Monthly Rate (AUD)": "3060",  // ⚠️ Per-sprint rate, can differ from client!
  "Sprint": "Ongoing - Q1"       // Status field showing sprint label
}
```

**Example Sprint 2:**
```json
{
  "name": "Budget Pet Products",
  "Start Date": "2025-05-26",
  "End Date": "2025-08-26",
  "Link KPI Per Quarter": "8",
  "Links Achieved Per Quarter": "11",  // ✅ Exceeded target!
  "Monthly Rate (AUD)": "3060",
  "Sprint": "Ongoing - Q2"
}
```

## Key Discoveries

### 🔍 Discovery #1: Monthly Rate is at BOTH Client AND Sprint Level

**Client Level:**
- Field: `"Monthly Rate"` (field_id: `monthly_rate__usd__mkmdtr65`)
- Purpose: Default/current contract rate
- Example: `"3200"`

**Sprint Level:**
- Field: `"Monthly Rate (AUD)"` (field_id: `numeric_mkq022hv`)
- Purpose: Actual rate for that specific sprint
- Example: `"3060"`, `"3000"`, `"3200"`
- **Can vary between sprints** for the same client!

**Implication:**
- Calculations must use **sprint-level** monthly rate, not client-level
- Client-level rate is for reference/default only

### 🔍 Discovery #2: Sprint Names Are Not Standardized

**Observed naming patterns:**
- `"Sprint #1"`, `"Sprint #2"`, `"Sprint #3"` (Becextech)
- `"Ongoing - Q1"`, `"Ongoing - Q2"` (Budget Pet Products)
- Some missing (gaps in numbering)

**Solution:**
- Store the original `name` from Monday.com
- Auto-calculate `sprint_number` based on chronological order of `start_date`
- Use database trigger or calculation on insert/update

### 🔍 Discovery #3: Becextech Data Structure

From Becextech example:
```
Sprint #1: 2024-08-05 to 2024-09-05 (KPI: 8/8, Rate: 3000)
Sprint #2: 2024-10-14 to 2024-12-14 (KPI: 11/4, Rate: 3000)  ⚠️ Exceeded KPI!
Sprint #3: 2025-01-20 to 2025-03-20 (KPI: 5/8, Rate: 3000)
Sprint #4: 2025-06-10 to 2025-09-10 (KPI: 8/8, Rate: 3200)  ⚠️ Rate increased!
Sprint #5: 2025-09-10 to 2025-12-10 (KPI: 7/8, Rate: 3200)
```

**Observations:**
- Sprint durations vary (1-3 months, not strictly 3 months)
- Rates can increase mid-contract
- KPI targets can vary (4, 8)
- Some sprints overperform (11 links when target was 4)

### 🔍 Discovery #4: Clockify Task Categorization

**From user confirmation:**
> "clockify time tracking will have the task that was being worked on as part of the time log entry"

**What this means:**
- Clockify time entries have a `description` field
- Description contains the task/activity being worked on
- We need to parse/categorize these descriptions into task categories

**Proposed categories:**
- `comms` - Communications, emails, client meetings
- `data` - Data analysis, research
- `outreach` - PR outreach, link building, pitching
- `reporting` - Report creation, documentation
- `strategy` - Strategic planning, campaign planning
- `admin` - Administrative tasks
- `other` - Uncategorized

**Implementation approach:**
- Use keyword matching in description field
- Create a categorization function
- Examples:
  - "Client email" → `comms`
  - "Data research" → `data`  - "Outreach to journalists" → `outreach`
  - "Monthly report" → `reporting`

## Required Schema Changes

### ✅ Change #1: Add `monthly_rate` to Sprints Table

```sql
ALTER TABLE sprints ADD COLUMN monthly_rate NUMERIC;
```

**Rationale:** Each sprint has its own monthly rate that can differ from client default.

### ✅ Change #2: Update Calculation Functions to Use Sprint Rate

All functions that calculate billable rate must use `sprints.monthly_rate` instead of `clients.monthly_rate`.

**Before:**
```sql
SELECT c.monthly_rate * 3 / hours_used
FROM sprints s
JOIN clients c ON s.client_id = c.id
```

**After:**
```sql
SELECT s.monthly_rate * 3 / hours_used
FROM sprints s
```

### ✅ Change #3: Add Sprint Auto-Numbering

Create a trigger or function to auto-assign `sprint_number` based on chronological order:

```sql
CREATE OR REPLACE FUNCTION auto_number_sprint()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate sprint number based on start_date order within client
  NEW.sprint_number := (
    SELECT COUNT(*) + 1
    FROM sprints
    WHERE client_id = NEW.client_id
    AND start_date < NEW.start_date
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_number_sprint
  BEFORE INSERT OR UPDATE OF start_date ON sprints
  FOR EACH ROW
  EXECUTE FUNCTION auto_number_sprint();
```

### ✅ Change #4: Add Task Categorization Function

```sql
CREATE OR REPLACE FUNCTION categorize_task(description TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Convert to lowercase for matching
  description := LOWER(description);

  -- Check for keywords
  IF description ~* '(email|meeting|call|comms|communication|client contact)' THEN
    RETURN 'comms';
  ELSIF description ~* '(data|research|analysis|seo audit)' THEN
    RETURN 'data';
  ELSIF description ~* '(outreach|pitch|journalist|link building|pr)' THEN
    RETURN 'outreach';
  ELSIF description ~* '(report|reporting|documentation)' THEN
    RETURN 'reporting';
  ELSIF description ~* '(strategy|planning|campaign plan)' THEN
    RETURN 'strategy';
  ELSIF description ~* '(admin|administrative|internal meeting)' THEN
    RETURN 'admin';
  ELSE
    RETURN 'other';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```

### ✅ Change #5: Update Time Entries to Auto-Categorize

```sql
-- Add trigger to auto-categorize on insert
CREATE OR REPLACE FUNCTION auto_categorize_time_entry()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.task_category IS NULL AND NEW.description IS NOT NULL THEN
    NEW.task_category := categorize_task(NEW.description);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_categorize_time_entry
  BEFORE INSERT OR UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_categorize_time_entry();
```

## Updated Field Mappings

### Monday.com Main Items → `clients` Table

| Monday.com Field | Column ID | Database Column | Type | Notes |
|------------------|-----------|-----------------|------|-------|
| Item ID | - | `monday_item_id` | BIGINT | Unique identifier |
| Item Name | - | `name` | TEXT | Client name |
| DPR Lead | `person` | `dpr_lead_id` | UUID | Join to users via monday_person_id |
| DPR Support | `people__1` | - | - | TODO: Support multiple support team |
| SEO Lead | `text_mkne2whj` | `seo_lead_name` | TEXT | Name only (not person) |
| Agency Value | `lookup_mkwjkbrc` | `agency_value` | NUMERIC | |
| Client Priority | `formula_mkwjm5wa` | `client_priority` | TEXT | |
| Campaign Type | `color_mktjnwzv` | `campaign_type` | TEXT | |
| Campaign Start Date | `date4` | `campaign_start_date` | DATE | |
| Report Date | `date_mkthfjph` | - | - | Use last_report_date? |
| Report Status | `color_mktjbg6w` | `report_status` | TEXT | |
| Last Invoice Date | `date_mkm0hw39` | `last_invoice_date` | DATE | |
| Monthly Rate | `monthly_rate__usd__mkmdtr65` | `monthly_rate` | NUMERIC | **Default rate** |
| Monthly Hours | `numbers__1` | `monthly_hours` | NUMERIC | |
| Total Link KPI | - | `total_link_kpi` | INTEGER | Lookup/aggregation? |
| Total Links Achieved | - | `total_links_achieved` | INTEGER | Lookup/aggregation? |

### Monday.com Subitems → `sprints` Table

| Monday.com Field | Column ID | Database Column | Type | Notes |
|------------------|-----------|-----------------|------|-------|
| Subitem ID | - | `monday_subitem_id` | BIGINT | Unique identifier |
| Subitem Name | - | `name` | TEXT | e.g., "Ongoing - Q1" |
| DPR Lead | `person` | - | - | Can override client DPR Lead? |
| Start Date | `date0` | `start_date` | DATE | **Required** |
| End Date | `date_mkkzg40c` | `end_date` | DATE | **Required** |
| Link KPI Per Quarter | `numbers__1` | `kpi_target` | INTEGER | |
| Links Achieved Per Quarter | `numbers6__1` | `kpi_achieved` | INTEGER | |
| Monthly Rate (AUD) | `numeric_mkq022hv` | `monthly_rate` | NUMERIC | **Use this for calculations!** |
| Sprint | `status_1__1` | - | - | Status label (display only) |
| - | - | `sprint_number` | INTEGER | **Auto-calculated** from start_date order |

## Questions for Consideration

### 1. DPR Support Team
**Current issue:** Monday.com has `"DPR Support"` as a people field (array), but schema only has `dpr_lead_id` (single).

**Options:**
- A) Add `dpr_support_ids UUID[]` array column to clients
- B) Create separate `client_team_members` junction table
- C) Ignore for now, handle later

**Recommendation:** Option A (simple array column) for now.

### 2. Total Link KPI Fields
**Current issue:** Client has `"Total Link KPI"` and `"Total Links Achieved"` but these appear to be lookups/aggregations.

**Options:**
- A) Store in database and sync from Monday
- B) Calculate dynamically from SUM(sprints.kpi_target) and SUM(sprints.kpi_achieved)
- C) Use Monday.com values as source of truth

**Recommendation:** Option C (store from Monday) with periodic reconciliation against sprint sums.

### 3. Sprint Status
**Current issue:** Sprints have both calculated `status` (active/completed) and Monday field `"Sprint"` status.

**Options:**
- A) Store Monday status separately
- B) Derive status from dates (if end_date < today → completed)
- C) Manual management

**Recommendation:** Option B for calculated status, store Monday status as `sprint_label` for display.

### 4. Clockify Time Entry Endpoint
**Current issue:** The fetch script uses wrong endpoint and returns empty time_entries.

**Fix needed:**
```python
# Current (wrong):
time_entries_url = f'{base_url}/workspaces/{workspace_id}/time-entries?page-size=10'

# Should be:
time_entries_url = f'{base_url}/workspaces/{workspace_id}/user/{user_id}/time-entries?start={start_date}&end={end_date}'
```

**Recommendation:** Update fetch script to use reports API or proper time-entries endpoint.

## Next Steps

1. ✅ Update `sprints` table schema to include `monthly_rate`
2. ✅ Add sprint auto-numbering trigger
3. ✅ Add task categorization function
4. ✅ Update all calculation functions to use sprint.monthly_rate
5. ✅ Update views to reflect new structure
6. ⏸️ Consider adding `dpr_support_ids` array to clients
7. ⏸️ Update Clockify fetch script to get actual time entries
8. ⏸️ Create task categorization keyword rules (with user input)

## Summary

**Critical Changes Needed:**
1. **Add `monthly_rate` to sprints table** - Each sprint has its own rate
2. **Auto-number sprints** - Calculate sprint_number from chronological order
3. **Task categorization** - Auto-categorize time entries from description

**Minor Adjustments:**
1. Store sprint `name` as-is from Monday (not standardized)
2. Support DPR Support team array
3. Fix Clockify time entries fetch

**Clarifications Needed:**
1. Task categorization keyword rules (what descriptions map to which categories?)
2. Should sprint-level DPR Lead override client-level?
3. How to handle "Support" team assignments?
