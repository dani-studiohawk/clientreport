-- Restore normal sync schedules
-- This removes test jobs and sets up the daily/weekly schedules

-- Remove test jobs
SELECT cron.unschedule('sync-clockify-test');
SELECT cron.unschedule('sync-monday-test');

-- Restore daily Clockify sync at 2 AM AEST (4 PM UTC)
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

-- Restore weekly Monday sync on Monday at 2 AM AEST (4 PM UTC Monday)
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

-- View scheduled jobs
SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;
