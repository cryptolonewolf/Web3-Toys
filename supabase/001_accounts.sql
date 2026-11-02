-- web3.toys, part 1: accounts.
-- Paste this whole file into Supabase: SQL Editor, New query, Run.
-- Safe to run again: it only creates what is missing.

-- One row per person, made automatically when they first log in.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  provider text,
  consent_at timestamptz,
  consent_version text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Admins: add your own user id here after your first login (see the guide).
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Fill the profile from the login provider (X or Google name and picture).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url, provider)
  values (
    new.id,
    left(coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Player'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_app_meta_data ->> 'provider', 'email')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Rules: people can read and change only their own profile. Admins can read all.
alter table public.profiles enable row level security;
alter table public.admins enable row level security;

drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "admins read admins" on public.admins;
create policy "admins read admins" on public.admins
  for select using (public.is_admin());

-- Only these columns can be changed by the person themselves.
revoke update on public.profiles from authenticated, anon;
grant update (display_name, consent_at, consent_version, last_seen_at) on public.profiles to authenticated;

-- "Delete my account and data": removes the login, and every table that
-- points at it with "on delete cascade" (profile, and later progress,
-- coins and saved items) goes with it.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not logged in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
