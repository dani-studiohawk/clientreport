-- ============================================================================
-- FIX RLS POLICIES TO USE EMAIL MATCHING
-- ============================================================================
-- The issue: auth.uid() returns the Supabase Auth user ID, but our users table
-- has its own UUIDs. We need to match by email instead.

-- Drop existing policies
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_select_admin ON users;
DROP POLICY IF EXISTS clients_select_admin ON clients;
DROP POLICY IF EXISTS clients_select_assigned ON clients;
DROP POLICY IF EXISTS sprints_select_admin ON sprints;
DROP POLICY IF EXISTS sprints_select_assigned ON sprints;
DROP POLICY IF EXISTS time_entries_select_admin ON time_entries;
DROP POLICY IF EXISTS time_entries_select_assigned ON time_entries;
DROP POLICY IF EXISTS time_entries_select_own ON time_entries;
DROP POLICY IF EXISTS clockify_projects_select_admin ON clockify_projects;
DROP POLICY IF EXISTS sync_logs_select_admin ON sync_logs;

-- Helper function: Get current user's email from auth.users
CREATE OR REPLACE FUNCTION auth_email()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE;

-- Helper function: Check if current user is admin (using email)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM users WHERE email = auth_email()),
    FALSE
  );
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Users can see their own record (by email match)
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (email = auth_email());

-- Admins can see all users
CREATE POLICY users_select_admin ON users
    FOR SELECT
    USING (is_current_user_admin());

-- ============================================================================
-- CLIENTS TABLE POLICIES
-- ============================================================================

-- Admins can see all clients
CREATE POLICY clients_select_admin ON clients
    FOR SELECT
    USING (is_current_user_admin());

-- Non-admin users can see their assigned clients
CREATE POLICY clients_select_assigned ON clients
    FOR SELECT
    USING (
        dpr_lead_id IN (
            SELECT id FROM users WHERE email = auth_email()
        )
    );

-- ============================================================================
-- SPRINTS TABLE POLICIES
-- ============================================================================

-- Admins can see all sprints
CREATE POLICY sprints_select_admin ON sprints
    FOR SELECT
    USING (is_current_user_admin());

-- Non-admin users can see sprints for their assigned clients
CREATE POLICY sprints_select_assigned ON sprints
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = sprints.client_id
            AND clients.dpr_lead_id IN (
                SELECT id FROM users WHERE email = auth_email()
            )
        )
    );

-- ============================================================================
-- TIME ENTRIES TABLE POLICIES
-- ============================================================================

-- Admins can see all time entries
CREATE POLICY time_entries_select_admin ON time_entries
    FOR SELECT
    USING (is_current_user_admin());

-- Non-admin users can see time entries for their assigned clients
CREATE POLICY time_entries_select_assigned ON time_entries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM sprints
            JOIN clients ON clients.id = sprints.client_id
            WHERE sprints.id = time_entries.sprint_id
            AND clients.dpr_lead_id IN (
                SELECT id FROM users WHERE email = auth_email()
            )
        )
    );

-- Users can see their own time entries
CREATE POLICY time_entries_select_own ON time_entries
    FOR SELECT
    USING (
        user_id IN (
            SELECT id FROM users WHERE email = auth_email()
        )
    );

-- ============================================================================
-- CLOCKIFY PROJECTS TABLE POLICIES
-- ============================================================================

-- Admins can see all clockify projects
CREATE POLICY clockify_projects_select_admin ON clockify_projects
    FOR SELECT
    USING (is_current_user_admin());

-- All authenticated users can see clockify projects (needed for lookups)
CREATE POLICY clockify_projects_select_authenticated ON clockify_projects
    FOR SELECT
    USING (auth.uid() IS NOT NULL);

-- ============================================================================
-- SYNC LOGS TABLE POLICIES
-- ============================================================================

-- Admins can see sync logs
CREATE POLICY sync_logs_select_admin ON sync_logs
    FOR SELECT
    USING (is_current_user_admin());
