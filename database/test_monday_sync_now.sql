-- Test Monday.com Sync: Run in ~3 minutes
-- Current UTC time: 2025-12-05 07:51
-- This will run at 07:54 UTC (one-time test)

-- First, unschedule the existing weekly job (if it exists)
SELECT cron.unschedule('sync-monday-weekly');

-- Schedule a one-time test run at 07:54 UTC today
SELECT cron.schedule(
    'sync-monday-test',
    '54 7 5 12 *',  -- At 07:54 on December 5th
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

-- View the scheduled job
SELECT jobid, schedule, command FROM cron.job WHERE jobname = 'sync-monday-test';

-- Check execution status (run this after 07:54 to see results)
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sync-monday-test') ORDER BY start_time DESC LIMIT 5;

-- After testing, restore the weekly schedule:
-- SELECT cron.unschedule('sync-monday-test');
-- SELECT cron.schedule(
--     'sync-monday-weekly',
--     '0 16 * * 1',  -- 4 PM UTC on Monday = 2 AM AEST Tuesday
--     $$
--     SELECT
--       net.http_post(
--         url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/sync-monday',
--         headers := jsonb_build_object(
--           'Content-Type', 'application/json',
--           'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'anon_key')
--         ),
--         body := '{}'::jsonb
--       ) AS request_id;
--     $$
-- );
