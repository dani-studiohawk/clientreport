-- Supabase Edge Functions Scheduling with pg_cron
-- Run this in the Supabase SQL Editor to set up scheduled syncs

-- ============================================================================
-- STEP 1: Enable required extensions (run as superuser)
-- ============================================================================

-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;


-- ============================================================================
-- STEP 2: Store secrets in Supabase Vault
-- Run these to store your Edge Function URL and anon key securely
-- ============================================================================

-- Store your project URL (replace with your actual URL)
SELECT vault.create_secret(
    'https://YOUR_PROJECT_REF.supabase.co',
    'project_url'
);

-- Store your anon/publishable key (replace with your actual key)
SELECT vault.create_secret(
    'YOUR_SUPABASE_ANON_KEY',
    'anon_key'
);


-- ============================================================================
-- STEP 3: Schedule the Clockify sync (daily at 2 AM AEST = 4 PM UTC previous day)
-- ============================================================================

-- First, remove existing job if re-running
SELECT cron.unschedule('sync-clockify-daily');

-- Schedule Clockify sync to run daily at 4 PM UTC (2 AM AEST next day)
SELECT cron.schedule(
    'sync-clockify-daily',
    '0 16 * * *',  -- 4 PM UTC = 2 AM AEST (next day)
    $$
    SELECT
      net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-clockify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
        ),
        body := '{"days_back": 7}'::jsonb
      ) AS request_id;
    $$
);


-- ============================================================================
-- STEP 4: Schedule the Monday.com sync (weekly on Monday at 2 AM AEST)
-- ============================================================================

-- First, remove existing job if re-running
SELECT cron.unschedule('sync-monday-weekly');

-- Schedule Monday sync to run weekly on Monday at 4 PM UTC (2 AM AEST Tuesday)
SELECT cron.schedule(
    'sync-monday-weekly',
    '0 16 * * 1',  -- 4 PM UTC on Monday = 2 AM AEST Tuesday
    $$
    SELECT
      net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-monday',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
        ),
        body := '{}'::jsonb
      ) AS request_id;
    $$
);


-- ============================================================================
-- HELPER QUERIES
-- ============================================================================

-- View all scheduled jobs
SELECT * FROM cron.job;

-- View job execution history
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;

-- Manually trigger the Clockify sync (for testing)
-- SELECT
--   net.http_post(
--     url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-clockify',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
--     ),
--     body := '{"days_back": 7}'::jsonb
--   ) AS request_id;

-- Unschedule jobs (if needed)
-- SELECT cron.unschedule('sync-clockify-daily');
-- SELECT cron.unschedule('sync-monday-weekly');
