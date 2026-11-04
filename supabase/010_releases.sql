-- web3.toys: scheduled toy releases (data/releases.json) and Notify me.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.
-- Needs 001_accounts.sql first.
--
-- The schedule itself lives in data/releases.json. This file adds:
--   server_now(): the server's clock, so a visitor's wrong clock cannot
--     unlock a toy early.
--   release_overrides: your Release now / Delay buttons in the admin
--     dashboard (they win over the date in releases.json).
--   release_notify: who tapped Notify me for which toy (launch emails).

create or replace function public.server_now()
returns timestamptz language sql stable as $$ select now() $$;
grant execute on function public.server_now() to anon, authenticated;

-- ---------- Admin overrides ----------
create table if not exists public.release_overrides (
  toy_id text primary key check (toy_id ~ '^[a-z0-9-]{2,40}$'),
  action text not null check (action in ('release', 'delay')),
  until timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
alter table public.release_overrides enable row level security;
drop policy if exists "everyone reads overrides" on public.release_overrides;
create policy "everyone reads overrides" on public.release_overrides for select using (true);

-- p_action: 'release' (live now), 'delay' (locked until p_until, or until
-- you clear it when p_until is empty) or null (clear: back to releases.json).
create or replace function public.admin_set_release(p_toy text, p_action text, p_until timestamptz default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  if p_action is null then
    delete from public.release_overrides where toy_id = p_toy;
    return;
  end if;
  if p_action not in ('release', 'delay') then raise exception 'Unknown action'; end if;
  insert into public.release_overrides (toy_id, action, until, updated_by)
  values (p_toy, p_action, case when p_action = 'delay' then p_until else null end, auth.uid())
  on conflict (toy_id) do update set action = excluded.action, until = excluded.until, updated_at = now(), updated_by = excluded.updated_by;
end; $$;
revoke all on function public.admin_set_release(text, text, timestamptz) from public, anon;
grant execute on function public.admin_set_release(text, text, timestamptz) to authenticated;

-- ---------- Notify me ----------
create table if not exists public.release_notify (
  id bigint generated always as identity primary key,
  toy_id text not null check (toy_id ~ '^[a-z0-9-]{2,40}$'),
  user_id uuid references auth.users (id) on delete cascade,
  email text not null check (length(email) <= 200),
  consent_at timestamptz not null default now(),
  sent_day_before timestamptz,
  sent_launch timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists release_notify_once on public.release_notify (toy_id, lower(email));
alter table public.release_notify enable row level security;
drop policy if exists "own notify read" on public.release_notify;
create policy "own notify read" on public.release_notify for select using (auth.uid() = user_id or public.is_admin());

-- Saves one Notify me. Logged in: the account's email is used when p_email
-- is empty. Visitors: p_email is needed. p_consent must be true.
create or replace function public.notify_me(p_toy text, p_email text, p_consent boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if p_consent is not true then raise exception 'Please tick the box so we can email you.'; end if;
  if coalesce(p_toy, '') !~ '^[a-z0-9-]{2,40}$' then raise exception 'Unknown toy.'; end if;
  if v_email = '' and auth.uid() is not null then
    select lower(email) into v_email from auth.users where id = auth.uid();
  end if;
  if coalesce(v_email, '') !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 200 then
    raise exception 'Add an email we can write to.';
  end if;
  -- A small brake on one address being added to everything at once.
  if (select count(*) from public.release_notify where lower(email) = v_email and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many at once. Try again later.';
  end if;
  insert into public.release_notify (toy_id, user_id, email)
  values (p_toy, auth.uid(), v_email)
  on conflict (toy_id, lower(email)) do update set user_id = coalesce(public.release_notify.user_id, excluded.user_id);
  return true;
end; $$;
grant execute on function public.notify_me(text, text, boolean) to anon, authenticated;

-- Which toys this account asked to hear about (to show "We will tell you").
create or replace function public.my_notify()
returns setof text language sql stable security definer set search_path = '' as $$
  select toy_id from public.release_notify where user_id = auth.uid();
$$;
grant execute on function public.my_notify() to authenticated;
