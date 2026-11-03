-- web3.toys, part 2: saved progress, coins, cosmetic extras and the leaderboard.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
--
-- Rules that keep it fair:
-- * Coins are only given by the functions below, never written directly by
--   the browser, with the amounts and daily limits from coin_rules.
-- * Certificates are only saved by the website's server (it checks the secret
--   code first), so ranks cannot be faked.
-- * Coins are site points only: no cash value, never withdrawn or sold.

-- ---------- Certificates (saved by the server after checking the code) ----------
create table if not exists public.certificates (
  user_id uuid not null references auth.users (id) on delete cascade,
  toy text not null,
  title text not null,
  score int not null check (score between 0 and 100),
  code text not null,
  name text,
  cert_date date not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, toy)
);
alter table public.certificates enable row level security;
drop policy if exists "own certificates read" on public.certificates;
create policy "own certificates read" on public.certificates for select using (auth.uid() = user_id or public.is_admin());

-- Only the server (service role) may call this. Keeps the best score.
create or replace function public.record_certificate(p_user uuid, p_toy text, p_title text, p_score int, p_code text, p_name text, p_date date)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.certificates (user_id, toy, title, score, code, name, cert_date)
  values (p_user, p_toy, left(p_title, 120), p_score, p_code, left(p_name, 40), p_date)
  on conflict (user_id, toy) do update
    set title = excluded.title, score = excluded.score, code = excluded.code, name = excluded.name, cert_date = excluded.cert_date, saved_at = now()
    where excluded.score >= public.certificates.score;
end; $$;
revoke all on function public.record_certificate(uuid, text, text, int, text, text, date) from public, anon, authenticated;
grant execute on function public.record_certificate(uuid, text, text, int, text, text, date) to service_role;

-- ---------- Coins ----------
create table if not exists public.coin_rules (
  kind text primary key,
  coins int not null,
  daily_cap int not null
);
insert into public.coin_rules (kind, coins, daily_cap) values
  ('daily', 5, 1),
  ('finish', 20, 15),
  ('certificate', 50, 15),
  ('share', 10, 15),
  ('x', 10, 15)
on conflict (kind) do update set coins = excluded.coins, daily_cap = excluded.daily_cap;
alter table public.coin_rules enable row level security;
drop policy if exists "rules are public" on public.coin_rules;
create policy "rules are public" on public.coin_rules for select using (true);

-- Every coin earned or spent. claim_id is "kind:key" (once each) or "buy:item".
create table if not exists public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  claim_id text not null,
  kind text not null,
  coins int not null,
  label text,
  created_at timestamptz not null default now(),
  unique (user_id, claim_id)
);
create index if not exists coin_ledger_user on public.coin_ledger (user_id, created_at desc);
alter table public.coin_ledger enable row level security;
drop policy if exists "own coins read" on public.coin_ledger;
create policy "own coins read" on public.coin_ledger for select using (auth.uid() = user_id or public.is_admin());

create or replace function public.coin_balance(p_user uuid)
returns int language sql stable security definer set search_path = '' as $$
  select coalesce(sum(coins), 0)::int from public.coin_ledger where user_id = p_user;
$$;
revoke all on function public.coin_balance(uuid) from public, anon, authenticated;

create or replace function public.my_coins()
returns int language sql stable security definer set search_path = '' as $$
  select public.coin_balance(auth.uid());
$$;
grant execute on function public.my_coins() to authenticated;

-- Earn coins. Returns the coins given (0 if already claimed or over the limit).
create or replace function public.claim_coins(p_kind text, p_key text, p_label text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r public.coin_rules;
  uid uuid := auth.uid();
  today_count int;
  claim text;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  select * into r from public.coin_rules where kind = p_kind;
  if not found or p_key is null or length(p_key) > 120 then return 0; end if;
  -- The daily bonus key must be today's date.
  if p_kind = 'daily' and p_key <> to_char(now() at time zone 'utc', 'YYYY-MM-DD') then return 0; end if;
  -- Certificate coins need a checked certificate for that toy.
  if p_kind = 'certificate' and not exists (select 1 from public.certificates where user_id = uid and toy = p_key) then return 0; end if;
  select count(*) into today_count from public.coin_ledger
    where user_id = uid and kind = p_kind and created_at > now() - interval '1 day';
  if today_count >= r.daily_cap then return 0; end if;
  claim := p_kind || ':' || p_key;
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (uid, claim, p_kind, r.coins, left(coalesce(p_label, ''), 120))
  on conflict (user_id, claim_id) do nothing;
  if not found then return 0; end if;
  return r.coins;
end; $$;
grant execute on function public.claim_coins(text, text, text) to authenticated;

-- First login: bring coins earned in this browser before the account existed.
-- Runs once per account and is capped, so it cannot be used to farm coins.
alter table public.profiles add column if not exists merged_at timestamptz;

create or replace function public.merge_local_coins(p_claims jsonb)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  item jsonb;
  k text;
  key text;
  amount int;
  added int := 0;
  cap constant int := 1000;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if (select merged_at from public.profiles where id = uid) is not null then return 0; end if;
  update public.profiles set merged_at = now() where id = uid;
  for item in select * from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) limit 300 loop
    k := split_part(item ->> 'id', ':', 1);
    key := substr(item ->> 'id', length(k) + 2);
    if k = 'daily' or k = 'buy' or key = '' or length(key) > 120 then continue; end if;
    select coins into amount from public.coin_rules where kind = k;
    if amount is null then continue; end if;
    if k = 'certificate' and not exists (select 1 from public.certificates where user_id = uid and toy = key) then continue; end if;
    if added + amount > cap then exit; end if;
    insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
    values (uid, k || ':' || key, k, amount, left(coalesce(item ->> 'label', 'Earned before logging in'), 120))
    on conflict (user_id, claim_id) do nothing;
    if found then added := added + amount; end if;
  end loop;
  return added;
end; $$;
grant execute on function public.merge_local_coins(jsonb) to authenticated;

-- ---------- Cosmetic extras (coins only, no cash value) ----------
-- Keep these ids and prices the same as data/cosmetics.json.
create table if not exists public.cosmetic_items (
  id text primary key,
  slot text not null check (slot in ('cert', 'frame', 'theme')),
  coins int not null
);
insert into public.cosmetic_items (id, slot, coins) values
  ('cert-mint', 'cert', 150), ('cert-sky', 'cert', 300), ('cert-gold', 'cert', 600),
  ('frame-blue', 'frame', 100), ('frame-rainbow', 'frame', 250), ('frame-gold', 'frame', 500),
  ('theme-mint', 'theme', 120), ('theme-sky', 'theme', 120), ('theme-night', 'theme', 400)
on conflict (id) do update set slot = excluded.slot, coins = excluded.coins;
alter table public.cosmetic_items enable row level security;
drop policy if exists "items are public" on public.cosmetic_items;
create policy "items are public" on public.cosmetic_items for select using (true);

alter table public.profiles add column if not exists cert_style text;
alter table public.profiles add column if not exists badge_frame text;
alter table public.profiles add column if not exists theme text;

-- Unlock an extra with coins. Returns the coins left, or raises a message.
create or replace function public.buy_cosmetic(p_item text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  it public.cosmetic_items;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  select * into it from public.cosmetic_items where id = p_item;
  if not found then raise exception 'Unknown item'; end if;
  if exists (select 1 from public.coin_ledger where user_id = uid and claim_id = 'buy:' || p_item) then
    return public.coin_balance(uid);
  end if;
  -- One purchase at a time per person, so two taps cannot overspend.
  perform pg_advisory_xact_lock(hashtext(uid::text));
  if public.coin_balance(uid) < it.coins then raise exception 'Not enough coins'; end if;
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (uid, 'buy:' || p_item, 'buy', -it.coins, 'Unlocked ' || p_item);
  return public.coin_balance(uid);
end; $$;
grant execute on function public.buy_cosmetic(text) to authenticated;

-- Wear an unlocked extra (or null to go back to the default).
create or replace function public.equip_cosmetic(p_slot text, p_item text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not logged in'; end if;
  if p_item is not null and not exists (
    select 1 from public.cosmetic_items i join public.coin_ledger l on l.claim_id = 'buy:' || i.id
    where i.id = p_item and i.slot = p_slot and l.user_id = uid
  ) then raise exception 'Unlock it first'; end if;
  if p_slot = 'cert' then update public.profiles set cert_style = p_item where id = uid;
  elsif p_slot = 'frame' then update public.profiles set badge_frame = p_item where id = uid;
  elsif p_slot = 'theme' then update public.profiles set theme = p_item where id = uid;
  else raise exception 'Unknown slot'; end if;
end; $$;
grant execute on function public.equip_cosmetic(text, text) to authenticated;

-- ---------- Leaderboard (display names only) ----------
create or replace function public.leaderboard(p_limit int default 50)
returns table (display_name text, avatar_seed text, badge_frame text, certificates int, coins int, is_me boolean)
language sql stable security definer set search_path = '' as $$
  select p.display_name, p.avatar_seed, p.badge_frame,
    (select count(*)::int from public.certificates c where c.user_id = p.id) as certificates,
    public.coin_balance(p.id) as coins,
    p.id = auth.uid() as is_me
  from public.profiles p
  where p.display_name is not null
  order by certificates desc, coins desc, p.created_at
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;
grant execute on function public.leaderboard(int) to anon, authenticated;
