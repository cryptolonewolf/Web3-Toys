-- web3.toys: send the Notify me launch emails every hour.
-- Run this AFTER deploying the launch-emails Edge Function and adding its
-- secrets (docs/setup/launch-emails.md). Safe to run again.
--
-- Before running, replace the two words in capitals below:
--   YOUR-PROJECT  the start of your Supabase address (zdufxggiffinqcstoquq)
--   CRON-PASSWORD the same password you saved as CRON_SECRET in Supabase
--
-- It uses two Supabase extensions: pg_cron (runs jobs on a timer) and
-- pg_net (lets the database call a web address).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('web3toys-launch-emails')
where exists (select 1 from cron.job where jobname = 'web3toys-launch-emails');

select cron.schedule(
  'web3toys-launch-emails',
  '5 * * * *',  -- 5 minutes past every hour
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/launch-emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', 'CRON-PASSWORD'),
    body := '{}'::jsonb
  );
  $$
);
