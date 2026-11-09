-- web3.toys: schedules the daily Operations email (9:00 India time) and the
-- weekly site check (Mondays, 6:30 India time).
-- Run this AFTER 017_ops.sql and after deploying the ops-digest and ops-check
-- Edge Functions with their secrets (docs/setup/operations.md). Safe to run again.
--
-- Before running, replace the two words in capitals below (in both jobs):
--   YOUR-PROJECT  the start of your Supabase address (zdufxggiffinqcstoquq)
--   CRON-PASSWORD the same password you saved as CRON_SECRET in Supabase
-- Times are in UTC: 03:30 UTC is 9:00 in India; 01:00 UTC is 6:30 in India.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('web3toys-ops-digest')
where exists (select 1 from cron.job where jobname = 'web3toys-ops-digest');
select cron.schedule(
  'web3toys-ops-digest',
  '30 3 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/ops-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'CRON-PASSWORD'),
    body := '{}'::jsonb
  );
  $$
);

select cron.unschedule('web3toys-ops-check')
where exists (select 1 from cron.job where jobname = 'web3toys-ops-check');
select cron.schedule(
  'web3toys-ops-check',
  '0 1 * * 1',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/ops-check',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'CRON-PASSWORD'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
  $$
);

-- Old site-health rows are removed after 90 days (every day at 4:00 UTC).
select cron.unschedule('web3toys-ops-tidy')
where exists (select 1 from cron.job where jobname = 'web3toys-ops-tidy');
select cron.schedule('web3toys-ops-tidy', '0 4 * * *', $$
  delete from public.ops_health where created_at < now() - interval '90 days';
  delete from public.events where name in ('js_error', 'page_load') and created_at < now() - interval '90 days';
$$);
