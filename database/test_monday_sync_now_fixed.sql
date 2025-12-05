-- Test Monday.com Sync: Run in ~3 minutes
-- Current UTC time: 2025-12-05 07:51
-- This will run at 07:54 UTC (one-time test)

-- First, add the niche column if it doesn't exist
ALTER TABLE clients ADD COLUMN IF NOT EXISTS niche TEXT;

-- Schedule a one-time test run at 07:54 UTC today
-- (No need to unschedule if job doesn't exist)
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
SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'sync-monday-test';
