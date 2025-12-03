-- Fix for infinite recursion in users RLS policy
-- The problem: users_select_admin policy queries users table from within users table policy

-- Step 1: Drop the problematic policies
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_select_admin ON users;

-- Step 2: Create a security definer function that bypasses RLS
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT is_admin FROM users WHERE id = user_id;
$$ LANGUAGE SQL STABLE;

-- Step 3: Recreate policies using the function
-- Policy: Users can see their own record
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (auth.uid()::TEXT = id::TEXT);

-- Policy: Admins can see all users
CREATE POLICY users_select_admin ON users
    FOR SELECT
    USING (is_admin(auth.uid()));

-- Apply the same fix to all other admin policies

-- Clients policies
DROP POLICY IF EXISTS clients_select_admin ON clients;
CREATE POLICY clients_select_admin ON clients
    FOR SELECT
    USING (is_admin(auth.uid()));

-- Sprints policies
DROP POLICY IF EXISTS sprints_select_admin ON sprints;
CREATE POLICY sprints_select_admin ON sprints
    FOR SELECT
    USING (is_admin(auth.uid()));

-- Time entries policies
DROP POLICY IF EXISTS time_entries_select_admin ON time_entries;
CREATE POLICY time_entries_select_admin ON time_entries
    FOR SELECT
    USING (is_admin(auth.uid()));

-- Clockify projects policies
DROP POLICY IF EXISTS clockify_projects_select_admin ON clockify_projects;
CREATE POLICY clockify_projects_select_admin ON clockify_projects
    FOR SELECT
    USING (is_admin(auth.uid()));

-- Sync logs policies
DROP POLICY IF EXISTS sync_logs_select_admin ON sync_logs;
CREATE POLICY sync_logs_select_admin ON sync_logs
    FOR SELECT
    USING (is_admin(auth.uid()));
