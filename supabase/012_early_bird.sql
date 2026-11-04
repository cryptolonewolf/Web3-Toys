-- web3.toys: Early Bird 2x.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 003_progress.sql first.
--
-- For each toy, the first 1,000 logged-in players who earn its certificate
-- (from its Early Bird start) get a numbered spot: "Early Bird #87". One spot
-- per account per toy. Spots are handed out inside the database, one at a
-- time, so two people can never get the same number.
-- A spot doubles every coin earned on that toy: coins already earned on it
-- are matched at once (an "Early Bird 2x bonus" line), and later ones count
-- double. Starts and spot counts are below; keep them in step with
-- data/releases.json (the automatic checks compare them).

create table if not exists public.early_bird_toys (
  toy text primary key,
  starts_at timestamptz not null,
  spots int not null default 1000 check (spots > 0),
  aliases text[] not null default '{}'  -- other coin keys that belong to this toy
);
alter table public.early_bird_toys enable row level security;
drop policy if exists "early bird toys public" on public.early_bird_toys;
create policy "early bird toys public" on public.early_bird_toys for select using (true);

insert into public.early_bird_toys (toy, starts_at, spots, aliases) values
  ('crypto-in-5', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('getting-started', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('dont-lose-money', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('web3-hacks', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('earn-small', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('scam', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('dead-projects', '2026-11-10 10:00:00+05:30', 1000, '{dead-projects-dive}'),
  ('invest-100', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('token-split', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('token-simulator', '2026-11-10 10:00:00+05:30', 1000, '{simulator}'),
  ('hall-of-fame', '2026-11-10 10:00:00+05:30', 1000, '{}'),
  ('web3-roles', '2026-11-17 10:00:00+05:30', 1000, '{}'),
  ('tokenomics-basics', '2026-11-24 10:00:00+05:30', 1000, '{}'),
  ('ways-to-moon', '2026-12-01 10:00:00+05:30', 1000, '{}'),
  ('first-job', '2026-12-08 10:00:00+05:30', 1000, '{}'),
  ('raise-first-round', '2026-12-15 10:00:00+05:30', 1000, '{}')
on conflict (toy) do update set starts_at = excluded.starts_at, spots = excluded.spots, aliases = excluded.aliases;

create table if not exists public.early_birds (
  toy text not null references public.early_bird_toys (toy) on delete cascade,
  spot int not null check (spot > 0),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (toy, spot),
  unique (toy, user_id)
);
alter table public.early_birds enable row level security;
drop policy if exists "own early birds read" on public.early_birds;
create policy "own early birds read" on public.early_birds for select using (auth.uid() = user_id or public.is_admin());

-- The coin keys that belong to a toy (finish, certificate, share, X post).
create or replace function public.early_bird_key(p_toy text, p_key text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.early_bird_toys t where t.toy = p_toy and (p_key = t.toy or p_key = any (t.aliases)));
$$;

-- Hands out the next spot for a toy, if one is left. Returns the spot
-- number, or null. Locks the toy's row so spots are given one at a time.
create or replace function public.grant_early_bird(p_user uuid, p_toy text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  t public.early_bird_toys;
  n int;
  have int;
  bonus int;
begin
  select * into t from public.early_bird_toys where toy = p_toy for update;
  if not found or now() < t.starts_at then return null; end if;
  select spot into have from public.early_birds where toy = p_toy and user_id = p_user;
  if have is not null then return have; end if;
  select count(*) into n from public.early_birds where toy = p_toy;
  if n >= t.spots then return null; end if;
  insert into public.early_birds (toy, spot, user_id) values (p_toy, n + 1, p_user);
  -- Match the coins already earned on this toy.
  select coalesce(sum(coins), 0) into bonus from public.coin_ledger
    where user_id = p_user and kind in ('finish', 'certificate', 'share', 'x') and coins > 0
      and public.early_bird_key(p_toy, substr(claim_id, length(kind) + 2));
  if bonus > 0 then
    insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
    values (p_user, 'earlybird:' || p_toy, 'earlybird', bonus, 'Early Bird 2x bonus')
    on conflict (user_id, claim_id) do nothing;
  end if;
  return n + 1;
end; $$;
revoke all on function public.grant_early_bird(uuid, text) from public, anon, authenticated;

-- A certificate saved (new, or a better score) during Early Bird takes a spot.
create or replace function public.certificate_early_bird()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.grant_early_bird(new.user_id, new.toy);
  return new;
end; $$;
drop trigger if exists certificates_early_bird on public.certificates;
create trigger certificates_early_bird after insert or update on public.certificates
  for each row execute function public.certificate_early_bird();

-- Coins: the same as before, doubled for toys where the player has a spot.
create or replace function public.claim_coins(p_kind text, p_key text, p_label text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  r public.coin_rules;
  uid uuid := auth.uid();
  today_count int;
  claim text;
  amount int;
begin
  if uid is null then raise exception 'Not logged in'; end if;
  select * into r from public.coin_rules where kind = p_kind;
  if not found or p_key is null or length(p_key) > 120 then return 0; end if;
  if p_kind = 'daily' and p_key <> to_char(now() at time zone 'utc', 'YYYY-MM-DD') then return 0; end if;
  if p_kind = 'certificate' and not exists (select 1 from public.certificates where user_id = uid and toy = p_key) then return 0; end if;
  select count(*) into today_count from public.coin_ledger
    where user_id = uid and kind = p_kind and created_at > now() - interval '1 day';
  if today_count >= r.daily_cap then return 0; end if;
  amount := r.coins;
  if p_kind in ('finish', 'certificate', 'share', 'x') and exists (
    select 1 from public.early_birds b where b.user_id = uid and public.early_bird_key(b.toy, p_key)
  ) then amount := r.coins * 2; end if;
  claim := p_kind || ':' || p_key;
  insert into public.coin_ledger (user_id, claim_id, kind, coins, label)
  values (uid, claim, p_kind, amount, left(coalesce(p_label, ''), 120) || case when amount > r.coins then ' (Early Bird 2x)' else '' end)
  on conflict (user_id, claim_id) do nothing;
  if not found then return 0; end if;
  return amount;
end; $$;
grant execute on function public.claim_coins(text, text, text) to authenticated;

-- Public counter: spots used per toy.
create or replace function public.early_bird_counts()
returns table (toy text, starts_at timestamptz, spots int, used bigint)
language sql stable security definer set search_path = '' as $$
  select t.toy, t.starts_at, t.spots, (select count(*) from public.early_birds b where b.toy = t.toy)
  from public.early_bird_toys t;
$$;
grant execute on function public.early_bird_counts() to anon, authenticated;

-- This player's spots.
create or replace function public.my_early_birds()
returns table (toy text, spot int, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select toy, spot, created_at from public.early_birds where user_id = auth.uid();
$$;
grant execute on function public.my_early_birds() to authenticated;
