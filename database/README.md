# Database Schema Documentation

**Last Updated:** December 5, 2025  
**Supabase Project:** ylnrkfpchrzvuhqrnwco

## Overview

This database schema supports the Client Report System, tracking client sprints, team hours, and KPIs by integrating data from Monday.com (client and sprint information) and Clockify (time tracking).

**Current Schema Stats:**
- 6 Tables
- 25 Indexes
- 12 Functions
- 4 Views
- 12 RLS Policies

To update this documentation with the latest schema from Supabase:
```bash
python scripts/pull_live_schema.py
```

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

**Schema:**
```sql
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  monday_item_id bigint UNIQUE NOT NULL,
  name text NOT NULL,
  dpr_lead_id uuid,
  dpr_support_ids ARRAY,
  seo_lead_name text,
  agency_value numeric,
  client_priority text,
  campaign_type text,
  campaign_start_date date,
  total_link_kpi integer,
  total_links_achieved integer,
  monthly_rate numeric,
  monthly_hours numeric,
  is_active boolean DEFAULT true,
  report_status text,
  last_report_date date,
  last_invoice_date date,
  group_name text,
  region text,
  niche text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Data Mapping (Monday.com → Database):**
- `monday_item_id` ← Item ID (unique identifier)
- `name` ← Item Name
- `dpr_lead_id` ← "DPR Lead" person field (FK to users)
- `dpr_support_ids` ← Array of support team members
- `seo_lead_name` ← "SEO Lead" text field
- `agency_value` ← "Agency Value" lookup field
- `client_priority` ← "Client Priority" formula field
- `campaign_type` ← "Campaign Type" status field
- `campaign_start_date` ← "Campaign Start Date" date field
- `total_link_kpi` ← "Total Link KPI" lookup field
- `total_links_achieved` ← "Total Links Achieved" field
- `monthly_rate` ← Contract monthly rate
- `monthly_hours` ← "Monthly Hours" field
- `report_status` ← "Report Status" status field
- `last_report_date` ← "Report Date" date field
- `last_invoice_date` ← "Last Invoice Date" date field
- `group_name` ← Board group name (AU/US/UK)
- `region` ← Geographic region
- `niche` ← Client industry/niche

**Indexes:**
- `idx_clients_monday_id` - Fast lookup by Monday.com ID
- `idx_clients_dpr_lead` - Filter by DPR lead
- `idx_clients_active` - Filter active clients
- `idx_clients_name` - Search by name
- `idx_clients_group_name` - Filter by board group
- `idx_clients_region` - Filter by region

### 3. **sprints**
One row per sprint from Monday.com subitems (typically 3-month periods).

**Schema:**
```sql
CREATE TABLE public.sprints (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES clients(id),
  monday_subitem_id bigint UNIQUE NOT NULL,
  name text NOT NULL,
  sprint_number integer,
  sprint_label text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  kpi_target integer NOT NULL,
  kpi_achieved integer DEFAULT 0,
  monthly_rate numeric,
  status text DEFAULT 'active',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Data Mapping (Monday.com Subitems → Database):**
- `monday_subitem_id` ← Subitem ID (unique identifier)
- `name` ← Subitem Name (e.g., "Sprint 1", "Q1 2025")
- `start_date` ← "Start Date" field
- `end_date` ← "End Date" field
- `kpi_target` ← "Link KPI Per Quarter" field
- `kpi_achieved` ← "Links Achieved Per Quarter" field
- `sprint_number` ← Auto-calculated based on order
- `sprint_label` ← Human-readable label
- `monthly_rate` ← Sprint-specific monthly rate (can differ from contract)
- `status` ← Active/completed/pending (auto-set by trigger)

**Sprint Health Calculation:**
The system automatically calculates sprint health based on:
- Time elapsed vs KPI progress
- Hours used vs KPI progress
- Current date vs sprint timeline

**Health Statuses:**
- **KPI Complete** - Target achieved (≥100%)
- **Ahead** - KPI progress > time elapsed + 10%
- **On Track** - Balanced progress
- **Behind** - Time/hours significantly ahead of KPI progress
- **At Risk** - 80%+ time elapsed with <60% KPI

**Indexes:**
- `idx_sprints_monday_subitem` - Fast lookup by Monday.com subitem ID
- `idx_sprints_client` - Filter by client
- `idx_sprints_dates` - Date range queries
- `idx_sprints_status` - Filter by status

**Triggers:**
- `auto_set_sprint_status()` - Automatically updates status based on current date

### 4. **time_entries**
Individual time logs from Clockify.

**Schema:**
```sql
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clockify_id text UNIQUE NOT NULL,
  sprint_id uuid REFERENCES sprints(id),
  user_id uuid NOT NULL REFERENCES users(id),
  project_id uuid REFERENCES clockify_projects(id),
  client_id uuid REFERENCES clients(id),
  entry_date date NOT NULL,
  hours numeric NOT NULL,
  description text,
  task_category text,
  project_name text,
  tags ARRAY DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Data Mapping (Clockify → Database):**
- `clockify_id` ← Time entry ID (unique identifier)
- `user_id` ← Maps Clockify user to internal user
- `entry_date` ← Time entry date
- `hours` ← Duration (converted to hours)
- `description` ← Time entry description
- `project_name` ← Clockify project name
- `project_id` ← FK to clockify_projects table
- `client_id` ← FK to clients table (for direct reporting)
- `sprint_id` ← Auto-assigned based on entry_date falling within sprint dates
- `tags` ← Array of Clockify tags

**Task Categorization:**
Time entries are categorized into task types for reporting:
- `comms` - Communications, emails, meetings
- `data` - Data analysis, research
- `outreach` - PR outreach, link building
- `reporting` - Report creation, documentation
- `strategy` - Strategic planning

**Indexes:**
- `idx_time_entries_clockify_id` - Fast lookup by Clockify ID
- `idx_time_entries_sprint` - Filter by sprint
- `idx_time_entries_user` - Filter by user
- `idx_time_entries_project` - Filter by project
- `idx_time_entries_client` - Filter by client
- `idx_time_entries_date` - Date range queries
- `idx_time_entries_tags` - GIN index for tag array searches
- etc.

### 5. **clockify_projects**
Projects from Clockify workspace, linked to clients.

**Schema:**
```sql
CREATE TABLE public.clockify_projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  clockify_id text UNIQUE NOT NULL,
  name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  hourly_rate numeric,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

**Fields:**
- `clockify_id` - Unique Clockify project ID
- `name` - Project name from Clockify
- `client_id` - FK to clients table (mapped by name matching)
- `hourly_rate` - Project-specific hourly rate
- `is_active` - Active/archived status

**Indexes:**
- `idx_clockify_projects_clockify_id` - Fast lookup by Clockify ID
- `idx_clockify_projects_client` - Filter by client

### 6. **sync_logs**
Audit trail for data synchronization from Monday.com and Clockify.

**Schema:**
```sql
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source text NOT NULL,
  sync_start timestamp with time zone NOT NULL,
  sync_end timestamp with time zone,
  status text NOT NULL,
  records_synced integer DEFAULT 0,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);
```

**Fields:**
- `source` - 'monday' or 'clockify'
- `sync_start` - When sync began
- `sync_end` - When sync completed
- `status` - 'success', 'error', or 'in_progress'
- `records_synced` - Count of records processed
- `error_message` - Error details if failed

**Indexes:**
- `idx_sync_logs_source` - Filter by source system
- `idx_sync_logs_status` - Filter by status
- `idx_sync_logs_created` - Ordered by creation date (DESC)

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

**Signature:**
```sql
calculate_sprint_health(p_sprint_id uuid) RETURNS text
```

**Logic:**
1. **KPI Complete:** `kpi_achieved ≥ 100%` of target
2. **At Risk:** `time_elapsed > 80%` AND `kpi_progress < 60%`
3. **Behind:** `time_elapsed > kpi_progress + 15%` OR `hours_used% > kpi_progress + 20%`
4. **Ahead:** `kpi_progress > time_elapsed + 10%`
5. **On Track:** Balanced progress (default)

**Returns:** Text ('KPI Complete', 'At Risk', 'Behind', 'Ahead', 'On Track')

### **calculate_billable_rate(sprint_id)**
Returns actual billable rate for a sprint.

**Signature:**
```sql
calculate_billable_rate(p_sprint_id uuid) RETURNS numeric
```

**Formula:** `(monthly_rate × 3) / hours_used`

**Returns:** Numeric (hourly rate) or NULL if no hours logged

### **calculate_hours_utilization(sprint_id)**
Returns hours utilization percentage.

**Signature:**
```sql
calculate_hours_utilization(p_sprint_id uuid) RETURNS numeric
```

**Formula:** `(hours_used / (monthly_hours × 3)) × 100`

**Returns:** Numeric (percentage) or NULL if no allocation defined

### **get_sprint_hours(sprint_ids[])**
Efficiently calculates total hours for multiple sprints.

**Signature:**
```sql
get_sprint_hours(sprint_ids uuid[]) RETURNS TABLE(sprint_id uuid, total_hours numeric)
```

**Returns:** Table with sprint_id and total_hours for each sprint

**Security:** SECURITY DEFINER, STABLE

### **is_current_user_admin()**
Checks if the authenticated user is an admin.

**Signature:**
```sql
is_current_user_admin() RETURNS boolean
```

**Returns:** Boolean (true if admin, false otherwise)

**Used by:** RLS policies to grant admin access

### **is_admin(user_id)**
Checks if a specific user is an admin.

**Signature:**
```sql
is_admin(user_id uuid) RETURNS boolean
```

**Returns:** Boolean based on user's is_admin flag

### **auth_email()**
Gets the email address of the currently authenticated user.

**Signature:**
```sql
auth_email() RETURNS text
```

**Returns:** Email from auth.users for auth.uid()

**Security:** SECURITY DEFINER - access to auth schema

### **auto_set_sprint_status()**
Trigger function that automatically sets sprint status based on dates.

**Trigger:** BEFORE INSERT OR UPDATE on sprints

**Logic:**
- If `end_date < CURRENT_DATE` → 'completed'
- If `start_date > CURRENT_DATE` → 'pending'
- Otherwise → 'active'

### **check_email_domain()**
Trigger function that validates email domain.

**Trigger:** BEFORE INSERT OR UPDATE on users

**Validation:** Email must end with '@studiohawk.com.au'

**Raises Exception** if validation fails

### **update_updated_at_column()**
Trigger function that automatically updates the updated_at timestamp.

**Trigger:** BEFORE UPDATE on multiple tables

**Sets:** `NEW.updated_at = NOW()`

## Row Level Security (RLS)

All tables have RLS enabled. Security policies ensure data access control based on user roles.

### **Policies Overview**

| Table | Policy Name | Access Type | Condition |
|-------|-------------|-------------|-----------|
| **users** | users_select_admin | SELECT | User is admin |
| **users** | users_select_own | SELECT | User's own record |
| **clients** | clients_select_admin | SELECT | User is admin |
| **clients** | clients_select_assigned | SELECT | User is DPR lead |
| **sprints** | sprints_select_admin | SELECT | User is admin |
| **sprints** | sprints_select_assigned | SELECT | User is DPR lead for client |
| **time_entries** | time_entries_select_admin | SELECT | User is admin |
| **time_entries** | time_entries_select_assigned | SELECT | User is DPR lead for client |
| **time_entries** | time_entries_select_own | SELECT | User's own entries |
| **clockify_projects** | clockify_projects_select_admin | SELECT | User is admin |
| **clockify_projects** | clockify_projects_select_authenticated | SELECT | Any authenticated user |
| **sync_logs** | sync_logs_select_admin | SELECT | User is admin |

### **Admin Users**
Admins can access:
- ✅ ALL clients, sprints, time entries
- ✅ ALL user records
- ✅ Sync logs
- ✅ Clockify projects

### **Non-Admin Users (DPR Leads)**
Non-admins can access:
- ✅ Clients where they are the `dpr_lead_id`
- ✅ Sprints for their assigned clients
- ✅ Time entries for their assigned clients
- ✅ Their own time entries
- ✅ Their own user record
- ✅ All Clockify projects (read-only)
- ❌ Cannot see sync logs
- ❌ Cannot see other users' data

### **Implementation Details**
All policies use:
- `auth.uid()` - Current authenticated user's ID from Supabase Auth
- `auth_email()` - Helper function to get user's email
- `is_current_user_admin()` - Helper function to check admin status
- Joins to `users` table to match `auth.uid()` with user records

**Security Level:** SECURITY DEFINER functions allow controlled access to auth schema

## Indexes

Performance indexes are created on all frequently queried columns:

### **Clients Table** (6 indexes)
- `clients_pkey` - Primary key (id)
- `clients_monday_item_id_key` - Unique constraint on Monday.com ID
- `idx_clients_monday_id` - Fast lookup by Monday.com ID
- `idx_clients_dpr_lead` - Filter by DPR lead
- `idx_clients_active` - Filter active clients
- `idx_clients_name` - Search by name
- `idx_clients_group_name` - Filter by board group
- `idx_clients_region` - Filter by region

### **Sprints Table** (5 indexes)
- `sprints_pkey` - Primary key (id)
- `sprints_monday_subitem_id_key` - Unique constraint on Monday.com subitem ID
- `idx_sprints_monday_subitem` - Fast lookup by Monday.com ID
- `idx_sprints_client` - Filter by client (FK)
- `idx_sprints_dates` - Date range queries (composite: start_date, end_date)
- `idx_sprints_status` - Filter by status

### **Time Entries Table** (8 indexes)
- `time_entries_pkey` - Primary key (id)
- `time_entries_clockify_id_key` - Unique constraint on Clockify ID
- `idx_time_entries_clockify_id` - Fast lookup by Clockify ID
- `idx_time_entries_sprint` - Filter by sprint (FK)
- `idx_time_entries_user` - Filter by user (FK)
- `idx_time_entries_project` - Filter by project (FK)
- `idx_time_entries_client` - Filter by client (FK)
- `idx_time_entries_date` - Date range queries
- `idx_time_entries_tags` - GIN index for array searches

### **Users Table** (4 indexes)
- `users_pkey` - Primary key (id)
- `users_email_key` - Unique constraint on email
- `idx_users_email` - Fast lookup by email
- `idx_users_clockify_id` - Lookup by Clockify user ID
- `idx_users_monday_id` - Lookup by Monday.com person ID

### **Clockify Projects Table** (3 indexes)
- `clockify_projects_pkey` - Primary key (id)
- `clockify_projects_clockify_id_key` - Unique constraint on Clockify ID
- `idx_clockify_projects_clockify_id` - Fast lookup by Clockify ID
- `idx_clockify_projects_client` - Filter by client (FK)

### **Sync Logs Table** (4 indexes)
- `sync_logs_pkey` - Primary key (id)
- `idx_sync_logs_source` - Filter by source system
- `idx_sync_logs_status` - Filter by status
- `idx_sync_logs_created` - Ordered by creation date (DESC)

**Total: 30 indexes across 6 tables**

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
