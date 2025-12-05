--
-- PostgreSQL database dump from Supabase
-- Project: ylnrkfpchrzvuhqrnwco
-- Generated: 2025-12-05 10:58:49
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Tables found: 6

-- Table: clients
CREATE TABLE public.clients (id uuid NOT NULL DEFAULT uuid_generate_v4(), monday_item_id bigint NOT NULL, name text NOT NULL, dpr_lead_id uuid, dpr_support_ids ARRAY, seo_lead_name text, agency_value numeric, client_priority text, campaign_type text, campaign_start_date date, total_link_kpi integer, total_links_achieved integer, monthly_rate numeric, monthly_hours numeric, is_active boolean DEFAULT true, report_status text, last_report_date date, last_invoice_date date, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), group_name text, region text, niche text);

-- Table: clockify_projects
CREATE TABLE public.clockify_projects (id uuid NOT NULL DEFAULT uuid_generate_v4(), clockify_id text NOT NULL, name text NOT NULL, client_id uuid, hourly_rate numeric, is_active boolean DEFAULT true, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

-- Table: sprints
CREATE TABLE public.sprints (id uuid NOT NULL DEFAULT uuid_generate_v4(), client_id uuid NOT NULL, monday_subitem_id bigint NOT NULL, name text NOT NULL, sprint_number integer, sprint_label text, start_date date NOT NULL, end_date date NOT NULL, kpi_target integer NOT NULL, kpi_achieved integer DEFAULT 0, monthly_rate numeric, status text DEFAULT 'active'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

-- Table: sync_logs
CREATE TABLE public.sync_logs (id uuid NOT NULL DEFAULT uuid_generate_v4(), source text NOT NULL, sync_start timestamp with time zone NOT NULL, sync_end timestamp with time zone, status text NOT NULL, records_synced integer DEFAULT 0, error_message text, created_at timestamp with time zone DEFAULT now());

-- Table: time_entries
CREATE TABLE public.time_entries (id uuid NOT NULL DEFAULT uuid_generate_v4(), clockify_id text NOT NULL, sprint_id uuid, user_id uuid NOT NULL, project_id uuid, entry_date date NOT NULL, hours numeric NOT NULL, description text, task_category text, project_name text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), tags ARRAY DEFAULT '{}'::text[], client_id uuid);

-- Table: users
CREATE TABLE public.users (id uuid NOT NULL DEFAULT uuid_generate_v4(), email text NOT NULL, name text NOT NULL, is_admin boolean DEFAULT false, clockify_user_id text, monday_person_id bigint, is_active boolean DEFAULT true, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

-- Indexes
CREATE UNIQUE INDEX clients_monday_item_id_key ON public.clients USING btree (monday_item_id);
CREATE UNIQUE INDEX clients_pkey ON public.clients USING btree (id);
CREATE UNIQUE INDEX clockify_projects_clockify_id_key ON public.clockify_projects USING btree (clockify_id);
CREATE UNIQUE INDEX clockify_projects_pkey ON public.clockify_projects USING btree (id);
CREATE INDEX idx_clients_active ON public.clients USING btree (is_active);
CREATE INDEX idx_clients_dpr_lead ON public.clients USING btree (dpr_lead_id);
CREATE INDEX idx_clients_group_name ON public.clients USING btree (group_name);
CREATE INDEX idx_clients_monday_id ON public.clients USING btree (monday_item_id);
CREATE INDEX idx_clients_name ON public.clients USING btree (name);
CREATE INDEX idx_clients_region ON public.clients USING btree (region);
CREATE INDEX idx_clockify_projects_client ON public.clockify_projects USING btree (client_id);
CREATE INDEX idx_clockify_projects_clockify_id ON public.clockify_projects USING btree (clockify_id);
CREATE INDEX idx_sprints_client ON public.sprints USING btree (client_id);
CREATE INDEX idx_sprints_dates ON public.sprints USING btree (start_date, end_date);
CREATE INDEX idx_sprints_monday_subitem ON public.sprints USING btree (monday_subitem_id);
CREATE INDEX idx_sprints_status ON public.sprints USING btree (status);
CREATE INDEX idx_sync_logs_created ON public.sync_logs USING btree (created_at DESC);
CREATE INDEX idx_sync_logs_source ON public.sync_logs USING btree (source);
CREATE INDEX idx_sync_logs_status ON public.sync_logs USING btree (status);
CREATE INDEX idx_time_entries_client ON public.time_entries USING btree (client_id);
CREATE INDEX idx_time_entries_clockify_id ON public.time_entries USING btree (clockify_id);
CREATE INDEX idx_time_entries_date ON public.time_entries USING btree (entry_date);
CREATE INDEX idx_time_entries_project ON public.time_entries USING btree (project_id);
CREATE INDEX idx_time_entries_sprint ON public.time_entries USING btree (sprint_id);
CREATE INDEX idx_time_entries_tags ON public.time_entries USING gin (tags);
CREATE INDEX idx_time_entries_user ON public.time_entries USING btree (user_id);
CREATE INDEX idx_users_clockify_id ON public.users USING btree (clockify_user_id);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_monday_id ON public.users USING btree (monday_person_id);
CREATE UNIQUE INDEX sprints_monday_subitem_id_key ON public.sprints USING btree (monday_subitem_id);
CREATE UNIQUE INDEX sprints_pkey ON public.sprints USING btree (id);
CREATE UNIQUE INDEX sync_logs_pkey ON public.sync_logs USING btree (id);
CREATE UNIQUE INDEX time_entries_clockify_id_key ON public.time_entries USING btree (clockify_id);
CREATE UNIQUE INDEX time_entries_pkey ON public.time_entries USING btree (id);
CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);
CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id);

-- Views
CREATE VIEW sprint_metrics AS  SELECT s.id AS sprint_id,
    s.client_id,
    c.name AS client_name,
    s.name AS sprint_name,
    s.sprint_number,
    s.start_date,
    s.end_date,
    s.status,
    s.kpi_target,
    s.kpi_achieved,
        CASE
            WHEN (s.kpi_target > 0) THEN round((((s.kpi_achieved)::numeric / (s.kpi_target)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS kpi_progress_percent,
    (s.end_date - s.start_date) AS days_total,
    GREATEST(0, (CURRENT_DATE - s.start_date)) AS days_elapsed,
    GREATEST(0, (s.end_date - CURRENT_DATE)) AS days_remaining,
        CASE
            WHEN ((s.end_date - s.start_date) > 0) THEN round((((GREATEST(0, (CURRENT_DATE - s.start_date)))::numeric / ((s.end_date - s.start_date))::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS time_elapsed_percent,
    COALESCE(sum(te.hours), (0)::numeric) AS hours_used,
    (c.monthly_hours * (3)::numeric) AS hours_allocated,
        CASE
            WHEN (c.monthly_hours > (0)::numeric) THEN round(((COALESCE(sum(te.hours), (0)::numeric) / (c.monthly_hours * (3)::numeric)) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS hours_utilization_percent,
    s.monthly_rate,
    (s.monthly_rate * (3)::numeric) AS sprint_revenue,
        CASE
            WHEN ((COALESCE(sum(te.hours), (0)::numeric) > (0)::numeric) AND (s.monthly_rate IS NOT NULL)) THEN round(((s.monthly_rate * (3)::numeric) / COALESCE(sum(te.hours), (1)::numeric)), 2)
            ELSE NULL::numeric
        END AS actual_billable_rate,
    c.dpr_lead_id,
    u.name AS dpr_lead_name,
    calculate_sprint_health(s.id) AS health_status
   FROM (((sprints s
     JOIN clients c ON ((s.client_id = c.id)))
     LEFT JOIN users u ON ((c.dpr_lead_id = u.id)))
     LEFT JOIN time_entries te ON ((te.sprint_id = s.id)))
  GROUP BY s.id, s.client_id, c.name, s.name, s.sprint_number, s.start_date, s.end_date, s.status, s.kpi_target, s.kpi_achieved, c.monthly_hours, c.monthly_rate, c.dpr_lead_id, u.name;;
CREATE VIEW client_contract_metrics AS  SELECT c.id AS client_id,
    c.name AS client_name,
    c.dpr_lead_id,
    u.name AS dpr_lead_name,
    c.campaign_type,
    c.agency_value,
    c.client_priority,
    c.campaign_start_date,
    count(s.id) AS total_sprints,
    count(s.id) FILTER (WHERE (s.status = 'active'::text)) AS active_sprints,
    count(s.id) FILTER (WHERE (s.status = 'completed'::text)) AS completed_sprints,
    c.total_link_kpi AS contract_kpi_target,
    c.total_links_achieved AS contract_kpi_achieved,
        CASE
            WHEN (c.total_link_kpi > 0) THEN round((((c.total_links_achieved)::numeric / (c.total_link_kpi)::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS contract_kpi_percent,
    sum(s.kpi_target) AS sprint_kpi_total,
    sum(s.kpi_achieved) AS sprint_kpi_achieved,
    c.monthly_hours,
    sum(COALESCE(te.hours, (0)::numeric)) AS total_hours_used,
    ((c.monthly_hours * (3)::numeric) * (count(s.id))::numeric) AS total_hours_allocated,
        CASE
            WHEN ((c.monthly_hours > (0)::numeric) AND (count(s.id) > 0)) THEN round(((sum(COALESCE(te.hours, (0)::numeric)) / ((c.monthly_hours * (3)::numeric) * (count(s.id))::numeric)) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS overall_utilization_percent,
    c.monthly_rate,
    ((c.monthly_rate * (3)::numeric) * (count(s.id))::numeric) AS total_contract_revenue,
        CASE
            WHEN (sum(COALESCE(te.hours, (0)::numeric)) > (0)::numeric) THEN round((((c.monthly_rate * (3)::numeric) * (count(s.id))::numeric) / sum(COALESCE(te.hours, (0)::numeric))), 2)
            ELSE NULL::numeric
        END AS avg_billable_rate,
    max(s.sprint_number) FILTER (WHERE (s.status = 'active'::text)) AS current_sprint_number,
    c.is_active,
    c.report_status,
    c.last_report_date
   FROM (((clients c
     LEFT JOIN users u ON ((c.dpr_lead_id = u.id)))
     LEFT JOIN sprints s ON ((s.client_id = c.id)))
     LEFT JOIN time_entries te ON ((te.sprint_id = s.id)))
  GROUP BY c.id, c.name, c.dpr_lead_id, u.name, c.campaign_type, c.agency_value, c.client_priority, c.campaign_start_date, c.total_link_kpi, c.total_links_achieved, c.monthly_hours, c.monthly_rate, c.is_active, c.report_status, c.last_report_date;;
CREATE VIEW task_breakdown AS  SELECT te.sprint_id,
    s.client_id,
    c.name AS client_name,
    s.name AS sprint_name,
    te.task_category,
    count(te.id) AS entry_count,
    sum(te.hours) AS total_hours,
    round(avg(te.hours), 2) AS avg_hours_per_entry,
    round(((sum(te.hours) / NULLIF(total_sprint.hours, (0)::numeric)) * (100)::numeric), 1) AS percent_of_sprint
   FROM (((time_entries te
     JOIN sprints s ON ((te.sprint_id = s.id)))
     JOIN clients c ON ((s.client_id = c.id)))
     LEFT JOIN ( SELECT time_entries.sprint_id,
            sum(time_entries.hours) AS hours
           FROM time_entries
          GROUP BY time_entries.sprint_id) total_sprint ON ((total_sprint.sprint_id = te.sprint_id)))
  WHERE (te.task_category IS NOT NULL)
  GROUP BY te.sprint_id, s.client_id, c.name, s.name, te.task_category, total_sprint.hours
  ORDER BY te.sprint_id, (sum(te.hours)) DESC;;
CREATE VIEW user_sprint_breakdown AS  SELECT te.sprint_id,
    s.client_id,
    c.name AS client_name,
    s.name AS sprint_name,
    te.user_id,
    u.name AS user_name,
    count(te.id) AS entry_count,
    sum(te.hours) AS total_hours,
    round(avg(te.hours), 2) AS avg_hours_per_entry,
    round(((sum(te.hours) / NULLIF(total_sprint.hours, (0)::numeric)) * (100)::numeric), 1) AS percent_of_sprint,
    min(te.entry_date) AS first_entry_date,
    max(te.entry_date) AS last_entry_date
   FROM ((((time_entries te
     JOIN sprints s ON ((te.sprint_id = s.id)))
     JOIN clients c ON ((s.client_id = c.id)))
     JOIN users u ON ((te.user_id = u.id)))
     LEFT JOIN ( SELECT time_entries.sprint_id,
            sum(time_entries.hours) AS hours
           FROM time_entries
          GROUP BY time_entries.sprint_id) total_sprint ON ((total_sprint.sprint_id = te.sprint_id)))
  GROUP BY te.sprint_id, s.client_id, c.name, s.name, te.user_id, u.name, total_sprint.hours
  ORDER BY te.sprint_id, (sum(te.hours)) DESC;;

-- Functions
CREATE OR REPLACE FUNCTION public.get_sprint_hours(sprint_ids uuid[])
 RETURNS TABLE(sprint_id uuid, total_hours numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT 
    te.sprint_id,
    COALESCE(SUM(te.hours), 0) as total_hours
  FROM time_entries te
  WHERE te.sprint_id = ANY(sprint_ids)
  GROUP BY te.sprint_id;
$function$
;
CREATE OR REPLACE FUNCTION public.auto_set_sprint_status()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Auto-set status based on dates
  IF NEW.end_date < CURRENT_DATE THEN
    NEW.status := 'completed';
  ELSIF NEW.start_date > CURRENT_DATE THEN
    NEW.status := 'pending';
  ELSE
    NEW.status := 'active';
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.auth_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT email FROM auth.users WHERE id = auth.uid();
$function$
;
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_admin FROM users WHERE email = auth_email()),
    FALSE
  );
$function$
;
CREATE OR REPLACE FUNCTION public.check_email_domain()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.email NOT LIKE '%@studiohawk.com.au' THEN
    RAISE EXCEPTION 'Only @studiohawk.com.au email addresses are allowed';
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_sprint_health(p_sprint_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_billable_rate(p_sprint_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_monthly_rate NUMERIC;
    v_hours_used NUMERIC;
BEGIN
    SELECT
        s.monthly_rate,  -- Use sprint-level rate!
        COALESCE(SUM(te.hours), 0)
    INTO
        v_monthly_rate,
        v_hours_used
    FROM sprints s
    LEFT JOIN time_entries te ON te.sprint_id = s.id
    WHERE s.id = p_sprint_id
    GROUP BY s.monthly_rate;

    IF v_hours_used > 0 AND v_monthly_rate IS NOT NULL THEN
        -- Monthly Rate * 3 months / hours used
        RETURN (v_monthly_rate * 3) / v_hours_used;
    END IF;

    RETURN NULL;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.calculate_hours_utilization(p_sprint_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT is_admin FROM users WHERE id = user_id;
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$
;

-- Row Level Security Policies
CREATE POLICY users_select_admin ON public.users FOR SELECT TO unknown (OID=0) USING (is_current_user_admin());
CREATE POLICY clients_select_admin ON public.clients FOR SELECT TO unknown (OID=0) USING (is_current_user_admin());
CREATE POLICY clients_select_assigned ON public.clients FOR SELECT TO unknown (OID=0) USING ((dpr_lead_id IN ( SELECT users.id
   FROM users
  WHERE (users.email = auth_email()))));
CREATE POLICY sprints_select_admin ON public.sprints FOR SELECT TO unknown (OID=0) USING (is_current_user_admin());
CREATE POLICY sprints_select_assigned ON public.sprints FOR SELECT TO unknown (OID=0) USING ((EXISTS ( SELECT 1
   FROM clients
  WHERE ((clients.id = sprints.client_id) AND (clients.dpr_lead_id IN ( SELECT users.id
           FROM users
          WHERE (users.email = auth_email())))))));
CREATE POLICY time_entries_select_admin ON public.time_entries FOR SELECT TO unknown (OID=0) USING (is_current_user_admin());
CREATE POLICY time_entries_select_assigned ON public.time_entries FOR SELECT TO unknown (OID=0) USING ((EXISTS ( SELECT 1
   FROM (sprints
     JOIN clients ON ((clients.id = sprints.client_id)))
  WHERE ((sprints.id = time_entries.sprint_id) AND (clients.dpr_lead_id IN ( SELECT users.id
           FROM users
          WHERE (users.email = auth_email())))))));
CREATE POLICY time_entries_select_own ON public.time_entries FOR SELECT TO unknown (OID=0) USING ((user_id IN ( SELECT users.id
   FROM users
  WHERE (users.email = auth_email()))));
CREATE POLICY clockify_projects_select_admin ON public.clockify_projects FOR SELECT TO unknown (OID=0) USING (is_current_user_admin());
CREATE POLICY clockify_projects_select_authenticated ON public.clockify_projects FOR SELECT TO unknown (OID=0) USING ((auth.uid() IS NOT NULL));
CREATE POLICY sync_logs_select_admin ON public.sync_logs FOR SELECT TO unknown (OID=0) USING (is_current_user_admin());
CREATE POLICY users_select_own ON public.users FOR SELECT TO unknown (OID=0) USING ((email = auth_email()));
