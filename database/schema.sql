-- ============================================================================
-- CLIENT REPORT SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- This schema supports tracking client sprints, team hours, and KPIs
-- Data sources: Monday.com (clients/sprints) + Clockify (time tracking)
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table: StudioHawk team members
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    clockify_user_id TEXT,
    monday_person_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for email lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_clockify_id ON users(clockify_user_id);
CREATE INDEX idx_users_monday_id ON users(monday_person_id);

-- Clients table: One row per client from Monday.com main items
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monday_item_id BIGINT UNIQUE NOT NULL,
    name TEXT NOT NULL,

    -- Team assignments
    dpr_lead_id UUID REFERENCES users(id),
    seo_lead_name TEXT,

    -- Contract details
    agency_value NUMERIC,
    client_priority TEXT,
    campaign_type TEXT,
    campaign_start_date DATE,

    -- Contract-level KPIs (from Monday.com)
    total_link_kpi INTEGER,
    total_links_achieved INTEGER,

    -- Monthly allocations
    monthly_rate NUMERIC,
    monthly_hours NUMERIC,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    report_status TEXT,
    last_report_date DATE,
    last_invoice_date DATE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for clients
CREATE INDEX idx_clients_monday_id ON clients(monday_item_id);
CREATE INDEX idx_clients_dpr_lead ON clients(dpr_lead_id);
CREATE INDEX idx_clients_active ON clients(is_active);
CREATE INDEX idx_clients_name ON clients(name);

-- Sprints table: One row per sprint from Monday.com subitems
CREATE TABLE sprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    monday_subitem_id BIGINT UNIQUE NOT NULL,

    -- Sprint identification
    name TEXT NOT NULL, -- e.g., "Sprint 1", "Q1 2025"
    sprint_number INTEGER, -- Auto-calculated based on order

    -- Sprint timeline
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,

    -- Sprint KPIs (from Monday.com subitem)
    kpi_target INTEGER NOT NULL, -- "Link KPI Per Quarter"
    kpi_achieved INTEGER DEFAULT 0, -- "Links Achieved Per Quarter"

    -- Status
    status TEXT DEFAULT 'active', -- 'active', 'completed', 'cancelled'

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_dates CHECK (end_date > start_date),
    CONSTRAINT valid_kpi_target CHECK (kpi_target >= 0),
    CONSTRAINT valid_kpi_achieved CHECK (kpi_achieved >= 0)
);

-- Indexes for sprints
CREATE INDEX idx_sprints_client ON sprints(client_id);
CREATE INDEX idx_sprints_monday_subitem ON sprints(monday_subitem_id);
CREATE INDEX idx_sprints_dates ON sprints(start_date, end_date);
CREATE INDEX idx_sprints_status ON sprints(status);

-- Clockify projects table
CREATE TABLE clockify_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clockify_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    client_id UUID REFERENCES clients(id),
    hourly_rate NUMERIC,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for clockify_projects
CREATE INDEX idx_clockify_projects_clockify_id ON clockify_projects(clockify_id);
CREATE INDEX idx_clockify_projects_client ON clockify_projects(client_id);

-- Time entries table: Individual time logs from Clockify
CREATE TABLE time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clockify_id TEXT UNIQUE NOT NULL,

    -- Relationships
    sprint_id UUID REFERENCES sprints(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES clockify_projects(id),

    -- Time entry details
    entry_date DATE NOT NULL,
    hours NUMERIC NOT NULL,
    description TEXT,

    -- Categorization
    task_category TEXT, -- 'comms', 'data', 'outreach', 'reporting', etc.
    project_name TEXT, -- Store original project name for reference

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_hours CHECK (hours >= 0 AND hours <= 24)
);

-- Indexes for time_entries
CREATE INDEX idx_time_entries_clockify_id ON time_entries(clockify_id);
CREATE INDEX idx_time_entries_sprint ON time_entries(sprint_id);
CREATE INDEX idx_time_entries_user ON time_entries(user_id);
CREATE INDEX idx_time_entries_date ON time_entries(entry_date);
CREATE INDEX idx_time_entries_project ON time_entries(project_id);

-- Sync logs table: Track data synchronization status
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source TEXT NOT NULL, -- 'monday', 'clockify'
    sync_start TIMESTAMPTZ NOT NULL,
    sync_end TIMESTAMPTZ,
    status TEXT NOT NULL, -- 'running', 'success', 'error'
    records_synced INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for sync_logs
CREATE INDEX idx_sync_logs_source ON sync_logs(source);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_created ON sync_logs(created_at DESC);

-- ============================================================================
-- CALCULATED FUNCTIONS
-- ============================================================================

-- Function: Calculate sprint health status
-- Returns: 'KPI Complete', 'Ahead', 'On Track', 'Behind', 'At Risk'
CREATE OR REPLACE FUNCTION calculate_sprint_health(
    p_sprint_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_kpi_target INTEGER;
    v_kpi_achieved INTEGER;
    v_monthly_hours NUMERIC;
    v_hours_used NUMERIC;
    v_days_total INTEGER;
    v_days_elapsed INTEGER;
    v_percent_time NUMERIC;
    v_percent_kpi NUMERIC;
    v_percent_hours NUMERIC;
BEGIN
    -- Get sprint and client data
    SELECT
        s.start_date,
        s.end_date,
        s.kpi_target,
        s.kpi_achieved,
        c.monthly_hours,
        COALESCE(SUM(te.hours), 0)
    INTO
        v_start_date,
        v_end_date,
        v_kpi_target,
        v_kpi_achieved,
        v_monthly_hours,
        v_hours_used
    FROM sprints s
    JOIN clients c ON s.client_id = c.id
    LEFT JOIN time_entries te ON te.sprint_id = s.id
    WHERE s.id = p_sprint_id
    GROUP BY s.start_date, s.end_date, s.kpi_target, s.kpi_achieved, c.monthly_hours;

    -- Calculate percentages
    v_days_total := v_end_date - v_start_date;
    v_days_elapsed := GREATEST(0, CURRENT_DATE - v_start_date);
    v_percent_time := (v_days_elapsed::NUMERIC / NULLIF(v_days_total, 0)) * 100;
    v_percent_kpi := (v_kpi_achieved::NUMERIC / NULLIF(v_kpi_target, 0)) * 100;

    -- Calculate hours allocation (3 months = quarterly)
    IF v_monthly_hours IS NOT NULL THEN
        v_percent_hours := (v_hours_used / NULLIF(v_monthly_hours * 3, 0)) * 100;
    ELSE
        v_percent_hours := 0;
    END IF;

    -- Determine health status
    -- KPI Complete
    IF v_percent_kpi >= 100 THEN
        RETURN 'KPI Complete';
    END IF;

    -- At Risk: More than 80% time elapsed with less than 60% KPI
    IF v_percent_time > 80 AND v_percent_kpi < 60 THEN
        RETURN 'At Risk';
    END IF;

    -- Behind: Time/hours significantly ahead of KPI progress
    IF v_percent_time > v_percent_kpi + 15 THEN
        RETURN 'Behind';
    END IF;

    IF v_percent_hours > v_percent_kpi + 20 THEN
        RETURN 'Behind';
    END IF;

    -- Ahead: KPI progress ahead of timeline
    IF v_percent_kpi > v_percent_time + 10 THEN
        RETURN 'Ahead';
    END IF;

    -- Default: On Track
    RETURN 'On Track';
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Calculate actual billable rate for a sprint
CREATE OR REPLACE FUNCTION calculate_billable_rate(
    p_sprint_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_monthly_rate NUMERIC;
    v_hours_used NUMERIC;
BEGIN
    SELECT
        c.monthly_rate,
        COALESCE(SUM(te.hours), 0)
    INTO
        v_monthly_rate,
        v_hours_used
    FROM sprints s
    JOIN clients c ON s.client_id = c.id
    LEFT JOIN time_entries te ON te.sprint_id = s.id
    WHERE s.id = p_sprint_id
    GROUP BY c.monthly_rate;

    IF v_hours_used > 0 AND v_monthly_rate IS NOT NULL THEN
        -- Monthly Rate * 3 months / hours used
        RETURN (v_monthly_rate * 3) / v_hours_used;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Calculate hours utilization percentage
CREATE OR REPLACE FUNCTION calculate_hours_utilization(
    p_sprint_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
    v_monthly_hours NUMERIC;
    v_hours_used NUMERIC;
BEGIN
    SELECT
        c.monthly_hours,
        COALESCE(SUM(te.hours), 0)
    INTO
        v_monthly_hours,
        v_hours_used
    FROM sprints s
    JOIN clients c ON s.client_id = c.id
    LEFT JOIN time_entries te ON te.sprint_id = s.id
    WHERE s.id = p_sprint_id
    GROUP BY c.monthly_hours;

    IF v_monthly_hours IS NOT NULL AND v_monthly_hours > 0 THEN
        -- (Hours used / (Monthly hours * 3)) * 100
        RETURN (v_hours_used / (v_monthly_hours * 3)) * 100;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Sprint metrics view: Pre-calculated metrics for each sprint
CREATE OR REPLACE VIEW sprint_metrics AS
SELECT
    s.id AS sprint_id,
    s.client_id,
    c.name AS client_name,
    s.name AS sprint_name,
    s.sprint_number,
    s.start_date,
    s.end_date,
    s.status,

    -- KPI metrics
    s.kpi_target,
    s.kpi_achieved,
    CASE
        WHEN s.kpi_target > 0 THEN ROUND((s.kpi_achieved::NUMERIC / s.kpi_target) * 100, 1)
        ELSE 0
    END AS kpi_progress_percent,

    -- Time metrics
    (s.end_date - s.start_date) AS days_total,
    GREATEST(0, CURRENT_DATE - s.start_date) AS days_elapsed,
    GREATEST(0, s.end_date - CURRENT_DATE) AS days_remaining,
    CASE
        WHEN (s.end_date - s.start_date) > 0 THEN
            ROUND((GREATEST(0, CURRENT_DATE - s.start_date)::NUMERIC / (s.end_date - s.start_date)) * 100, 1)
        ELSE 0
    END AS time_elapsed_percent,

    -- Hours metrics
    COALESCE(SUM(te.hours), 0) AS hours_used,
    c.monthly_hours * 3 AS hours_allocated,
    CASE
        WHEN c.monthly_hours > 0 THEN
            ROUND((COALESCE(SUM(te.hours), 0) / (c.monthly_hours * 3)) * 100, 1)
        ELSE 0
    END AS hours_utilization_percent,

    -- Financial metrics
    c.monthly_rate,
    c.monthly_rate * 3 AS sprint_revenue,
    CASE
        WHEN COALESCE(SUM(te.hours), 0) > 0 THEN
            ROUND((c.monthly_rate * 3) / COALESCE(SUM(te.hours), 1), 2)
        ELSE NULL
    END AS actual_billable_rate,

    -- Team
    c.dpr_lead_id,
    u.name AS dpr_lead_name,

    -- Health status (calculated)
    calculate_sprint_health(s.id) AS health_status

FROM sprints s
JOIN clients c ON s.client_id = c.id
LEFT JOIN users u ON c.dpr_lead_id = u.id
LEFT JOIN time_entries te ON te.sprint_id = s.id
GROUP BY
    s.id, s.client_id, c.name, s.name, s.sprint_number,
    s.start_date, s.end_date, s.status, s.kpi_target, s.kpi_achieved,
    c.monthly_hours, c.monthly_rate, c.dpr_lead_id, u.name;

-- Client contract metrics view: Aggregate data across all sprints
CREATE OR REPLACE VIEW client_contract_metrics AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    c.dpr_lead_id,
    u.name AS dpr_lead_name,
    c.campaign_type,
    c.agency_value,
    c.client_priority,
    c.campaign_start_date,

    -- Sprint counts
    COUNT(s.id) AS total_sprints,
    COUNT(s.id) FILTER (WHERE s.status = 'active') AS active_sprints,
    COUNT(s.id) FILTER (WHERE s.status = 'completed') AS completed_sprints,

    -- Contract-level KPIs from Monday.com
    c.total_link_kpi AS contract_kpi_target,
    c.total_links_achieved AS contract_kpi_achieved,
    CASE
        WHEN c.total_link_kpi > 0 THEN
            ROUND((c.total_links_achieved::NUMERIC / c.total_link_kpi) * 100, 1)
        ELSE 0
    END AS contract_kpi_percent,

    -- Aggregated sprint KPIs
    SUM(s.kpi_target) AS sprint_kpi_total,
    SUM(s.kpi_achieved) AS sprint_kpi_achieved,

    -- Hours aggregation
    c.monthly_hours,
    SUM(COALESCE(te.hours, 0)) AS total_hours_used,
    c.monthly_hours * 3 * COUNT(s.id) AS total_hours_allocated,
    CASE
        WHEN c.monthly_hours > 0 AND COUNT(s.id) > 0 THEN
            ROUND((SUM(COALESCE(te.hours, 0)) / (c.monthly_hours * 3 * COUNT(s.id))) * 100, 1)
        ELSE 0
    END AS overall_utilization_percent,

    -- Financial metrics
    c.monthly_rate,
    c.monthly_rate * 3 * COUNT(s.id) AS total_contract_revenue,
    CASE
        WHEN SUM(COALESCE(te.hours, 0)) > 0 THEN
            ROUND((c.monthly_rate * 3 * COUNT(s.id)) / SUM(COALESCE(te.hours, 0)), 2)
        ELSE NULL
    END AS avg_billable_rate,

    -- Current sprint
    MAX(s.sprint_number) FILTER (WHERE s.status = 'active') AS current_sprint_number,

    -- Status
    c.is_active,
    c.report_status,
    c.last_report_date

FROM clients c
LEFT JOIN users u ON c.dpr_lead_id = u.id
LEFT JOIN sprints s ON s.client_id = c.id
LEFT JOIN time_entries te ON te.sprint_id = s.id
GROUP BY
    c.id, c.name, c.dpr_lead_id, u.name, c.campaign_type,
    c.agency_value, c.client_priority, c.campaign_start_date,
    c.total_link_kpi, c.total_links_achieved, c.monthly_hours,
    c.monthly_rate, c.is_active, c.report_status, c.last_report_date;

-- Task breakdown view: Hours by task category per sprint
CREATE OR REPLACE VIEW task_breakdown AS
SELECT
    te.sprint_id,
    s.client_id,
    c.name AS client_name,
    s.name AS sprint_name,
    te.task_category,
    COUNT(te.id) AS entry_count,
    SUM(te.hours) AS total_hours,
    ROUND(AVG(te.hours), 2) AS avg_hours_per_entry,
    ROUND((SUM(te.hours) / NULLIF(total_sprint.hours, 0)) * 100, 1) AS percent_of_sprint
FROM time_entries te
JOIN sprints s ON te.sprint_id = s.id
JOIN clients c ON s.client_id = c.id
LEFT JOIN (
    SELECT sprint_id, SUM(hours) AS hours
    FROM time_entries
    GROUP BY sprint_id
) total_sprint ON total_sprint.sprint_id = te.sprint_id
WHERE te.task_category IS NOT NULL
GROUP BY
    te.sprint_id, s.client_id, c.name, s.name,
    te.task_category, total_sprint.hours
ORDER BY te.sprint_id, total_hours DESC;

-- User sprint breakdown view: Hours by user per sprint
CREATE OR REPLACE VIEW user_sprint_breakdown AS
SELECT
    te.sprint_id,
    s.client_id,
    c.name AS client_name,
    s.name AS sprint_name,
    te.user_id,
    u.name AS user_name,
    COUNT(te.id) AS entry_count,
    SUM(te.hours) AS total_hours,
    ROUND(AVG(te.hours), 2) AS avg_hours_per_entry,
    ROUND((SUM(te.hours) / NULLIF(total_sprint.hours, 0)) * 100, 1) AS percent_of_sprint,
    MIN(te.entry_date) AS first_entry_date,
    MAX(te.entry_date) AS last_entry_date
FROM time_entries te
JOIN sprints s ON te.sprint_id = s.id
JOIN clients c ON s.client_id = c.id
JOIN users u ON te.user_id = u.id
LEFT JOIN (
    SELECT sprint_id, SUM(hours) AS hours
    FROM time_entries
    GROUP BY sprint_id
) total_sprint ON total_sprint.sprint_id = te.sprint_id
GROUP BY
    te.sprint_id, s.client_id, c.name, s.name,
    te.user_id, u.name, total_sprint.hours
ORDER BY te.sprint_id, total_hours DESC;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE clockify_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can always see their own record
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (auth.uid()::TEXT = id::TEXT);

-- Policy: Admins can see all users
CREATE POLICY users_select_admin ON users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = auth.uid()::TEXT
            AND is_admin = TRUE
        )
    );

-- Policy: Admins can see all clients
CREATE POLICY clients_select_admin ON clients
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = auth.uid()::TEXT
            AND is_admin = TRUE
        )
    );

-- Policy: Non-admin users can see only their assigned clients
CREATE POLICY clients_select_assigned ON clients
    FOR SELECT
    USING (
        dpr_lead_id::TEXT = auth.uid()::TEXT
    );

-- Policy: Admins can see all sprints
CREATE POLICY sprints_select_admin ON sprints
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = auth.uid()::TEXT
            AND is_admin = TRUE
        )
    );

-- Policy: Non-admin users can see sprints for their assigned clients
CREATE POLICY sprints_select_assigned ON sprints
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = sprints.client_id
            AND clients.dpr_lead_id::TEXT = auth.uid()::TEXT
        )
    );

-- Policy: Admins can see all time entries
CREATE POLICY time_entries_select_admin ON time_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = auth.uid()::TEXT
            AND is_admin = TRUE
        )
    );

-- Policy: Non-admin users can see time entries for their assigned clients
CREATE POLICY time_entries_select_assigned ON time_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sprints
            JOIN clients ON clients.id = sprints.client_id
            WHERE sprints.id = time_entries.sprint_id
            AND clients.dpr_lead_id::TEXT = auth.uid()::TEXT
        )
    );

-- Policy: Users can see their own time entries
CREATE POLICY time_entries_select_own ON time_entries
    FOR SELECT
    USING (user_id::TEXT = auth.uid()::TEXT);

-- Policy: Admins can see all clockify projects
CREATE POLICY clockify_projects_select_admin ON clockify_projects
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = auth.uid()::TEXT
            AND is_admin = TRUE
        )
    );

-- Policy: Admins can see sync logs
CREATE POLICY sync_logs_select_admin ON sync_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id::TEXT = auth.uid()::TEXT
            AND is_admin = TRUE
        )
    );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON sprints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clockify_projects_updated_at BEFORE UPDATE ON clockify_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert admin users
INSERT INTO users (email, name, is_admin) VALUES
    ('dani@studiohawk.com.au', 'Dani', TRUE),
    ('georgia.anderson@studiohawk.com.au', 'Georgia Anderson', TRUE),
    ('daisy@studiohawk.com.au', 'Daisy', TRUE)
ON CONFLICT (email) DO UPDATE
    SET is_admin = EXCLUDED.is_admin,
        name = EXCLUDED.name;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'StudioHawk team members with role-based access';
COMMENT ON TABLE clients IS 'Client companies from Monday.com (main items)';
COMMENT ON TABLE sprints IS 'Individual sprints from Monday.com (subitems) - typically 3-month periods';
COMMENT ON TABLE time_entries IS 'Time tracking entries from Clockify';
COMMENT ON TABLE clockify_projects IS 'Projects from Clockify workspace';
COMMENT ON TABLE sync_logs IS 'Data synchronization audit trail';

COMMENT ON FUNCTION calculate_sprint_health IS 'Calculates sprint health: KPI Complete, Ahead, On Track, Behind, At Risk';
COMMENT ON FUNCTION calculate_billable_rate IS 'Calculates actual billable rate: (Monthly Rate * 3) / Hours Used';
COMMENT ON FUNCTION calculate_hours_utilization IS 'Calculates hours utilization percentage';

COMMENT ON VIEW sprint_metrics IS 'Comprehensive metrics for each sprint including KPI, time, hours, and health status';
COMMENT ON VIEW client_contract_metrics IS 'Aggregate metrics across all sprints for each client';
COMMENT ON VIEW task_breakdown IS 'Time distribution by task category per sprint';
COMMENT ON VIEW user_sprint_breakdown IS 'Time distribution by team member per sprint';
