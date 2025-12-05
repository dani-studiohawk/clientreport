-- Test Sync: Reschedule Clockify to run in ~3 minutes
-- Current UTC time: 2025-12-05 07:44
-- This will run at 07:48 UTC (one-time test)

-- First, unschedule the existing daily job
SELECT cron.unschedule('sync-clockify-daily');

-- Schedule a one-time test run at 07:48 UTC today
SELECT cron.schedule(
    'sync-clockify-test',
    '48 7 5 12 *',  -- At 07:48 on December 5th
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

-- View the scheduled job
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'sync-clockify-test';

-- Check execution status (run this after 07:48 to see results)
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-clockify-test') ORDER BY start_time DESC LIMIT 5;
