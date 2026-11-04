-- web3.toys: coin tasks (quests), unlocking paid items with coins, and referrals.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Run 001 to 007 first.
--
-- Coins are site points. They can unlock extras and paid items on the site,
-- but have no cash value and can never be withdrawn, sold or swapped.
-- Every reward here is checked or capped by the database.

-- ---------- Quests ----------
-- check: auto (the database checks it), post (a link to the player's X
-- post, kept for spot checks), honor (trusted, once only, small).
create table if not exists public.quests (
  id text primary key,
  coins int not null check (coins > 0),
  check_type text not null check (check_type in ('auto', 'post', 'honor'))
);
insert into public.quests (id, coins, check_type) values
  ('account', 50, 'auto'),
  ('first-toy', 20, 'auto'),
  ('first-cert', 50, 'auto'),
  ('streak-3', 30, 'auto'),
  ('streak-7', 75, 'auto'),
  ('post-x', 50, 'post'),
  ('join-telegram', 20, 'honor'),
  ('follow-x', 20, 'honor')
on conflict (id) do update set coins = excluded.coins, check_type = excluded.check_type;
alter table public.quests enable row level security;
drop policy if exists "quests are public" on public.quests;
create policy "quests are public" on public.quests for select using (true);

-- Links to X posts, for spot checks in the admin dashboard.
create table if not exists public.quest_proofs (
  user_id uuid not null references auth.users (id) on delete cascade,
  quest text not null,
  proof text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, quest)
);
alter table public.quest_proofs enable row level security;
drop policy if exists "admins read proofs" on public.quest_proofs;
create policy "admins read proofs" on public.quest_proofs for select using (public.is_admin() or auth.uid() = user_id);

-- Days in a row with the daily bonus, ending today or yesterday.
create or replace function public.streak_days(p_user uuid)
returns int language plpgsql stable security definer set search_path = '' as $$
declare d date := (now() at time zone 'utc')::date; n int := 0;
begin
  if not exists (select 1 from public.coin_ledger where user_id = p_user and claim_id = 'daily:' || to_char(d, 'YYYY-MM-DD')) then d := d - 1; end if;
  while exists (select 1 from public.coin_ledger where user_id = p_user and claim_id = 'daily:' || to_char(d, 'YYYY-MM-DD')) loop
    n := n + 1; d := d - 1;
    exit when n >= 60;
  end loop;
  return n;
end; $$;
revoke all on function public.streak_days(uuid) from public, anon, authenticated;

-- Claim a quest. Returns the coins given, or raises a friendly message.
create or replace function public.claim_quest(p_id text, p_proof text default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  q public.quests;
  ok boolean := false;
begin
  if uid is null then raise exception 'Log in first'; end if;
  select * into q from public.quests where id = p_id;
  if not found then raise exception 'Unknown task'; end if;
  if exists (select 1 from public.coin_ledger where user_id = uid and claim_id = 'quest:' || p_id) then return 0; end if;
  if p_id = 'account' then ok := true;
  elsif p_id = 'first-toy' then ok := exists (select 1 from public.coin_ledger where user_id = uid and kind = 'finish');
  elsif p_id = 'first-cert' then ok := exists (select 1 from public.certificates where user_id = uid);
  elsif p_id = 'streak-3' then ok := public.streak_days(uid) >= 3;
  elsif p_id = 'streak-7' then ok := public.streak_days(uid) >= 7;
  elsif q.check_type = 'post' then
    ok := coalesce(p_proof, '') ~* '^https://(www\.)?(x|twitter)\.com/[A-Za-z0-9_]{1,15}/status/[0-9]{5,25}';
    if not ok then raise exception 'Paste the link to your post (it looks like https://x.com/you/status/123...)'; end if;
    if exists (select 1 from public.quest_proofs where quest = p_id and proof = split_part(p_proof, '?', 1) and user_id <> uid) then
      raise exception 'That post was already used';
    end if;
    insert into public.quest_proofs (user_id, quest, proof) values (uid, p_id, split_part(p_proof, '?', 1)) on conflict (user_id, quest) do nothing;
  elsif q.check_type = 'honor' then ok := true;
  end if;
  if not ok then raise exception 'Not done yet'; end if;
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (uid, 'quest:' || p_id, 'quest', q.coins, 'Task: ' || p_id)
  on conflict (user_id, claim_id) do nothing;
  return q.coins;
end; $$;
grant execute on function public.claim_quest(text, text) to authenticated;

-- ---------- Unlocking paid items with coins ----------
-- Keep these the same as the "coins" prices in data/products.json (a test checks).
create table if not exists public.coin_products (
  id text primary key,
  title text not null,
  coins int not null check (coins > 0),
  per_item boolean not null default false
);
insert into public.coin_products (id, title, coins, per_item) values
  ('report-full', 'Full report PDF', 600, true),
  ('cert-hd', 'HD certificate', 400, true),
  ('cert-premium', 'Premium certificate design', 600, true),
  ('export-branded', 'Branded export', 1000, true),
  ('launch-report', 'Full Launch Readiness Report', 2000, true),
  ('book-first-30-days', 'Your First 30 Days in Crypto', 1500, false),
  ('book-dont-get-rekt', 'Don''t Get Rekt', 2000, false),
  ('book-launch-week', 'Launch Week Playbook', 3000, false)
on conflict (id) do update set title = excluded.title, coins = excluded.coins, per_item = excluded.per_item;
alter table public.coin_products enable row level security;
drop policy if exists "coin prices are public" on public.coin_products;
create policy "coin prices are public" on public.coin_products for select using (true);

-- Orders paid with coins: provider 'coins', currency 'COINS', amount = coins.
alter table public.orders drop constraint if exists orders_currency_check;
alter table public.orders add constraint orders_currency_check check (currency in ('INR', 'USD', 'COINS'));
alter table public.orders drop constraint if exists orders_provider_check;
alter table public.orders add constraint orders_provider_check check (provider in ('razorpay', 'paymento', 'coins'));

create or replace function public.redeem_product(p_product text, p_item text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  p public.coin_products;
  v_item text := nullif(trim(coalesce(p_item, '')), '');
  oid uuid := gen_random_uuid();
  mail text;
begin
  if uid is null then raise exception 'Log in first'; end if;
  select * into p from public.coin_products where id = p_product;
  if not found then raise exception 'This cannot be unlocked with coins'; end if;
  if p.per_item and v_item is null then raise exception 'Which one is this for?'; end if;
  if not p.per_item then v_item := null; end if;
  if v_item is not null and v_item !~ '^[A-Za-z0-9:._-]{1,60}$' then raise exception 'Unknown item'; end if;
  if exists (select 1 from public.orders o where o.user_id = uid and o.product_id = p_product and coalesce(o.item, '') = coalesce(v_item, '') and o.status = 'paid') then
    raise exception 'You already have this';
  end if;
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if public.coin_balance(uid) < p.coins then raise exception 'Not enough coins'; end if;
  select email into mail from auth.users where id = uid;
  insert into public.orders (id, user_id, email, product_id, item, title, currency, amount, status, provider, paid_at)
  values (oid, uid, mail, p.id, v_item, p.title || coalesce(' (' || v_item || ')', ''), 'COINS', p.coins, 'paid', 'coins', now());
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (uid, 'redeem:' || oid, 'redeem', -p.coins, 'Unlocked ' || p.title);
  return oid;
end; $$;
grant execute on function public.redeem_product(text, text) to authenticated;

-- ---------- Referrals ----------
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references auth.users (id) on delete set null;

create table if not exists public.referrals (
  referee uuid primary key references auth.users (id) on delete cascade,
  referrer uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'paid', 'capped')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz
);
create index if not exists referrals_referrer on public.referrals (referrer);
alter table public.referrals enable row level security;
drop policy if exists "own referrals read" on public.referrals;
create policy "own referrals read" on public.referrals for select using (auth.uid() = referrer or public.is_admin());

-- Your invite code (made the first time you ask) and how your invites are going.
create or replace function public.my_referrals()
returns table (code text, pending int, paid int)
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); c text;
begin
  if uid is null then raise exception 'Log in first'; end if;
  select referral_code into c from public.profiles where id = uid;
  while c is null loop
    c := lower(substr(md5(random()::text || uid::text), 1, 8));
    begin
      update public.profiles set referral_code = c where id = uid;
    exception when unique_violation then c := null;
    end;
  end loop;
  return query select c,
    (select count(*)::int from public.referrals r where r.referrer = uid and r.status = 'pending'),
    (select count(*)::int from public.referrals r where r.referrer = uid and r.status = 'paid');
end; $$;
grant execute on function public.my_referrals() to authenticated;

-- Record who invited a new player. Only once, only within 7 days of signing
-- up, and never yourself.
create or replace function public.set_referrer(p_code text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); ref uuid; joined timestamptz;
begin
  if uid is null then return false; end if;
  select created_at into joined from public.profiles where id = uid;
  if joined is null or joined < now() - interval '7 days' then return false; end if;
  if exists (select 1 from public.profiles where id = uid and referred_by is not null) then return false; end if;
  select id into ref from public.profiles where referral_code = lower(trim(coalesce(p_code, '')));
  if ref is null or ref = uid then return false; end if;
  update public.profiles set referred_by = ref where id = uid;
  insert into public.referrals (referee, referrer) values (uid, ref) on conflict (referee) do nothing;
  return true;
end; $$;
grant execute on function public.set_referrer(text) to authenticated;

-- A referral counts once the new player has a checked certificate and has
-- finished 3 toys. Then: inviter +200, new player +50. Up to 20 paid
-- referrals per inviter per 30 days. Called by the new player's browser.
create or replace function public.check_referral()
returns text language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); r public.referrals; recent int;
begin
  if uid is null then return 'none'; end if;
  select * into r from public.referrals where referee = uid;
  if not found or r.status <> 'pending' then return coalesce(r.status, 'none'); end if;
  if not exists (select 1 from public.certificates where user_id = uid) then return 'pending'; end if;
  if (select count(*) from public.coin_ledger where user_id = uid and kind = 'finish') < 3 then return 'pending'; end if;
  perform pg_advisory_xact_lock(hashtext(r.referrer::text));
  select count(*) into recent from public.referrals where referrer = r.referrer and status = 'paid' and qualified_at > now() - interval '30 days';
  if recent >= 20 then
    update public.referrals set status = 'capped', qualified_at = now() where referee = uid;
    return 'capped';
  end if;
  update public.referrals set status = 'paid', qualified_at = now() where referee = uid;
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (r.referrer, 'referral:' || uid, 'referral', 200, 'A friend you invited qualified') on conflict (user_id, claim_id) do nothing;
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (uid, 'welcome:referral', 'referral', 50, 'Welcome bonus for joining with an invite') on conflict (user_id, claim_id) do nothing;
  return 'paid';
end; $$;
grant execute on function public.check_referral() to authenticated;

-- Admin: referrals and post links for spot checks.
create or replace function public.admin_referrals()
returns table (referrer_name text, referee_name text, status text, created_at timestamptz, qualified_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select a.display_name, b.display_name, r.status, r.created_at, r.qualified_at
  from public.referrals r left join public.profiles a on a.id = r.referrer left join public.profiles b on b.id = r.referee
  order by r.created_at desc;
end; $$;
grant execute on function public.admin_referrals() to authenticated;

create or replace function public.admin_proofs()
returns table (display_name text, quest text, proof text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return query select p.display_name, q.quest, q.proof, q.created_at
  from public.quest_proofs q left join public.profiles p on p.id = q.user_id order by q.created_at desc;
end; $$;
grant execute on function public.admin_proofs() to authenticated;
