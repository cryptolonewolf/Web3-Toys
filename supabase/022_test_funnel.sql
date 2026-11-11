-- web3.toys: the Test Your Product sales flow.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 014_business.sql, 016_tests.sql and 017_ops.sql first.
--
--   - biz_leads: step 1 of the request form (name, email, test tier) is saved
--     straight away, so you can follow up even if step 2 is never sent
--   - the day 1 and day 3 follow-up emails to leads who did not pay the
--     deposit (sent by the lead-emails function, with an unsubscribe link)
--   - funnel counts for admin: tier clicks, form starts, step 1, submitted,
--     deposit paid
--   - founding offer deposits (deposit-test-TIER-founding) mark a request paid
--   - testers must also accept the confidentiality rule before a test

-- ---------- Leads ----------
create table if not exists public.biz_leads (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('toy', 'test')),
  name text not null check (length(name) between 1 and 100),
  email text not null check (length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  tier text check (tier ~ '^[a-z0-9-]{2,40}$'),
  user_id uuid references auth.users (id) on delete set null,
  emailed_day1 timestamptz,
  emailed_day3 timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists biz_leads_email on public.biz_leads (lower(email), kind);
alter table public.biz_leads enable row level security;
drop policy if exists "admins read leads" on public.biz_leads;
create policy "admins read leads" on public.biz_leads for select using (public.is_admin());

-- Step 1 of the form. One lead per email and product a day (the latest
-- answers win), at most 60 new leads an hour in total.
create or replace function public.save_biz_lead(p_kind text, p_name text, p_email text, p_tier text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  m text := lower(btrim(coalesce(p_email, '')));
  v_id uuid;
begin
  if p_kind not in ('toy', 'test') then raise exception 'Unknown product.'; end if;
  if length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'Add your name.'; end if;
  if m !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Add an email we can reply to.'; end if;
  select id into v_id from public.biz_leads where lower(email) = m and kind = p_kind and created_at > now() - interval '1 day' order by created_at desc limit 1;
  if v_id is not null then
    update public.biz_leads set name = left(btrim(p_name), 100), tier = p_tier, user_id = coalesce(auth.uid(), user_id) where id = v_id;
    return v_id;
  end if;
  if (select count(*) from public.biz_leads where created_at > now() - interval '1 hour') >= 60 then raise exception 'Too many requests right now. Please email hi@web3.toys.'; end if;
  insert into public.biz_leads (kind, name, email, tier, user_id) values (p_kind, left(btrim(p_name), 100), m, p_tier, auth.uid()) returning id into v_id;
  return v_id;
end; $$;
grant execute on function public.save_biz_lead(text, text, text, text) to anon, authenticated;

-- Leads due a follow-up (for the lead-emails function, service key only):
-- no paid deposit for that product from that email, not unsubscribed.
create or replace function public.leads_due_emails()
returns table (id uuid, kind text, name text, email text, tier text, which text)
language sql stable security definer set search_path = '' as $$
  select l.id, l.kind, l.name, l.email, l.tier,
    case when l.emailed_day1 is null then 'day1' else 'day3' end
  from public.biz_leads l
  where l.unsubscribed_at is null
    and ((l.emailed_day1 is null and l.created_at < now() - interval '1 day' and l.created_at > now() - interval '3 days')
      or (l.emailed_day3 is null and l.created_at < now() - interval '3 days' and l.created_at > now() - interval '6 days'))
    and not exists (select 1 from public.biz_requests r where lower(r.email) = lower(l.email) and r.kind = l.kind
      and r.status in ('paid', 'in_review', 'approved', 'building', 'live', 'declined', 'refunded'))
    -- only the newest lead per email and product
    and l.created_at = (select max(x.created_at) from public.biz_leads x where lower(x.email) = lower(l.email) and x.kind = l.kind)
  limit 200;
$$;
revoke all on function public.leads_due_emails() from public, anon, authenticated;
grant execute on function public.leads_due_emails() to service_role;

-- ---------- Funnel counts ----------
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

-- Tier clicks, form starts, step 1 done, submitted and deposit paid, for one
-- product over the last p_days days.
create or replace function public.admin_biz_funnel(p_kind text, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return jsonb_build_object(
    'views', (select count(*) from public.events where name = 'page_view' and page like case when p_kind = 'test' then '/test-your-product%' else '/launch-your-toy%' end and created_at > since),
    'tier', (select count(*) from public.events where name = 'biz_tier' and item = p_kind and created_at > since),
    'start', (select count(*) from public.events where name = 'biz_start' and item = p_kind and created_at > since),
    'step1', (select count(*) from public.biz_leads where kind = p_kind and created_at > since),
    'submit', (select count(*) from public.biz_requests where kind = p_kind and created_at > since),
    'paid', (select count(*) from public.orders where product_id like 'deposit-' || p_kind || '-%' and status in ('paid', 'refunded') and paid_at > since),
    'leads', coalesce((select jsonb_agg(x) from (select l.name, l.email, l.tier, l.created_at, l.emailed_day1, l.emailed_day3, l.unsubscribed_at,
        exists (select 1 from public.biz_requests r where lower(r.email) = lower(l.email) and r.kind = l.kind) as requested
      from public.biz_leads l where l.kind = p_kind and l.created_at > since order by l.created_at desc limit 100) x), '[]'));
end; $$;
grant execute on function public.admin_biz_funnel(text, int) to authenticated;

-- ---------- Founding offer deposits mark the request paid too ----------
create or replace function public.biz_deposit_paid()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.product_id like 'deposit-%' and new.item ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    if new.status = 'paid' and (tg_op = 'INSERT' or old.status is distinct from 'paid') then
      update public.biz_requests
        set order_id = new.id, status = case when status = 'submitted' then 'paid' else status end, updated_at = now(),
            details = case when new.product_id like '%-founding' then details || '{"founding": true}'::jsonb else details end
        where id = new.item::uuid and user_id = new.user_id
          and new.product_id in ('deposit-' || kind || '-' || tier, 'deposit-' || kind || '-' || tier || '-founding')
          and (order_id is null or order_id = new.id);
    elsif new.status = 'refunded' and tg_op = 'UPDATE' and old.status is distinct from 'refunded' then
      update public.biz_requests set status = 'refunded', updated_at = now() where order_id = new.id;
    end if;
  end if;
  return new;
end; $$;

-- ---------- Testers accept the confidentiality rule before every test ----------
create or replace function public.start_test(p_test uuid, p_safety jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  t public.product_tests;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if not exists (select 1 from public.tester_profiles where user_id = auth.uid()) then raise exception 'Join as a tester first.'; end if;
  if not (coalesce((p_safety ->> 'testnet')::boolean, false) and coalesce((p_safety ->> 'noFunds')::boolean, false)
          and coalesce((p_safety ->> 'noSeed')::boolean, false) and coalesce((p_safety ->> 'stop')::boolean, false)
          and coalesce((p_safety ->> 'confidential')::boolean, false)) then
    raise exception 'Please tick all the rules first.';
  end if;
  select * into t from public.product_tests where id = p_test for update;
  if not found or t.status <> 'open' then raise exception 'This test is not open.'; end if;
  select id into v_id from public.test_runs where test_id = p_test and user_id = auth.uid();
  if v_id is not null then return v_id; end if;
  if (select count(*) from public.test_runs r where r.test_id = p_test and r.status in ('started', 'submitted', 'approved')) >= t.spots then
    raise exception 'Sorry, this test is full.';
  end if;
  insert into public.test_runs (test_id, user_id, safety) values (p_test, auth.uid(), p_safety || jsonb_build_object('at', now())) returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.start_test(uuid, jsonb) from public, anon;
grant execute on function public.start_test(uuid, jsonb) to authenticated;
