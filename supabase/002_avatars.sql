-- web3.toys: random cartoon profile pictures and fun display names.
-- Paste into Supabase: SQL Editor, New query, Run. Safe to run again.

-- The picture is drawn from this seed in the browser (js/avatar.js), so
-- only a short code is stored, never an uploaded photo.
alter table public.profiles add column if not exists avatar_seed text;

-- New accounts no longer copy the name from X, Google or the email address:
-- the site gives them a random fun name (like SleepyFrog42) instead, so real
-- names never appear on the leaderboard unless the person types one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, provider)
  values (new.id, coalesce(new.raw_app_meta_data ->> 'provider', 'email'))
  on conflict (id) do nothing;
  return new;
end;
$$;

grant update (display_name, avatar_seed, consent_at, consent_version, last_seen_at) on public.profiles to authenticated;
