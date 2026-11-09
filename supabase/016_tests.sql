-- web3.toys: Test Your Product (paid testers).
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 003_progress.sql, 006_admin.sql and 014_business.sql first.
--
-- Testers: logged-in players with 2 or more certificates (Explorer rank,
-- data/ranks.json) join with a stablecoin payout wallet and agree to the
-- safety rules. You (admin) create a test from an approved request, with its
-- task list, and open it. Testers who qualify start it (after ticking the
-- safety rules), time each task, mark it done, stuck or gave up, rate it,
-- comment and add an optional screenshot (private storage). You approve each
-- submission: that adds coins (no cash value) and records the stablecoin
-- amount owed from the 25% tester pool. You pay from your own wallet and
-- paste the transaction link; the site never holds funds or keys.

-- ---------- Testers ----------
create table if not exists public.tester_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  network text not null check (network in ('ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb', 'solana', 'tron')),
  token text not null check (token in ('USDC', 'USDT')),
  wallet text not null check (length(wallet) between 26 and 64 and wallet ~ '^[A-Za-z0-9]+$'),
  agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.tester_profiles enable row level security;
drop policy if exists "own tester profile read" on public.tester_profiles;
create policy "own tester profile read" on public.tester_profiles for select using (auth.uid() = user_id or public.is_admin());

-- The rank needed to test: Explorer = 2 certificates (keep in step with
-- data/ranks.json and test_tiers.json; the automatic checks compare them).
create or replace function public.tester_min_certificates() returns int language sql immutable as $$ select 2 $$;

create or replace function public.join_testers(p_network text, p_token text, p_wallet text, p_agree boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  w text := btrim(coalesce(p_wallet, ''));
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if p_agree is not true then raise exception 'Please agree to the tester rules.'; end if;
  if (select count(*) from public.certificates where user_id = auth.uid()) < public.tester_min_certificates() then
    raise exception 'Testers need Explorer rank: earn % certificates first.', public.tester_min_certificates();
  end if;
  if p_network in ('ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'bnb') and w !~ '^0x[0-9a-fA-F]{40}$' then raise exception 'That does not look like a wallet address for this network (it should start with 0x).'; end if;
  if p_network = 'solana' and w !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'That does not look like a Solana address.'; end if;
  if p_network = 'tron' and w !~ '^T[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That does not look like a Tron address (it should start with T).'; end if;
  insert into public.tester_profiles (user_id, network, token, wallet) values (auth.uid(), p_network, p_token, w)
  on conflict (user_id) do update set network = excluded.network, token = excluded.token, wallet = excluded.wallet, agreed_at = now();
end; $$;
revoke all on function public.join_testers(text, text, text, boolean) from public, anon;
grant execute on function public.join_testers(text, text, text, boolean) to authenticated;

-- ---------- Tests ----------
create table if not exists public.product_tests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.biz_requests (id) on delete set null,
  project text not null,
  title text not null,
  intro text,
  url text not null check (url ~ '^https://'),
  network_note text,
  tasks jsonb not null default '[]',
  spots int not null default 10 check (spots between 1 and 500),
  reward_usd numeric(10, 2) not null default 0 check (reward_usd >= 0),
  coins int not null default 300 check (coins >= 0),
  minutes int not null default 30 check (minutes between 5 and 240),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'reported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.product_tests enable row level security;
drop policy if exists "admins read tests" on public.product_tests;
create policy "admins read tests" on public.product_tests for select using (public.is_admin());

create table if not exists public.test_runs (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.product_tests (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'submitted', 'approved', 'rejected')),
  safety jsonb not null default '{}',
  results jsonb not null default '[]',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  admin_note text,
  owed_usd numeric(10, 2),
  paid_at timestamptz,
  paid_tx text,
  unique (test_id, user_id)
);
alter table public.test_runs enable row level security;
drop policy if exists "own runs read" on public.test_runs;
create policy "own runs read" on public.test_runs for select using (auth.uid() = user_id or public.is_admin());

-- Open tests for this tester, with spots left (no project secrets beyond the task list).
create or replace function public.open_tests()
returns table (id uuid, project text, title text, intro text, url text, network_note text, tasks jsonb, reward_usd numeric, coins int, minutes int, spots_left int, my_status text)
language sql stable security definer set search_path = '' as $$
  select t.id, t.project, t.title, t.intro, t.url, t.network_note, t.tasks, t.reward_usd, t.coins, t.minutes,
         greatest(0, t.spots - (select count(*) from public.test_runs r where r.test_id = t.id and r.status in ('started', 'submitted', 'approved')))::int,
         (select r.status from public.test_runs r where r.test_id = t.id and r.user_id = auth.uid())
  from public.product_tests t
  where t.status = 'open' and exists (select 1 from public.tester_profiles p where p.user_id = auth.uid());
$$;
grant execute on function public.open_tests() to authenticated;

-- Start: the four safety rules must all be ticked, and a spot must be left.
create or replace function public.start_test(p_test uuid, p_safety jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  t public.product_tests;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Log in first.'; end if;
  if not exists (select 1 from public.tester_profiles where user_id = auth.uid()) then raise exception 'Join as a tester first.'; end if;
  if not (coalesce((p_safety ->> 'testnet')::boolean, false) and coalesce((p_safety ->> 'noFunds')::boolean, false)
          and coalesce((p_safety ->> 'noSeed')::boolean, false) and coalesce((p_safety ->> 'stop')::boolean, false)) then
    raise exception 'Please tick all four safety rules first.';
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

-- Submit: one result per task. Comments that look like a recovery phrase
-- (12 or more short words in a row with no punctuation) or a private key
-- (64 hex characters) are refused.
create or replace function public.submit_test(p_run uuid, p_results jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.test_runs;
  t public.product_tests;
  item jsonb;
  c text;
begin
  select * into r from public.test_runs where id = p_run and user_id = auth.uid() for update;
  if not found then raise exception 'Unknown test.'; end if;
  if r.status <> 'started' then raise exception 'Already sent.'; end if;
  select * into t from public.product_tests where id = r.test_id;
  if jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) <> jsonb_array_length(t.tasks) then raise exception 'Please answer every task.'; end if;
  if length(p_results::text) > 30000 then raise exception 'Your answers are too long.'; end if;
  for item in select * from jsonb_array_elements(p_results) loop
    if coalesce(item ->> 'outcome', '') not in ('done', 'stuck', 'gave_up') then raise exception 'Mark every task done, stuck or gave up.'; end if;
    if coalesce((item ->> 'rating')::int, 0) not between 1 and 5 then raise exception 'Rate every task from 1 to 5.'; end if;
    c := lower(coalesce(item ->> 'comment', ''));
    if length(c) > 1000 then raise exception 'Comments can be up to 1,000 characters.'; end if;
    if c ~ '([a-z]{3,8} ){11,}[a-z]{3,8}' or c ~ '[0-9a-f]{64}' then
      raise exception 'A comment looks like a recovery phrase or private key. Never share those. Please remove it.';
    end if;
    if item ? 'shot' and coalesce(item ->> 'shot', '') <> '' and (item ->> 'shot') !~ ('^' || auth.uid()::text || '/' || r.test_id::text || '/[a-z0-9-]{1,40}\.(png|jpg)$') then
      raise exception 'Unknown screenshot.';
    end if;
  end loop;
  update public.test_runs set results = p_results, status = 'submitted', submitted_at = now() where id = p_run;
end; $$;
revoke all on function public.submit_test(uuid, jsonb) from public, anon;
grant execute on function public.submit_test(uuid, jsonb) to authenticated;

-- A tester's own runs, with the test name and payout status (any test status).
create or replace function public.my_test_runs()
returns table (id uuid, test_id uuid, project text, title text, status text, owed_usd numeric, paid_at timestamptz, paid_tx text, submitted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.test_id, t.project, t.title, r.status, r.owed_usd, r.paid_at, r.paid_tx, r.submitted_at
  from public.test_runs r join public.product_tests t on t.id = r.test_id
  where r.user_id = auth.uid() order by r.started_at desc;
$$;
revoke all on function public.my_test_runs() from public, anon;
grant execute on function public.my_test_runs() to authenticated;

-- A tester with at least one approved test: full reports are free for them (js/offers.js).
create or replace function public.is_tester()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.tester_profiles p where p.user_id = auth.uid())
     and exists (select 1 from public.test_runs r where r.user_id = auth.uid() and r.status = 'approved');
$$;
grant execute on function public.is_tester() to anon, authenticated;

-- ---------- Admin ----------
create or replace function public.admin_save_test(p_id uuid, p_request uuid, p_project text, p_title text, p_intro text, p_url text,
  p_network text, p_tasks jsonb, p_spots int, p_reward numeric, p_coins int, p_minutes int, p_status text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := p_id;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) < 1 or jsonb_array_length(p_tasks) > 20 then raise exception 'Add 1 to 20 tasks.'; end if;
  if p_status = 'open' and p_request is not null and not exists (select 1 from public.biz_requests where id = p_request and status in ('approved', 'building', 'live')) then
    raise exception 'Approve the project first (Test requests).';
  end if;
  if v_id is null then
    insert into public.product_tests (request_id, project, title, intro, url, network_note, tasks, spots, reward_usd, coins, minutes, status)
    values (p_request, p_project, p_title, p_intro, p_url, p_network, p_tasks, p_spots, p_reward, p_coins, p_minutes, coalesce(p_status, 'draft'))
    returning id into v_id;
  else
    update public.product_tests set request_id = p_request, project = p_project, title = p_title, intro = p_intro, url = p_url, network_note = p_network,
      tasks = p_tasks, spots = p_spots, reward_usd = p_reward, coins = p_coins, minutes = p_minutes, status = coalesce(p_status, status), updated_at = now()
    where id = v_id;
  end if;
  return v_id;
end; $$;
revoke all on function public.admin_save_test(uuid, uuid, text, text, text, text, text, jsonb, int, numeric, int, int, text) from public, anon;
grant execute on function public.admin_save_test(uuid, uuid, text, text, text, text, text, jsonb, int, numeric, int, int, text) to authenticated;

-- Approve a submission: coins (no cash value) and the stablecoin amount owed.
create or replace function public.admin_review_run(p_run uuid, p_status text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.test_runs;
  t public.product_tests;
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'Unknown status'; end if;
  select * into r from public.test_runs where id = p_run for update;
  if not found or r.status not in ('submitted', 'approved', 'rejected') then raise exception 'This run has not been sent yet.'; end if;
  select * into t from public.product_tests where id = r.test_id;
  update public.test_runs set status = p_status, admin_note = coalesce(p_note, admin_note), reviewed_at = now(),
    owed_usd = case when p_status = 'approved' then t.reward_usd else null end
  where id = p_run;
  if p_status = 'approved' and t.coins > 0 then
    insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
    values (r.user_id, 'tester:' || r.test_id, 'tester', t.coins, left('Tested ' || t.title, 120))
    on conflict (user_id, claim_id) do nothing;
  end if;
end; $$;
revoke all on function public.admin_review_run(uuid, text, text) from public, anon;
grant execute on function public.admin_review_run(uuid, text, text) to authenticated;

create or replace function public.admin_mark_paid(p_run uuid, p_tx text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if coalesce(p_tx, '') !~ '^https://' then raise exception 'Paste the transaction link (https://...).'; end if;
  update public.test_runs set paid_at = now(), paid_tx = left(p_tx, 300) where id = p_run and status = 'approved';
end; $$;
revoke all on function public.admin_mark_paid(uuid, text) from public, anon;
grant execute on function public.admin_mark_paid(uuid, text) to authenticated;

-- Testers (with their payout wallet) for the admin payouts list.
create or replace function public.admin_testers()
returns table (user_id uuid, display_name text, network text, token text, wallet text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select p.user_id, pr.display_name, p.network, p.token, p.wallet from public.tester_profiles p left join public.profiles pr on pr.id = p.user_id;
end; $$;
grant execute on function public.admin_testers() to authenticated;

-- ---------- Screenshots: private; testers upload into their own folder ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('test-shots', 'test-shots', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg'];
drop policy if exists "testers upload own shots" on storage.objects;
create policy "testers upload own shots" on storage.objects for insert to authenticated
  with check (bucket_id = 'test-shots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "testers and admins read shots" on storage.objects;
create policy "testers and admins read shots" on storage.objects for select to authenticated
  using (bucket_id = 'test-shots' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
