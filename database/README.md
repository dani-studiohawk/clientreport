# Database Schema Documentation

## Overview

This database schema supports the Client Report System, tracking client sprints, team hours, and KPIs by integrating data from Monday.com (client and sprint information) and Clockify (time tracking).

## Data Model

### Core Entities

```
users (Team Members)
  ↓
clients (Monday.com main items)
  ↓
sprints (Monday.com subitems) ← time_entries (Clockify)
  ↑                                    ↑
  └────────────────────────────────────┘
```

## Tables

### 1. **users**
StudioHawk team members with role-based access.

**Key Fields:**
- `email` - Unique email address (must be @studiohawk.com.au)
- `is_admin` - Admin privilege flag
- `clockify_user_id` - Links to Clockify user
- `monday_person_id` - Links to Monday.com person

**Admin Users:**
- dani@studiohawk.com.au
- georgia.anderson@studiohawk.com.au
- daisy@studiohawk.com.au

### 2. **clients**
One row per client from Monday.com main board items.

**Data Mapping (Monday.com → Database):**
- `monday_item_id` ← Item ID
- `name` ← Item Name
- `dpr_lead_id` ← "DPR Lead" person field
- `seo_lead_name` ← "SEO Lead" text field
- `agency_value` ← "Agency Value" lookup field
- `client_priority` ← "Client Priority" formula field
- `campaign_type` ← "Campaign Type" status field
- `campaign_start_date` ← "Campaign Start Date" date field
- `total_link_kpi` ← "Total Link KPI" lookup field
- `total_links_achieved` ← "Total Links Achieved" field
- `monthly_rate` ← Contract monthly rate (TBD: field name)
- `monthly_hours` ← "Monthly Hours" field
- `report_status` ← "Report Status" status field
- `last_report_date` ← "Report Date" date field
- `last_invoice_date` ← "Last Invoice Date" date field

### 3. **sprints**
One row per sprint from Monday.com subitems (typically 3-month periods).

**Data Mapping (Monday.com Subitems → Database):**
- `monday_subitem_id` ← Subitem ID
- `name` ← Subitem Name (e.g., "Sprint 1", "Q1 2025")
- `start_date` ← "Start Date" field
- `end_date` ← "End Date" field
- `kpi_target` ← "Link KPI Per Quarter" field
- `kpi_achieved` ← "Links Achieved Per Quarter" field
- `sprint_number` ← Auto-calculated based on order

**Sprint Health Calculation:**
The system automatically calculates sprint health based on:
- Time elapsed vs KPI progress
- Hours used vs KPI progress
- Current date vs sprint timeline

**Health Statuses:**
- **KPI Complete** - Target achieved
- **Ahead** - KPI progress > time elapsed + 10%
- **On Track** - Balanced progress
- **Behind** - Time/hours significantly ahead of KPI
- **At Risk** - 80%+ time elapsed with <60% KPI

### 4. **time_entries**
Individual time logs from Clockify.

**Data Mapping (Clockify → Database):**
- `clockify_id` ← Time entry ID
- `user_id` ← Maps Clockify user to internal user
- `entry_date` ← Time entry date
- `hours` ← Duration (converted to hours)
- `description` ← Time entry description
- `project_name` ← Clockify project name
- `sprint_id` ← Auto-assigned based on entry_date falling within sprint dates

**Task Categorization:**
Time entries are categorized into task types for reporting:
- `comms` - Communications, emails, meetings
- `data` - Data analysis, research
- `outreach` - PR outreach, link building
- `reporting` - Report creation, documentation
- `strategy` - Strategic planning
- etc.

### 5. **clockify_projects**
Projects from Clockify workspace, linked to clients.

### 6. **sync_logs**
Audit trail for data synchronization from Monday.com and Clockify.

## Views

### **sprint_metrics**
Comprehensive metrics for each sprint.

**Calculated Fields:**
- `kpi_progress_percent` - (kpi_achieved / kpi_target) × 100
- `days_elapsed` - Days since sprint start
- `days_remaining` - Days until sprint end
- `time_elapsed_percent` - Progress through sprint timeline
- `hours_used` - Sum of time entries
- `hours_allocated` - monthly_hours × 3
- `hours_utilization_percent` - (hours_used / hours_allocated) × 100
- `sprint_revenue` - monthly_rate × 3
- `actual_billable_rate` - sprint_revenue / hours_used
- `health_status` - Calculated sprint health

### **client_contract_metrics**
Aggregate metrics across all sprints for each client.

**Calculated Fields:**
- `total_sprints` - Count of all sprints
- `active_sprints` - Count of active sprints
- `completed_sprints` - Count of completed sprints
- `contract_kpi_percent` - Overall contract KPI progress
- `total_hours_used` - Sum across all sprints
- `total_hours_allocated` - Sum of all sprint allocations
- `overall_utilization_percent` - Contract-level utilization
- `total_contract_revenue` - Sum of all sprint revenue
- `avg_billable_rate` - Average rate across all sprints
- `current_sprint_number` - Latest active sprint

### **task_breakdown**
Hours distributed by task category per sprint.

Shows:
- Hours per task category
- Percentage of sprint time per task
- Entry count per task

### **user_sprint_breakdown**
Hours distributed by team member per sprint.

Shows:
- Hours per user
- Percentage of sprint time per user
- Entry count per user
- Date range of entries

## Functions

### **calculate_sprint_health(sprint_id)**
Returns sprint health status based on time/KPI/hours ratios.

**Logic:**
1. KPI Complete: kpi_achieved ≥ 100%
2. At Risk: 80%+ time with <60% KPI
3. Behind: Time/hours > KPI + threshold
4. Ahead: KPI > time + 10%
5. On Track: Balanced progress

### **calculate_billable_rate(sprint_id)**
Returns actual billable rate for a sprint.

**Formula:** `(monthly_rate × 3) / hours_used`

### **calculate_hours_utilization(sprint_id)**
Returns hours utilization percentage.

**Formula:** `(hours_used / (monthly_hours × 3)) × 100`

## Row Level Security (RLS)

Security policies ensure data access control:

### **Admin Users**
- Can see ALL clients, sprints, time entries
- Can see sync logs
- Can see all users

### **Non-Admin Users**
- Can see ONLY clients where they are the DPR Lead
- Can see ONLY sprints for their assigned clients
- Can see ONLY time entries for their assigned clients
- Can see their own time entries
- Can see their own user record

### **Implementation**
All policies check `auth.uid()` (Supabase authentication) against:
- `users.is_admin` for admin access
- `clients.dpr_lead_id` for client assignment

## Indexes

Performance indexes on:
- Foreign keys (sprint_id, client_id, user_id)
- Lookup fields (email, clockify_id, monday_item_id)
- Date fields (entry_date, start_date, end_date)
- Filter fields (is_active, status, is_admin)

## Data Synchronization

### **Monday.com Sync Process**
1. Fetch board items (clients)
2. Fetch subitems (sprints) for each client
3. Parse column values and map to database
4. Upsert clients and sprints
5. Update sync_logs

### **Clockify Sync Process**
1. Fetch time entries for date range
2. Fetch workspace users and projects
3. Map Clockify users to internal users by email
4. Map projects to clients (by name matching)
5. Assign time entries to sprints by date
6. Categorize time entries by task type
7. Upsert time_entries
8. Update sync_logs

## Usage Examples

### Query: Get sprint metrics for a DPR Lead's clients
```sql
SELECT *
FROM sprint_metrics
WHERE dpr_lead_id = auth.uid()
  AND status = 'active'
ORDER BY health_status, days_remaining;
```

### Query: Get at-risk sprints
```sql
SELECT
  client_name,
  sprint_name,
  kpi_progress_percent,
  time_elapsed_percent,
  health_status
FROM sprint_metrics
WHERE health_status IN ('At Risk', 'Behind')
  AND status = 'active'
ORDER BY days_remaining;
```

### Query: Get task breakdown for a sprint
```sql
SELECT
  task_category,
  total_hours,
  percent_of_sprint
FROM task_breakdown
WHERE sprint_id = '<sprint-uuid>'
ORDER BY total_hours DESC;
```

### Query: Get team member breakdown for a sprint
```sql
SELECT
  user_name,
  total_hours,
  percent_of_sprint
FROM user_sprint_breakdown
WHERE sprint_id = '<sprint-uuid>'
ORDER BY total_hours DESC;
```

## Migration & Deployment

### Initial Setup
1. Create Supabase project
2. Run `schema.sql` to create tables, functions, views
3. Enable RLS (already included in schema)
4. Configure authentication (email magic link)
5. Set up API keys as environment variables

### Seed Data
Admin users are automatically seeded via schema.sql

### Testing
1. Create test client records
2. Create test sprint records with various dates
3. Create test time entries
4. Verify RLS policies with different user roles
5. Test calculation functions with edge cases

## Future Enhancements

- Materialized views for performance (refresh on sync)
- Sprint auto-numbering trigger
- Task category auto-detection from descriptions
- Client-project mapping intelligence
- Historical data archival strategy
- Performance monitoring dashboard
