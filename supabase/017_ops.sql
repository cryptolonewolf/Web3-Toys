-- web3.toys: the Operations home in admin (queues, today, numbers, site
-- health, your to-do list) and the audit log.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 006_admin.sql, 008_quests_referrals.sql, 009_work_with_us.sql,
-- 014_business.sql, 015_sponsors.sql and 016_tests.sql first.
--
-- What it adds:
--   - admin_audit: who did what and when, for every admin action (written by
--     the database itself, so it cannot be skipped from the browser)
--   - contact_messages: the new form on /contact/
--   - refund_requests: "Request a refund" in My Progress, Purchases
--   - Mark reviewed for X post proofs, flagged referrals and failed or
--     disputed payments
--   - ops_health: payment webhook failures and the weekly link check
--   - ops_todos: the setup tasks you tick off yourself
--   - three more anonymous counts: play, js_error, page_load (no names)
--   - admin_ops(): everything the Operations home shows, in one call

-- ---------- Audit log ----------
create table if not exists public.admin_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target_kind text not null,
  target_id text,
  detail jsonb not null default '{}'
);
create index if not exists admin_audit_at on public.admin_audit (at desc);
alter table public.admin_audit enable row level security;
drop policy if exists "admins read audit" on public.admin_audit;
create policy "admins read audit" on public.admin_audit for select using (public.is_admin());

-- Records admin changes on the queue tables. Only changes made by a logged-in
-- admin are recorded (payments confirmed by Razorpay are not admin actions).
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  r jsonb := case when tg_op = 'DELETE' then o else n end;
  k text;
  changes jsonb := '{}';
  act text;
begin
  if auth.uid() is null or not public.is_admin() then return null; end if;
  foreach k in array array['status', 'action', 'until', 'paid_at', 'paid_tx', 'reviewed_at', 'ops_reviewed_at', 'admin_note', 'checklist', 'spots', 'reward_usd', 'tasks', 'hash', 'owner_id', 'flags', 'pro_until'] loop
    if (o -> k) is distinct from (n -> k) and (r ? k) then
      changes := changes || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
    end if;
  end loop;
  if tg_op = 'UPDATE' and changes = '{}' then return null; end if;
  act := case
    when tg_op = 'INSERT' then 'created'
    when tg_op = 'DELETE' then 'removed'
    when changes ? 'status' then 'status ' || coalesce(o ->> 'status', '-') || ' → ' || coalesce(n ->> 'status', '-')
    when changes ? 'paid_tx' then 'marked paid'
    when changes ? 'reviewed_at' or changes ? 'ops_reviewed_at' then 'marked reviewed'
    when changes ? 'action' or changes ? 'until' then 'release ' || coalesce(n ->> 'action', '-')
    when changes ? 'owner_id' then case when n ->> 'owner_id' is null then 'owner removed' else 'owner changed' end
    when changes ? 'flags' then case when n -> 'flags' = '[]'::jsonb then 'flags cleared' else 'flagged' end
    when changes ? 'pro_until' then 'Pro until ' || coalesce(left(n ->> 'pro_until', 10), '-')
    else 'edited' end;
  insert into public.admin_audit (admin_id, action, target_kind, target_id, detail)
  values (auth.uid(), act, tg_table_name,
    coalesce(r ->> 'id', r ->> 'referee', r ->> 'toy_id', case when r ? 'quest' then (r ->> 'user_id') || ':' || (r ->> 'quest') end, case when r ? 'file' then (r ->> 'file') || '#' || (r ->> 'item') end),
    jsonb_build_object('changes', changes, 'label', coalesce(case when r ? 'handle' then '@' || (r ->> 'handle') end, r ->> 'project', r ->> 'sponsor', r ->> 'title', r ->> 'quest', r ->> 'item', r ->> 'name', '')));
  return null;
end; $$;

-- ---------- Contact form ----------
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (length(name) between 1 and 100),
  email text not null check (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  topic text not null check (topic in ('general', 'payment', 'project', 'privacy', 'bug')),
  message text not null check (length(message) between 5 and 3000),
  status text not null default 'new' check (status in ('new', 'done')),
  admin_note text,
  created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
drop policy if exists "admins read contact" on public.contact_messages;
create policy "admins read contact" on public.contact_messages for select using (public.is_admin());

-- p_trap is a hidden field people never fill in (bots do). At most 3
-- messages per email address an hour and 40 in total an hour.
create or replace function public.send_contact(p_name text, p_email text, p_topic text, p_message text, p_trap text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare m text := lower(btrim(coalesce(p_email, '')));
begin
  if coalesce(p_trap, '') <> '' then return; end if;
  if (select count(*) from public.contact_messages where lower(email) = m and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'Too many messages right now. Please email hi@web3.toys instead.';
  end if;
  insert into public.contact_messages (user_id, name, email, topic, message)
  values (auth.uid(), btrim(p_name), m, coalesce(nullif(p_topic, ''), 'general'), btrim(p_message));
end; $$;
grant execute on function public.send_contact(text, text, text, text, text) to anon, authenticated;

create or replace function public.admin_set_contact(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  update public.contact_messages set status = p_status, admin_note = coalesce(p_note, admin_note) where id = p_id;
end; $$;
grant execute on function public.admin_set_contact(uuid, text, text) to authenticated;

-- ---------- Refund requests ----------
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (length(reason) between 3 and 1000),
  status text not null default 'open' check (status in ('open', 'refunded', 'declined')),
  admin_note text,
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create unique index if not exists refund_requests_open on public.refund_requests (order_id) where status = 'open';
alter table public.refund_requests enable row level security;
drop policy if exists "own refund requests read" on public.refund_requests;
create policy "own refund requests read" on public.refund_requests for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.request_refund(p_order uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.orders; v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  select * into o from public.orders where id = p_order and user_id = auth.uid();
  if not found or o.status <> 'paid' or o.currency = 'COINS' then raise exception 'This purchase cannot be refunded here. Email hi@web3.toys.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then raise exception 'Tell us briefly why.'; end if;
  select id into v_id from public.refund_requests where order_id = p_order and status = 'open';
  if v_id is not null then return v_id; end if;
  insert into public.refund_requests (order_id, user_id, reason) values (p_order, auth.uid(), left(btrim(p_reason), 1000)) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.request_refund(uuid, text) from public, anon;
grant execute on function public.request_refund(uuid, text) to authenticated;

create or replace function public.admin_refund_request(p_id uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('refunded', 'declined', 'open') then raise exception 'Unknown status'; end if;
  update public.refund_requests set status = p_status, admin_note = coalesce(p_note, admin_note), handled_at = case when p_status = 'open' then null else now() end where id = p_id;
end; $$;
grant execute on function public.admin_refund_request(uuid, text, text) to authenticated;

-- A refunded order closes its open refund request.
create or replace function public.close_refund_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'refunded' and old.status is distinct from 'refunded' then
    update public.refund_requests set status = 'refunded', handled_at = now() where order_id = new.id and status = 'open';
  end if;
  return new;
end; $$;
drop trigger if exists close_refund_request on public.orders;
create trigger close_refund_request after update of status on public.orders for each row execute function public.close_refund_request();

-- ---------- Mark reviewed ----------
alter table public.quest_proofs add column if not exists reviewed_at timestamptz;
alter table public.referrals add column if not exists reviewed_at timestamptz;
alter table public.orders add column if not exists disputed_at timestamptz;
alter table public.orders add column if not exists dispute_note text;
alter table public.orders add column if not exists ops_reviewed_at timestamptz;

-- p_kind: 'post' (key USER:QUEST), 'referral' (key: the new player's id),
-- 'payment' (key: the order id).
create or replace function public.admin_mark_reviewed(p_kind text, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_kind = 'post' then
    update public.quest_proofs set reviewed_at = now() where user_id = split_part(p_key, ':', 1)::uuid and quest = split_part(p_key, ':', 2);
  elsif p_kind = 'referral' then
    update public.referrals set reviewed_at = now() where referee = p_key::uuid;
  elsif p_kind = 'payment' then
    update public.orders set ops_reviewed_at = now() where id = p_key::uuid;
  else raise exception 'Unknown kind'; end if;
end; $$;
grant execute on function public.admin_mark_reviewed(text, text) to authenticated;

-- Referrals worth a look: over the monthly cap, or 3 or more invites by the
-- same person on the same day.
create or replace function public.admin_flagged_referrals()
returns table (referee uuid, referrer uuid, referrer_name text, referee_name text, status text, created_at timestamptz, reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query
  select r.referee, r.referrer, a.display_name, b.display_name, r.status, r.created_at,
         case when r.status = 'capped' then 'Over the monthly cap' else 'Several invites on one day' end
  from public.referrals r
  left join public.profiles a on a.id = r.referrer
  left join public.profiles b on b.id = r.referee
  where r.reviewed_at is null and (r.status = 'capped' or (select count(*) from public.referrals x
    where x.referrer = r.referrer and date_trunc('day', x.created_at) = date_trunc('day', r.created_at)) >= 3)
  order by r.created_at;
end; $$;
grant execute on function public.admin_flagged_referrals() to authenticated;

-- X posts waiting for a look (Post to unlock), with the player's name.
create or replace function public.admin_open_proofs()
returns table (user_id uuid, display_name text, quest text, proof text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select q.user_id, p.display_name, q.quest, q.proof, q.created_at
  from public.quest_proofs q left join public.profiles p on p.id = q.user_id
  where q.reviewed_at is null order by q.created_at;
end; $$;
grant execute on function public.admin_open_proofs() to authenticated;

-- The audit log with the admin's name.
create or replace function public.admin_audit_list(p_limit int default 500)
returns table (at timestamptz, admin_name text, action text, target_kind text, target_id text, detail jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select a.at, coalesce(p.display_name, u.email, 'system'), a.action, a.target_kind, a.target_id, a.detail
  from public.admin_audit a left join public.profiles p on p.id = a.admin_id left join auth.users u on u.id = a.admin_id
  order by a.at desc limit greatest(1, least(coalesce(p_limit, 500), 5000));
end; $$;
grant execute on function public.admin_audit_list(int) to authenticated;

-- ---------- Site health ----------
create table if not exists public.ops_health (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('webhook', 'link', 'slow', 'link_run')),
  source text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists ops_health_kind_time on public.ops_health (kind, created_at desc);
alter table public.ops_health enable row level security;
drop policy if exists "admins read health" on public.ops_health;
create policy "admins read health" on public.ops_health for select using (public.is_admin());

-- More anonymous counts: play (first tap in a toy), js_error (the error
-- message, cut short, no names) and page_load (load time in ms, a sample).
create or replace function public.log_event(p_name text, p_page text, p_item text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_name not in ('page_view', 'finish', 'share', 'call_click', 'buy_click', 'purchase', 'signup', 'offer_view', 'play', 'js_error', 'page_load',
    'biz_tier', 'biz_start', 'biz_step1', 'biz_submit') then return; end if;
  if p_name = 'page_load' and coalesce(p_item, '') !~ '^[0-9]{1,6}$' then return; end if;
  if p_name = 'js_error' and (select count(*) from public.events where name = 'js_error' and created_at > now() - interval '1 hour') >= 500 then return; end if;
  insert into public.events (name, page, item) values (p_name, left(p_page, 120), left(p_item, 80));
end; $$;
grant execute on function public.log_event(text, text, text) to anon, authenticated;

-- ---------- Your to-do list ----------
create table if not exists public.ops_todos (
  key text primary key check (key ~ '^[a-z0-9-]{2,60}$'),
  done_at timestamptz,
  done_by uuid references auth.users (id) on delete set null
);
alter table public.ops_todos enable row level security;
drop policy if exists "admins read todos" on public.ops_todos;
create policy "admins read todos" on public.ops_todos for select using (public.is_admin());

create or replace function public.admin_todo(p_key text, p_done boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  insert into public.ops_todos (key, done_at, done_by) values (p_key, case when p_done then now() end, auth.uid())
  on conflict (key) do update set done_at = excluded.done_at, done_by = excluded.done_by;
  insert into public.admin_audit (admin_id, action, target_kind, target_id) values (auth.uid(), case when p_done then 'ticked' else 'unticked' end, 'ops_todos', p_key);
end; $$;
grant execute on function public.admin_todo(text, boolean) to authenticated;

-- When data items marked "review": true were first seen (the review queue
-- has no dates of its own), for their age on the Operations home.
create table if not exists public.review_seen (
  hash text primary key,
  first_seen timestamptz not null default now()
);
alter table public.review_seen enable row level security;

-- ---------- Everything the Operations home shows ----------
-- p_review: the hashes still waiting in the review queue (from the page).
-- More queues from later files (019_pages.sql replaces this one). Made only
-- when missing, so running this file again keeps the later version.
do $$
begin
  if to_regprocedure('public.ops_extra()') is null then
    execute $f$create function public.ops_extra() returns jsonb language sql stable as 'select ''[]''::jsonb'$f$;
    execute 'revoke all on function public.ops_extra() from public, anon, authenticated';
  end if;
end $$;

-- ops_data is also used by the daily digest email (ops-digest, which runs
-- with the service key), so it has no admin check itself and only the
-- service key may call it; admins use admin_ops below.
create or replace function public.ops_data(p_review text[] default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  w1 timestamptz := now() - interval '7 days';
  w2 timestamptz := now() - interval '14 days';
  out jsonb;
begin
  insert into public.review_seen (hash) select unnest(coalesce(p_review, '{}')) on conflict do nothing;

  select jsonb_build_object(
    'queues', jsonb_build_array(
      (select jsonb_build_object('id', 'toyreq', 'count', count(*), 'oldest', min(created_at)) from public.biz_requests where kind = 'toy' and status in ('paid', 'in_review')),
      (select jsonb_build_object('id', 'testreq', 'count', count(*), 'oldest', min(created_at)) from public.biz_requests where kind = 'test' and status in ('paid', 'in_review')),
      (select jsonb_build_object('id', 'testruns', 'count', count(*), 'oldest', min(submitted_at)) from public.test_runs where status = 'submitted'),
      (select jsonb_build_object('id', 'sponsors', 'count', count(*), 'oldest', min(created_at)) from public.sponsor_bookings where status = 'pending'),
      (select jsonb_build_object('id', 'posts', 'count', count(*), 'oldest', min(created_at)) from public.quest_proofs where reviewed_at is null),
      (select jsonb_build_object('id', 'referrals', 'count', count(*), 'oldest', min(r.created_at)) from public.referrals r
        where r.reviewed_at is null and (r.status = 'capped' or (select count(*) from public.referrals x
          where x.referrer = r.referrer and date_trunc('day', x.created_at) = date_trunc('day', r.created_at)) >= 3)),
      (select jsonb_build_object('id', 'refunds', 'count', count(*), 'oldest', min(created_at)) from public.refund_requests where status = 'open'),
      (select jsonb_build_object('id', 'contact', 'count', count(*), 'oldest', min(created_at)) from public.contact_messages where status = 'new'),
      (select jsonb_build_object('id', 'courses', 'count', count(*), 'oldest', min(created_at)) from public.project_requests where kind = 'course' and status in ('paid', 'in_review')),
      (select jsonb_build_object('id', 'review', 'count', count(*), 'oldest', min(first_seen)) from public.review_seen where hash = any(coalesce(p_review, '{}'))),
      (select jsonb_build_object('id', 'payments', 'count', count(*), 'oldest', min(coalesce(disputed_at, created_at))) from public.orders
        where ops_reviewed_at is null and (disputed_at is not null or (status = 'failed' and created_at > now() - interval '30 days')))
    ) || public.ops_extra(),
    'numbers', jsonb_build_object(
      'plays', jsonb_build_array((select count(*) from public.events where name = 'play' and created_at > w1), (select count(*) from public.events where name = 'play' and created_at > w2 and created_at <= w1)),
      'finishes', jsonb_build_array((select count(*) from public.events where name = 'finish' and created_at > w1), (select count(*) from public.events where name = 'finish' and created_at > w2 and created_at <= w1)),
      'accounts', jsonb_build_array((select count(*) from public.profiles where created_at > w1), (select count(*) from public.profiles where created_at > w2 and created_at <= w1)),
      'signups', jsonb_build_array((select count(*) from public.leads where created_at > w1), (select count(*) from public.leads where created_at > w2 and created_at <= w1)),
      'certificates', jsonb_build_array((select count(*) from public.certificates where saved_at > w1), (select count(*) from public.certificates where saved_at > w2 and saved_at <= w1)),
      'shares', jsonb_build_array((select count(*) from public.events where name = 'share' and created_at > w1), (select count(*) from public.events where name = 'share' and created_at > w2 and created_at <= w1)),
      'yesterday', jsonb_build_object(
        'plays', (select count(*) from public.events where name = 'play' and created_at > now() - interval '1 day'),
        'accounts', (select count(*) from public.profiles where created_at > now() - interval '1 day'),
        'signups', (select count(*) from public.leads where created_at > now() - interval '1 day'),
        'certificates', (select count(*) from public.certificates where saved_at > now() - interval '1 day')),
      'revenue', coalesce((select jsonb_agg(jsonb_build_object('product', product_id, 'currency', currency, 'now', s1, 'before', s2)) from (
        select product_id, currency,
          sum(amount) filter (where paid_at > w1) s1, sum(amount) filter (where paid_at <= w1) s2
        from public.orders where status = 'paid' and currency <> 'COINS' and paid_at > w2 group by product_id, currency) x), '[]')
    ),
    'today', jsonb_build_object(
      'overrides', coalesce((select jsonb_agg(to_jsonb(o)) from public.release_overrides o), '[]'),
      'earlyBird', coalesce((select jsonb_agg(jsonb_build_object('toy', t.toy, 'spots', t.spots, 'taken', (select count(*) from public.early_birds b where b.toy = t.toy), 'starts_at', t.starts_at)) from public.early_bird_toys t), '[]'),
      'sponsors', coalesce((select jsonb_agg(jsonb_build_object('sponsor', s.sponsor, 'kind', s.kind, 'toy', s.toy_id, 'month', s.month, 'status', s.status)) from public.sponsor_bookings s
        where s.status in ('approved', 'pending') and (s.month between (now() - interval '7 days')::date and (now() + interval '7 days')::date
          or (s.month + interval '1 month' - interval '1 day')::date between (now() - interval '7 days')::date and (now() + interval '7 days')::date)), '[]')
    ),
    'health', jsonb_build_object(
      'errors', (select count(*) from public.events where name = 'js_error' and created_at > now() - interval '1 day'),
      'topErrors', coalesce((select jsonb_agg(x) from (select page, item, count(*) n from public.events where name = 'js_error' and created_at > now() - interval '1 day' group by page, item order by n desc limit 5) x), '[]'),
      'webhook', (select count(*) from public.ops_health where kind = 'webhook' and created_at > now() - interval '7 days'),
      'webhookLast', coalesce((select jsonb_agg(x) from (select source, detail, created_at from public.ops_health where kind = 'webhook' and created_at > now() - interval '7 days' order by created_at desc limit 5) x), '[]'),
      'linkRun', (select to_jsonb(x) from (select detail, created_at from public.ops_health where kind = 'link_run' order by created_at desc limit 1) x),
      'links', coalesce((select jsonb_agg(x) from (select source, detail from public.ops_health h where kind = 'link'
        and created_at >= coalesce((select max(created_at) from public.ops_health where kind = 'link_run'), now()) - interval '2 hours' order by source limit 50) x), '[]'),
      'slowCheck', coalesce((select jsonb_agg(x) from (select source, detail from public.ops_health h where kind = 'slow'
        and created_at >= coalesce((select max(created_at) from public.ops_health where kind = 'link_run'), now()) - interval '2 hours' order by source limit 20) x), '[]'),
      'slow', coalesce((select jsonb_agg(x) from (select page, round(avg(item::int)) ms, count(*) n from public.events
        where name = 'page_load' and created_at > now() - interval '7 days' group by page having count(*) >= 3 and avg(item::int) > 3000 order by 2 desc limit 10) x), '[]')
    )
  ) into out;
  return out;
end; $$;
revoke all on function public.ops_data(text[]) from public, anon, authenticated;
grant execute on function public.ops_data(text[]) to service_role;

create or replace function public.admin_ops(p_review text[] default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return public.ops_data(p_review);
end; $$;
grant execute on function public.admin_ops(text[]) to authenticated;

-- Whether a scheduled job exists (pg_cron may not be switched on yet).
create or replace function public.ops_cron_job(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare found boolean := false;
begin
  if not exists (select 1 from pg_namespace where nspname = 'cron') then return false; end if;
  execute 'select exists (select 1 from cron.job where jobname = $1)' into found using p_name;
  return found;
end; $$;
revoke all on function public.ops_cron_job(text) from public, anon, authenticated;

-- Which setup steps are done (for the to-do card): the SQL files, by a table
-- or function each one makes.
create or replace function public.admin_setup_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'sql-007', to_regclass('public.bookings') is not null,
    'sql-008', to_regclass('public.referrals') is not null,
    'sql-009', to_regclass('public.project_requests') is not null,
    'sql-010', to_regclass('public.release_overrides') is not null,
    'sql-011', to_regclass('public.hof_votes') is not null,
    'sql-012', to_regclass('public.early_bird_toys') is not null,
    'sql-013', exists (select 1 from pg_namespace where nspname = 'cron'),
    'sql-014', to_regclass('public.biz_requests') is not null,
    'sql-015', to_regclass('public.sponsor_bookings') is not null,
    'sql-016', to_regclass('public.product_tests') is not null,
    'sql-017', true,
    'sql-018', public.ops_cron_job('web3toys-ops-digest'),
    'sql-019', to_regclass('public.pages') is not null,
    'sql-020', to_regclass('public.page_consents') is not null,
    'sql-021', to_regclass('public.page_pro_log') is not null,
    'sql-022', to_regclass('public.biz_leads') is not null,
    'books', (select count(*) from storage.objects where bucket_id = 'paid-files'),
    'todos', coalesce((select jsonb_object_agg(key, done_at) from public.ops_todos where done_at is not null), '{}')
  );
end; $$;
grant execute on function public.admin_setup_status() to authenticated;

-- ---------- Turn on the audit log for every queue table ----------
do $$
declare t text;
begin
  -- Changes and deletions on the queue tables; new rows only where an admin
  -- creates them (tests, review approvals, release buttons).
  foreach t in array array['biz_requests', 'sponsor_bookings', 'test_runs', 'project_requests', 'orders', 'quest_proofs', 'referrals', 'refund_requests', 'contact_messages'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after update or delete on public.%I for each row execute function public.audit_trigger()', t);
  end loop;
  foreach t in array array['product_tests', 'review_approvals', 'release_overrides'] loop
    execute format('drop trigger if exists audit on public.%I', t);
    execute format('create trigger audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;
